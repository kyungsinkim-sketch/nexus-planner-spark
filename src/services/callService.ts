/**
 * Call Service — LiveKit WebRTC call management.
 *
 * Handles:
 * - Room creation/joining via Edge Functions
 * - LiveKit connection lifecycle
 * - Client-side audio recording (MVP)
 * - Pipeline trigger on call end
 */

import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalParticipant,
  ConnectionState,
} from 'livekit-client';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────

export type CallStatus = 'idle' | 'creating' | 'ringing' | 'connecting' | 'active' | 'ending' | 'processing' | 'completed' | 'error';

export interface CallRoom {
  id: string;
  roomName: string;
  title: string;
  status: string;
}

export interface CallState {
  status: CallStatus;
  room: CallRoom | null;
  wsUrl: string | null;
  token: string | null;
  durationSeconds: number;
  error: string | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isCameraOn: boolean;
  isVideoCall: boolean;
  remoteParticipantName: string | null;
  isScreenSharing: boolean;
  remoteParticipants: Array<{ identity: string; name: string; videoTrack: RemoteTrack | null; screenTrack: RemoteTrack | null }>;
  remoteVideoTrack: RemoteTrack | null;
  remoteScreenTrack: RemoteTrack | null;
  localVideoTrack: any | null; // LocalTrackPublication
  /** Target user IDs for this call (for chat navigation) */
  targetUserIds: string[];
  /** Project context for this call */
  callProjectId: string | null;
}

export interface CallSuggestion {
  id: string;
  suggestionType: 'event' | 'todo' | 'note';
  title: string;
  description: string | null;
  // Event
  eventStart: string | null;
  eventEnd: string | null;
  // Todo
  todoAssigneeId: string | null;
  todoDueDate: string | null;
  todoPriority: string | null;
  // Note
  noteCategory: string | null;
  // Status
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  confidence: number;
  sourceQuote: string | null;
  projectId: string | null;
}

// ─── State ───────────────────────────────────────────

let currentRoom: Room | null = null;

/** Access current LiveKit Room (for video track attachment) */
export function getCurrentRoom(): Room | null {
  return currentRoom;
}
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let durationTimer: ReturnType<typeof setInterval> | null = null;
let callStartTime: number | null = null;
let audioOutputContext: AudioContext | null = null;
let audioOutputGain: GainNode | null = null;
let ringbackContext: AudioContext | null = null;
let ringbackOscillator: OscillatorNode | null = null;
let ringbackInterval: ReturnType<typeof setInterval> | null = null;

// ─── Ringback Tone (발신 대기음) ─────────────────────

function startRingbackTone() {
  try {
    ringbackContext = new AudioContext();
    const gainNode = ringbackContext.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(ringbackContext.destination);

    ringbackOscillator = ringbackContext.createOscillator();
    ringbackOscillator.type = 'sine';
    ringbackOscillator.frequency.value = 440; // A4 note
    ringbackOscillator.connect(gainNode);
    ringbackOscillator.start();

    // Korean ringback pattern: 1s on, 2s off
    let isOn = false;
    const toggle = () => {
      isOn = !isOn;
      gainNode.gain.setTargetAtTime(isOn ? 0.15 : 0, ringbackContext!.currentTime, 0.02);
    };
    toggle(); // Start with tone on
    ringbackInterval = setInterval(toggle, isOn ? 1000 : 2000);

    // More accurate pattern: 1s on, 2s off
    clearInterval(ringbackInterval);
    let phase = 0;
    ringbackInterval = setInterval(() => {
      phase++;
      if (phase % 3 === 1) {
        // ON for 1 second
        gainNode.gain.setTargetAtTime(0.15, ringbackContext!.currentTime, 0.02);
      } else if (phase % 3 === 2) {
        // OFF for 2 seconds
        gainNode.gain.setTargetAtTime(0, ringbackContext!.currentTime, 0.02);
      }
    }, 1000);

    console.log('[Call] Ringback tone started');
  } catch (err) {
    console.warn('[Call] Ringback tone failed:', err);
  }
}

function stopRingbackTone() {
  if (ringbackInterval) {
    clearInterval(ringbackInterval);
    ringbackInterval = null;
  }
  if (ringbackOscillator) {
    ringbackOscillator.stop();
    ringbackOscillator = null;
  }
  if (ringbackContext) {
    ringbackContext.close();
    ringbackContext = null;
  }
}

const listeners = new Set<(state: CallState) => void>();
let currentState: CallState = {
  status: 'idle',
  room: null,
  wsUrl: null,
  token: null,
  durationSeconds: 0,
  error: null,
  isMuted: false,
  isSpeakerOn: false, // Default: earpiece mode (low volume)
  isCameraOn: false,
  isVideoCall: false,
  isScreenSharing: false,
  remoteParticipantName: null,
  remoteParticipants: [],
  remoteVideoTrack: null,
  remoteScreenTrack: null,
  localVideoTrack: null,
  targetUserIds: [],
  callProjectId: null,
};

function setState(partial: Partial<CallState>) {
  currentState = { ...currentState, ...partial };
  listeners.forEach(fn => fn(currentState));
}

export function subscribeCallState(fn: (state: CallState) => void): () => void {
  listeners.add(fn);
  fn(currentState);
  return () => listeners.delete(fn);
}

export function getCallState(): CallState {
  return currentState;
}

// ─── Create Call ─────────────────────────────────────

export async function createCall(targetUserId: string | string[], projectId?: string, title?: string, isVideo?: boolean): Promise<void> {
  const targetUserIds = Array.isArray(targetUserId) ? targetUserId : [targetUserId];
  try {
    setState({ status: 'creating', error: null, isVideoCall: !!isVideo, targetUserIds: targetUserIds, callProjectId: projectId || null });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    console.log('[Call] Creating room for targets:', targetUserIds);
    const response = await supabase.functions.invoke('call-room-create', {
      body: { targetUserIds, projectId, title, isVideo },
    });

    console.log('[Call] Room create response:', response);

    if (response.error) throw new Error(response.error.message);
    if (response.data?.error) throw new Error(response.data.error);

    const { room, token, wsUrl } = response.data;
    if (!token || !wsUrl) throw new Error('서버에서 토큰/URL을 받지 못했습니다');

    setState({
      status: 'ringing',
      room,
      token,
      wsUrl,
    });

    // Start ringback tone while waiting
    startRingbackTone();

    // Poll for rejection while ringing (every 3s, max 30s)
    const roomId = room.id || room;
    let rejectionPollCount = 0;
    const rejectionPoll = setInterval(async () => {
      rejectionPollCount++;
      if (rejectionPollCount > 10) {
        clearInterval(rejectionPoll);
        // Timeout — no answer
        const currentState = getCallState();
        if (currentState.status === 'ringing') {
          stopRingbackTone();
          setState({ status: 'error', error: '상대방이 응답하지 않습니다' });
          setTimeout(() => endCall(), 3000);
        }
        return;
      }
      try {
        const { data: roomData } = await supabase
          .from('call_rooms')
          .select('status')
          .eq('id', roomId)
          .single();
        if (roomData?.status === 'rejected') {
          clearInterval(rejectionPoll);
          stopRingbackTone();
          setState({ status: 'error', error: '상대방이 통화를 거절했습니다' });
          setTimeout(() => endCall(), 3000);
        }
      } catch { /* ignore poll errors */ }
    }, 1500);

    // Clear poll when status changes from ringing
    const unsubStatus = subscribeCallState((state) => {
      if (state.status !== 'ringing') {
        clearInterval(rejectionPoll);
        unsubStatus();
      }
    });

    // Auto-connect caller (recording starts inside connectToRoom after connection)
    await connectToRoom(wsUrl, token);

  } catch (err: any) {
    setState({ status: 'error', error: err.message });
    throw err;
  }
}

// ─── Join Call ───────────────────────────────────────

export async function joinCall(roomId: string): Promise<void> {
  try {
    setState({ status: 'connecting', error: null });

    const response = await supabase.functions.invoke('call-room-join', {
      body: { roomId },
    });

    if (response.error) throw new Error(response.error.message);

    const { token, wsUrl, room } = response.data;

    setState({ room, token, wsUrl });

    // Recording starts inside connectToRoom after connection
    await connectToRoom(wsUrl, token);

  } catch (err: any) {
    setState({ status: 'error', error: err.message });
    throw err;
  }
}

// ─── Connect to LiveKit Room ─────────────────────────

async function connectToRoom(wsUrl: string, token: string): Promise<void> {
  setState({ status: 'connecting' });

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });

  // Event handlers
  room.on(RoomEvent.Connected, () => {
    console.log('[Call] ✅ Room connected event fired');
  });

  room.on(RoomEvent.LocalTrackPublished, (pub: any) => {
    console.log('[Call] LocalTrackPublished, kind:', pub?.track?.kind);
    // Add local audio to recording mix if it wasn't available at recording start
    if (pub?.track?.kind === Track.Kind.Audio && recordingAudioContext && recordingDestination) {
      const stream = getMediaStreamFromTrack(pub.track);
      if (stream) {
        try {
          const source = recordingAudioContext.createMediaStreamSource(stream);
          source.connect(recordingDestination);
          console.log('[Call] ✅ Local audio added to recording (late publish)');
        } catch (e) { /* ignore duplicate */ }
      }
    }
  });

  room.on(RoomEvent.Disconnected, (reason?: any) => {
    console.log('[Call] Disconnected, reason:', reason);
    // Only auto-end if we were in an active call (not if connection failed during setup)
    if (currentState.status === 'active' || currentState.status === 'ending') {
      handleCallEnd();
    } else {
      // Connection dropped during setup — show error instead of silently closing
      setState({ status: 'error', error: '연결이 끊어졌습니다. 다시 시도해주세요.' });
      currentRoom = null;
    }
  });

  room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
    console.log('[Call] Remote participant connected:', participant.name || participant.identity);
    stopRingbackTone();
    const updated = [...currentState.remoteParticipants, {
      identity: participant.identity,
      name: participant.name || participant.identity,
      videoTrack: null, screenTrack: null,
    }];
    setState({
      remoteParticipantName: updated.map(p => p.name).join(', '),
      remoteParticipants: updated,
    });
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
    const updated = currentState.remoteParticipants.filter(p => p.identity !== participant.identity);
    setState({
      remoteParticipantName: updated.length > 0 ? updated.map(p => p.name).join(', ') : null,
      remoteParticipants: updated,
    });
    // Auto-end call when all remote participants have left
    if (updated.length === 0 && currentState.status === 'active') {
      console.log('[Call] All remote participants left — auto-ending call');
      endCall();
    }
  });

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Video) {
      const isScreenShare = pub.source === Track.Source.ScreenShare;
      console.log(`[Call] ✅ Remote ${isScreenShare ? 'screen share' : 'video'} track subscribed from`, participant.identity);
      if (isScreenShare) {
        const updated = currentState.remoteParticipants.map(p =>
          p.identity === participant.identity ? { ...p, screenTrack: track } : p
        );
        setState({ remoteScreenTrack: track, remoteParticipants: updated });
      } else {
        const updated = currentState.remoteParticipants.map(p =>
          p.identity === participant.identity ? { ...p, videoTrack: track } : p
        );
        setState({ remoteVideoTrack: track, remoteParticipants: updated });
      }
    }
    if (track.kind === Track.Kind.Audio) {
      // Always attach audio element first (ensures playback on all platforms)
      const element = track.attach();
      element.dataset.livekitAudio = participant.identity;
      element.volume = currentState.isSpeakerOn ? 1.0 : 0.15;
      document.body.appendChild(element);
      console.log('[Call] ✅ Audio element attached, volume:', element.volume);

      // Try Web Audio API on top for finer volume control (mobile)
      try {
        if (!audioOutputContext) {
          audioOutputContext = new AudioContext();
          audioOutputGain = audioOutputContext.createGain();
          audioOutputGain.gain.value = currentState.isSpeakerOn ? 1.0 : 0.12;
          audioOutputGain.connect(audioOutputContext.destination);
        }
        if (audioOutputContext.state === 'suspended') {
          audioOutputContext.resume();
        }
        const source = audioOutputContext.createMediaElementSource(element);
        source.connect(audioOutputGain!);
        console.log('[Call] ✅ Web Audio API gain connected:', audioOutputGain!.gain.value);
      } catch (err) {
        console.warn('[Call] Web Audio API not available, using element volume:', err);
      }

      // Add to mixed recording
      addRemoteTrackToRecording(track);
    }
  });

  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Video) {
      const isScreenShare = pub.source === Track.Source.ScreenShare;
      if (isScreenShare) {
        const updated = currentState.remoteParticipants.map(p =>
          p.identity === participant.identity ? { ...p, screenTrack: null } : p
        );
        setState({ remoteScreenTrack: updated.find(p => p.screenTrack)?.screenTrack || null, remoteParticipants: updated });
      } else {
        const updated = currentState.remoteParticipants.map(p =>
          p.identity === participant.identity ? { ...p, videoTrack: null } : p
        );
        const anyVideo = updated.some(p => p.videoTrack !== null);
        setState({ remoteVideoTrack: anyVideo ? updated.find(p => p.videoTrack)?.videoTrack || null : null, remoteParticipants: updated });
      }
    }
    track.detach().forEach(el => el.remove());
  });

  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    if (state === ConnectionState.Reconnecting) {
      console.warn('[Call] Reconnecting...');
    }
  });

  // Connect first, then start recording (so we can mix remote audio)
  try {
    console.log('[Call] Connecting to', wsUrl);
    // 15s timeout for WebSocket connection (mobile can be slow)
    await Promise.race([
      room.connect(wsUrl, token),
      new Promise((_, reject) => setTimeout(() => reject(new Error('연결 시간 초과')), 15000)),
    ]);
    console.log('[Call] Connected successfully');
    setState({ status: 'active' });
    startDurationTimer();

    // Enable microphone (non-blocking — don't let this delay anything)
    room.localParticipant.setMicrophoneEnabled(true)
      .then(() => console.log('[Call] Microphone enabled'))
      .catch((err: any) => console.warn('[Call] Mic enable failed:', err));
  } catch (err: any) {
    console.error('[Call] Connection failed:', err);
    try { room.disconnect(); } catch { /* ignore */ }
    setState({ status: 'error', error: `연결 실패: ${err.message}` });
    return;
  }

  // ── Enumerate participants already in the room ──
  // ParticipantConnected only fires for NEW joins after connect().
  // Anyone already in the room must be added manually.
  const existingRemote: typeof currentState.remoteParticipants = [];
  room.remoteParticipants.forEach((participant) => {
    const entry: (typeof existingRemote)[0] = {
      identity: participant.identity,
      name: participant.name || participant.identity,
      videoTrack: null, screenTrack: null,
    };
    // Check for existing video tracks
    participant.videoTrackPublications.forEach((pub) => {
      if (pub.track) {
        entry.videoTrack = pub.track as any;
      }
    });
    // Attach existing audio tracks
    participant.audioTrackPublications.forEach((pub) => {
      if (pub.track) {
        const element = pub.track.attach();
        (element as any).dataset.livekitAudio = participant.identity;
        element.volume = currentState.isSpeakerOn ? 1.0 : 0.15;
        document.body.appendChild(element);
      }
    });
    existingRemote.push(entry);
  });
  if (existingRemote.length > 0) {
    console.log('[Call] Found existing participants:', existingRemote.map(p => p.name).join(', '));
    stopRingbackTone();
    setState({
      remoteParticipantName: existingRemote.map(p => p.name).join(', '),
      remoteParticipants: existingRemote,
    });
  }

  // Enable camera if video call
  if (currentState.isVideoCall) {
    try {
      await room.localParticipant.setCameraEnabled(true);
      setState({ isCameraOn: true });
      console.log('[Call] Camera enabled');
    } catch (err: any) {
      console.warn('[Call] Camera enable failed:', err);
    }
  }

  currentRoom = room;

  // Start mixed recording AFTER connection (captures both local + remote audio)
  startMixedRecording(room);
}

// ─── Client-side Recording (MVP) ─────────────────────

let recordingAudioContext: AudioContext | null = null;
let recordingDestination: MediaStreamAudioDestinationNode | null = null;

// ─── Mixed recording: local mic + remote audio ──────
function startMixedRecording(room: Room): void {
  console.log('[Call] startMixedRecording() called, current mediaRecorder:', mediaRecorder?.state ?? 'null');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('[Call] Recording already active, skipping');
    return;
  }

  try {
    recordingAudioContext = new AudioContext();
    recordingDestination = recordingAudioContext.createMediaStreamDestination();

    // Add local mic audio
    const localPubs = Array.from(room.localParticipant.audioTrackPublications.values()) as any[];
    const localPub = localPubs.find((p: any) => p.track);
    if (localPub?.track) {
      const localStream = getMediaStreamFromTrack(localPub.track);
      if (localStream) {
        const source = recordingAudioContext.createMediaStreamSource(localStream);
        source.connect(recordingDestination);
        console.log('[Call] ✅ Local audio connected to recording');
      }
    }

    // Add existing remote audio tracks
    room.remoteParticipants.forEach(participant => {
      participant.audioTrackPublications.forEach(pub => {
        const stream = getMediaStreamFromTrack((pub as any).track);
        if (stream) {
          try {
            const source = recordingAudioContext!.createMediaStreamSource(stream);
            source.connect(recordingDestination!);
            console.log('[Call] ✅ Remote audio connected to recording:', participant.identity);
          } catch (e) {
            console.warn('[Call] Remote audio source failed:', e);
          }
        }
      });
    });

    // Start MediaRecorder on mixed stream
    audioChunks = [];
    mediaRecorder = new MediaRecorder(recordingDestination.stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start(1000);
    callStartTime = Date.now();
    console.log('[Call] ✅ Mixed MediaRecorder started');
  } catch (err) {
    console.error('[Call] Mixed recording setup failed, falling back to mic-only:', err);
    startMicRecording();
  }
}

// Add a new remote audio track to the ongoing recording mix
function addRemoteTrackToRecording(track: RemoteTrack): void {
  if (!recordingAudioContext || !recordingDestination) return;
  const stream = getMediaStreamFromTrack(track);
  if (stream) {
    try {
      const source = recordingAudioContext.createMediaStreamSource(stream);
      source.connect(recordingDestination);
      console.log('[Call] ✅ Late remote audio track added to recording');
    } catch (e) {
      console.warn('[Call] Failed to add late remote track:', e);
    }
  }
}

// ─── Fallback: mic-only recording ──────
async function startMicRecording(): Promise<void> {
  console.log('[Call] startMicRecording() called, current mediaRecorder:', mediaRecorder?.state ?? 'null');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('[Call] Recording already active, skipping');
    return;
  }
  try {
    console.log('[Call] Requesting getUserMedia({audio:true})...');
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('[Call] ✅ Got mic stream for recording');
    audioChunks = [];
    mediaRecorder = new MediaRecorder(micStream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start(1000);
    callStartTime = Date.now();
    console.log('[Call] ✅ MediaRecorder started, state:', mediaRecorder.state);
  } catch (err) {
    console.error('[Call] ❌ Mic recording setup failed:', err);
  }
}

function getMediaStreamFromTrack(track: any): MediaStream | null {
  // LiveKit v2: track.mediaStream may not exist; use track.mediaStreamTrack instead
  if (track?.mediaStream) return track.mediaStream;
  if (track?.mediaStreamTrack) {
    const stream = new MediaStream([track.mediaStreamTrack]);
    return stream;
  }
  return null;
}

async function startRecording(room: Room) {
  try {
    // Get local audio stream for recording
    const pubs = Array.from(room.localParticipant.audioTrackPublications.values());
    console.log('[Call] Audio publications:', pubs.length, pubs.map((p: any) => ({
      trackSid: p.trackSid,
      hasTrack: !!p.track,
      kind: p.track?.kind,
      hasMediaStream: !!p.track?.mediaStream,
      hasMediaStreamTrack: !!p.track?.mediaStreamTrack,
    })));

    const localPub = pubs.find((p: any) => p.track);
    let localStream = localPub ? getMediaStreamFromTrack((localPub as any).track) : null;

    // Fallback: try to get mic stream directly from browser
    if (!localStream) {
      console.warn('[Call] No LiveKit audio track, trying getUserMedia fallback');
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[Call] Got fallback mic stream');
      } catch (err) {
        console.warn('[Call] getUserMedia fallback failed:', err);
        return;
      }
    }

    if (!localStream) {
      console.warn('[Call] No audio stream available for recording');
      return;
    }

    console.log('[Call] Starting recording with audio track');

    // Create AudioContext to mix local + remote audio
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    // Add local audio
    const localSource = audioContext.createMediaStreamSource(localStream);
    localSource.connect(destination);

    // Add remote audio tracks
    room.remoteParticipants.forEach(participant => {
      participant.audioTrackPublications.forEach(pub => {
        const stream = getMediaStreamFromTrack((pub as any).track);
        if (stream) {
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(destination);
        }
      });
    });

    // Listen for new remote tracks
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        const stream = getMediaStreamFromTrack(track);
        if (stream) {
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(destination);
        }
      }
    });

    // Start MediaRecorder
    audioChunks = [];
    mediaRecorder = new MediaRecorder(destination.stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.start(1000); // Chunk every 1s
    callStartTime = Date.now();

  } catch (err) {
    console.error('[Call] Recording setup failed:', err);
  }
}

// ─── Call Controls ───────────────────────────────────

export function toggleMute(): boolean {
  if (!currentRoom) return false;
  const newMuted = !currentState.isMuted;
  currentRoom.localParticipant.setMicrophoneEnabled(!newMuted);
  setState({ isMuted: newMuted });
  return newMuted;
}

export async function toggleCamera(): Promise<boolean> {
  if (!currentRoom) {
    console.warn('[Call] toggleCamera: no active room');
    return false;
  }
  const newCameraOn = !currentState.isCameraOn;
  try {
    // On mobile, ensure camera permission is available
    if (newCameraOn) {
      try {
        // Pre-check camera access (triggers OS permission dialog on Android)
        const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        testStream.getTracks().forEach(t => t.stop());
      } catch (permErr: any) {
        console.error('[Call] Camera permission denied:', permErr);
        return false;
      }
    }
    await currentRoom.localParticipant.setCameraEnabled(newCameraOn);
    setState({ isCameraOn: newCameraOn, isVideoCall: newCameraOn || currentState.isVideoCall });
    console.log('[Call] Camera toggled:', newCameraOn);
  } catch (err: any) {
    console.error('[Call] Camera toggle failed:', err);
    setState({ isCameraOn: false });
  }
  return currentState.isCameraOn;
}

export async function toggleScreenShare(): Promise<boolean> {
  if (!currentRoom) return false;
  const newSharing = !currentState.isScreenSharing;
  try {
    await currentRoom.localParticipant.setScreenShareEnabled(newSharing);
    setState({ isScreenSharing: newSharing });
    console.log('[Call] Screen share toggled:', newSharing);
  } catch (err: any) {
    // User cancelled the screen share picker
    console.warn('[Call] Screen share toggle failed:', err);
    setState({ isScreenSharing: false });
  }
  return currentState.isScreenSharing;
}

export function toggleSpeaker(): boolean {
  const newSpeakerOn = !currentState.isSpeakerOn;
  const targetVolume = newSpeakerOn ? 1.0 : 0.1;

  console.log('[Call] 🔊 Speaker toggle:', newSpeakerOn ? 'SPEAKER' : 'EARPIECE', 'target gain:', targetVolume);

  // Web Audio API gain control
  if (audioOutputGain && audioOutputContext) {
    if (audioOutputContext.state === 'suspended') {
      audioOutputContext.resume();
    }
    // Immediate change + smooth ramp
    audioOutputGain.gain.cancelScheduledValues(audioOutputContext.currentTime);
    audioOutputGain.gain.setValueAtTime(audioOutputGain.gain.value, audioOutputContext.currentTime);
    audioOutputGain.gain.linearRampToValueAtTime(targetVolume, audioOutputContext.currentTime + 0.1);
    console.log('[Call] GainNode updated:', audioOutputGain.gain.value, '→', targetVolume);
  } else {
    console.warn('[Call] No audioOutputGain available');
  }

  // Fallback: direct element volume
  document.querySelectorAll('[data-livekit-audio]').forEach(el => {
    (el as HTMLAudioElement).volume = targetVolume;
  });

  setState({ isSpeakerOn: newSpeakerOn });
  return newSpeakerOn;
}

// ─── End Call ────────────────────────────────────────

let endCallInProgress = false;
export async function endCall(): Promise<void> {
  console.log('[Call] endCall() called, current status:', currentState.status, 'mediaRecorder:', mediaRecorder?.state ?? 'null', 'inProgress:', endCallInProgress);
  if (endCallInProgress) {
    console.log('[Call] endCall already in progress, skipping duplicate');
    return;
  }
  endCallInProgress = true;

  // Capture live transcript text before stopping
  const liveTranscriptText = getTranscriptText();

  // Immediately disconnect and reset UI
  stopRingbackTone();
  stopLiveTranscript();
  clearTranscript();

  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }

  // Save room info before resetting
  const roomInfo = currentState.room;

  // Stop recording BEFORE disconnect (tracks get detached on disconnect)
  let audioBase64: string | null = null;
  console.log('[Call] Recording state check:', {
    hasMediaRecorder: !!mediaRecorder,
    state: mediaRecorder?.state ?? 'null',
    chunks: audioChunks.length,
    chunksSize: audioChunks.reduce((sum, c) => sum + c.size, 0),
  });

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      audioBase64 = await Promise.race([
        stopAndCollectRecording(),
        new Promise<null>(resolve => setTimeout(() => {
          console.warn('[Call] ⚠️ Recording collection TIMED OUT after 8s');
          resolve(null);
        }, 8000)), // 8s timeout (was 3s — too aggressive for large recordings)
      ]);
      console.log('[Call] Recording collected:', audioBase64 ? `${Math.round(audioBase64.length / 1024)}KB base64 (${audioChunks.length} chunks)` : 'null (timeout or empty)');
    } catch (err) {
      console.warn('[Call] Recording collection failed:', err);
    }
  } else if (mediaRecorder && mediaRecorder.state === 'inactive' && audioChunks.length > 0) {
    // MediaRecorder already stopped (e.g. track ended) but we have chunks — collect them
    console.log('[Call] MediaRecorder inactive but has', audioChunks.length, 'chunks, collecting...');
    try {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      if (blob.size > 0 && blob.size < 5 * 1024 * 1024) {
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        audioBase64 = btoa(binary);
        console.log('[Call] Collected from inactive recorder:', Math.round(audioBase64.length / 1024), 'KB');
      }
    } catch (err) {
      console.warn('[Call] Inactive chunk collection failed:', err);
    }
  } else {
    console.warn('[Call] No active mediaRecorder at endCall. state:', mediaRecorder?.state ?? 'null', 'chunks:', audioChunks.length);
  }

  // Disconnect from LiveKit
  const roomRef = currentRoom;
  currentRoom = null;
  if (roomRef) {
    try { roomRef.disconnect(); } catch { /* ignore */ }
  }

  // Clean up audio
  document.querySelectorAll('[data-livekit-audio]').forEach(el => el.remove());
  if (audioOutputContext) {
    try { audioOutputContext.close(); } catch { /* ignore */ }
    audioOutputContext = null;
    audioOutputGain = null;
  }

  // Reset state immediately so UI closes
  mediaRecorder = null;
  audioChunks = [];
  callStartTime = null;
  if (recordingAudioContext) {
    try { recordingAudioContext.close(); } catch { /* ignore */ }
    recordingAudioContext = null;
    recordingDestination = null;
  }

  setState({
    status: 'idle',
    room: null,
    token: null,
    wsUrl: null,
    durationSeconds: 0,
    isMuted: false,
    isSpeakerOn: true,
    isCameraOn: false,
    isVideoCall: false,
    isScreenSharing: false,
    remoteParticipantName: null,
    remoteParticipants: [],
    remoteVideoTrack: null,
    remoteScreenTrack: null,
    localVideoTrack: null,
    targetUserIds: [],
    callProjectId: null,
    error: null,
  });

  // Keep endCallInProgress=true for 3s to block delayed duplicate calls
  // (e.g. Disconnected event fires after ParticipantDisconnected auto-end)
  setTimeout(() => { endCallInProgress = false; }, 3000);
  console.log('[Call] UI reset to idle');

  // Send end signal to backend (non-blocking, after UI reset)
  if (roomInfo) {
    console.log('[Call] Sending end signal to backend. roomId:', roomInfo.id, 'hasAudio:', !!audioBase64, 'audioSize:', audioBase64 ? Math.round(audioBase64.length / 1024) + 'KB' : '0', 'hasLiveTranscript:', !!liveTranscriptText);
    try {
      supabase.functions.invoke('call-room-end', {
        body: {
          roomId: roomInfo.id,
          audioBlob: audioBase64,
          liveTranscript: liveTranscriptText || null,
        },
      }).then((resp) => {
        console.log('[Call] End signal sent to backend:', JSON.stringify(resp.data));
        if (resp.error) console.error('[Call] Backend error:', resp.error);
      }).catch(err => {
        console.error('[Call] End call API failed:', err);
      });
    } catch { /* ignore */ }
  }
}

async function stopAndCollectRecording(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      console.log('[Call] stopAndCollect: recorder inactive/null, trying chunks directly');
      // Even if inactive, try to collect existing chunks
      if (audioChunks.length > 0) {
        try {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          if (blob.size > 0 && blob.size < 5 * 1024 * 1024) {
            blob.arrayBuffer().then(buffer => {
              const bytes = new Uint8Array(buffer);
              let binary = '';
              for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              resolve(btoa(binary));
            }).catch(() => resolve(null));
            return;
          }
        } catch { /* fall through */ }
      }
      resolve(null);
      return;
    }

    console.log('[Call] stopAndCollect: stopping recorder, state:', mediaRecorder.state, 'chunks:', audioChunks.length);

    mediaRecorder.onstop = async () => {
      console.log('[Call] stopAndCollect: onstop fired, chunks:', audioChunks.length);
      try {
        if (audioChunks.length > 0) {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          console.log('[Call] stopAndCollect: blob size:', blob.size);
          // Only encode if under 5MB to avoid blocking
          if (blob.size < 5 * 1024 * 1024) {
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const result = btoa(binary);
            console.log('[Call] stopAndCollect: base64 size:', Math.round(result.length / 1024), 'KB');
            resolve(result);
          } else {
            console.warn('[Call] Recording too large for base64:', blob.size);
            resolve(null);
          }
        } else {
          console.warn('[Call] stopAndCollect: no chunks collected');
          resolve(null);
        }
      } catch (err) {
        console.error('[Call] stopAndCollect error:', err);
        resolve(null);
      }
    };

    mediaRecorder.stop();
  });
}

// handleCallEnd is now only called by Disconnected event during active call
async function handleCallEnd(): Promise<void> {
  await endCall();
}

// ─── Duration Timer ──────────────────────────────────

function startDurationTimer() {
  callStartTime = Date.now();
  durationTimer = setInterval(() => {
    if (callStartTime) {
      setState({ durationSeconds: Math.round((Date.now() - callStartTime) / 1000) });
    }
  }, 1000);
}

// ─── Suggestions ─────────────────────────────────────

export async function getCallSuggestions(roomId: string): Promise<CallSuggestion[]> {
  const { data, error } = await supabase
    .from('call_suggestions')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map(s => ({
    id: s.id,
    suggestionType: s.suggestion_type,
    title: s.title,
    description: s.description,
    eventStart: s.event_start,
    eventEnd: s.event_end,
    todoAssigneeId: s.todo_assignee_id,
    todoDueDate: s.todo_due_date,
    todoPriority: s.todo_priority,
    noteCategory: s.note_category,
    status: s.status,
    confidence: s.confidence,
    sourceQuote: s.source_quote,
    projectId: s.project_id,
  }));
}

export async function acceptSuggestion(suggestionId: string): Promise<void> {
  const { data: suggestion } = await supabase
    .from('call_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .single();

  if (!suggestion) throw new Error('Suggestion not found');

  // Create the actual item based on type
  let createdItemId: string | null = null;
  let createdItemType: string | null = null;

  if (suggestion.suggestion_type === 'event') {
    // Create calendar event
    const { data: event } = await supabase
      .from('events')
      .insert({
        title: suggestion.title,
        description: suggestion.description,
        start_time: suggestion.event_start,
        end_time: suggestion.event_end,
        user_id: suggestion.user_id,
        project_id: suggestion.project_id,
        source: 'call_suggestion',
      })
      .select()
      .single();
    createdItemId = event?.id;
    createdItemType = 'event';

  } else if (suggestion.suggestion_type === 'todo') {
    // Create todo
    const { data: todo } = await supabase
      .from('todos')
      .insert({
        title: suggestion.title,
        description: suggestion.description,
        assignee_id: suggestion.todo_assignee_id,
        due_date: suggestion.todo_due_date,
        priority: suggestion.todo_priority || 'MEDIUM',
        user_id: suggestion.user_id,
        project_id: suggestion.project_id,
        source: 'call_suggestion',
      })
      .select()
      .single();
    createdItemId = todo?.id;
    createdItemType = 'todo';

  } else if (suggestion.suggestion_type === 'note') {
    // Create important note
    const { data: note } = await supabase
      .from('important_notes')
      .insert({
        content: `${suggestion.title}\n\n${suggestion.description || ''}`,
        category: suggestion.note_category || 'decision',
        user_id: suggestion.user_id,
        project_id: suggestion.project_id,
        source: 'call_suggestion',
        source_quote: suggestion.source_quote,
      })
      .select()
      .single();
    createdItemId = note?.id;
    createdItemType = 'note';
  }

  // Update suggestion status
  await supabase
    .from('call_suggestions')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      created_item_id: createdItemId,
      created_item_type: createdItemType,
    })
    .eq('id', suggestionId);
}

export async function rejectSuggestion(suggestionId: string): Promise<void> {
  await supabase
    .from('call_suggestions')
    .update({ status: 'rejected' })
    .eq('id', suggestionId);
}

export async function acceptAllSuggestions(roomId: string): Promise<void> {
  const suggestions = await getCallSuggestions(roomId);
  const pending = suggestions.filter(s => s.status === 'pending');
  for (const s of pending) {
    await acceptSuggestion(s.id);
  }
}

// ─── Live Transcript (STT) ───────────────────────────

let speechRecognition: any = null;
const transcriptListeners = new Set<(lines: TranscriptLine[]) => void>();
let transcriptLines: TranscriptLine[] = [];

export interface TranscriptLine {
  id: number;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

let transcriptIdCounter = 0;

export function subscribeTranscript(fn: (lines: TranscriptLine[]) => void): () => void {
  transcriptListeners.add(fn);
  fn(transcriptLines);
  return () => transcriptListeners.delete(fn);
}

function notifyTranscript() {
  transcriptListeners.forEach(fn => fn([...transcriptLines]));
}

export function startLiveTranscript(lang: string = 'ko-KR'): boolean {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('[STT] SpeechRecognition not supported');
    return false;
  }

  if (speechRecognition) {
    console.log('[STT] Already running');
    return true;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;
  recognition.maxAlternatives = 1;

  let interimLineId: number | null = null;

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript.trim();
      if (!text) continue;

      if (result.isFinal) {
        // Remove interim line if exists
        if (interimLineId !== null) {
          transcriptLines = transcriptLines.filter(l => l.id !== interimLineId);
          interimLineId = null;
        }
        const id = ++transcriptIdCounter;
        transcriptLines.push({ id, text, isFinal: true, timestamp: Date.now() });
        // Keep last 50 lines
        if (transcriptLines.length > 50) transcriptLines = transcriptLines.slice(-50);
      } else {
        // Update or create interim line
        if (interimLineId !== null) {
          transcriptLines = transcriptLines.map(l => l.id === interimLineId ? { ...l, text } : l);
        } else {
          interimLineId = ++transcriptIdCounter;
          transcriptLines.push({ id: interimLineId, text, isFinal: false, timestamp: Date.now() });
        }
      }
    }
    notifyTranscript();
  };

  recognition.onerror = (event: any) => {
    console.warn('[STT] Error:', event.error);
    // Auto-restart on non-fatal errors
    if (event.error === 'no-speech' || event.error === 'aborted') {
      try { recognition.start(); } catch { /* ignore */ }
    }
  };

  recognition.onend = () => {
    // Auto-restart if still in a call
    if (speechRecognition === recognition && currentState.status === 'active') {
      console.log('[STT] Restarting...');
      try { recognition.start(); } catch { /* ignore */ }
    }
  };

  try {
    recognition.start();
    speechRecognition = recognition;
    console.log('[STT] Started, lang:', lang);
    return true;
  } catch (err) {
    console.error('[STT] Start failed:', err);
    return false;
  }
}

export function stopLiveTranscript() {
  if (speechRecognition) {
    try { speechRecognition.stop(); } catch { /* ignore */ }
    speechRecognition = null;
    console.log('[STT] Stopped');
  }
}

export function clearTranscript() {
  transcriptLines = [];
  notifyTranscript();
}

export function getTranscriptText(): string {
  return transcriptLines.filter(l => l.isFinal).map(l => l.text).join('\n');
}

// ─── Format Duration ─────────────────────────────────

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
