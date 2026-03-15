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
    const trackKind = pub?.track?.kind ?? pub?.kind;
    console.log('[Call] LocalTrackPublished, kind:', trackKind, 'Track.Kind.Audio:', Track.Kind.Audio, 'readyState:', pub?.track?.mediaStreamTrack?.readyState);
  });

  room.on(RoomEvent.Disconnected, (reason?: any) => {
    console.log('[Call] Disconnected, reason:', reason, 'status:', currentState.status);
    // Only auto-end if we were in an active call (not already ended/idle)
    if (currentState.status === 'active') {
      handleCallEnd();
    } else if (currentState.status === 'connecting' || currentState.status === 'ringing') {
      // Connection dropped during setup
      setState({ status: 'error', error: '연결이 끊어졌습니다. 다시 시도해주세요.' });
      currentRoom = null;
    }
    // If idle/ending/error — ignore (already handled by endCall)
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

      // Add to existing recording mix if active
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        addRemoteTrackToRecording(track);
      }
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

    // Enable microphone then start recording with retry polling
    room.localParticipant.setMicrophoneEnabled(true)
      .then(() => console.log('[Call] Microphone enabled ✅'))
      .catch((err: any) => console.warn('[Call] Mic enable failed:', err));

    // Start recording with polling — waits for tracks to become available
    startRecordingWithRetry(room);
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
}

// ─── Client-side Recording (MVP) ─────────────────────

let recordingAudioContext: AudioContext | null = null;
let recordingDestination: MediaStreamAudioDestinationNode | null = null;

// ─── Retry-based recording start (polling for tracks) ──────
async function startRecordingWithRetry(room: Room, maxRetries: number = 10): Promise<void> {
  console.log('[Call] startRecordingWithRetry: beginning polling for audio tracks...');
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Wait before checking (give LiveKit time to publish tracks)
    await new Promise(r => setTimeout(r, 1500));

    // Check if call already ended
    if (currentState.status !== 'active') {
      console.log('[Call] Recording retry aborted — call no longer active');
      return;
    }

    // Already recording?
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('[Call] Recording already active, stopping retry');
      return;
    }

    // Collect all available audio tracks
    const tracks: MediaStreamTrack[] = [];

    // Local mic
    const localPubs = Array.from(room.localParticipant.audioTrackPublications.values()) as any[];
    for (const pub of localPubs) {
      const mst = pub?.track?.mediaStreamTrack;
      if (mst && mst.readyState === 'live') {
        tracks.push(mst);
        console.log(`[Call] Retry ${attempt}: ✅ Local audio track found`);
      }
    }

    // Remote audio
    room.remoteParticipants.forEach(participant => {
      participant.audioTrackPublications.forEach((pub: any) => {
        const mst = pub?.track?.mediaStreamTrack;
        if (mst && mst.readyState === 'live') {
          tracks.push(mst);
          console.log(`[Call] Retry ${attempt}: ✅ Remote audio track from ${participant.identity}`);
        }
      });
    });

    console.log(`[Call] Retry ${attempt}/${maxRetries}: found ${tracks.length} audio track(s)`);

    if (tracks.length > 0) {
      startRecorderFromTracks(tracks, room);
      return;
    }
  }

  // All retries failed — fallback to getUserMedia
  console.warn('[Call] All retries exhausted, falling back to getUserMedia');
  startMicRecording();
}

// ─── Start MediaRecorder from collected tracks ──────
function startRecorderFromTracks(tracks: MediaStreamTrack[], room: Room): void {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  try {
    if (tracks.length > 1) {
      // Mix multiple tracks via AudioContext
      recordingAudioContext = new AudioContext();
      if (recordingAudioContext.state === 'suspended') recordingAudioContext.resume().catch(() => {});
      recordingDestination = recordingAudioContext.createMediaStreamDestination();
      for (const t of tracks) {
        const src = recordingAudioContext.createMediaStreamSource(new MediaStream([t]));
        src.connect(recordingDestination);
      }
      audioChunks = [];
      mediaRecorder = new MediaRecorder(recordingDestination.stream, { mimeType });
    } else {
      // Single track — record directly
      audioChunks = [];
      mediaRecorder = new MediaRecorder(new MediaStream(tracks), { mimeType });
    }

    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onerror = (e) => console.error('[Call] MediaRecorder error:', e);
    mediaRecorder.start(1000);
    callStartTime = Date.now();
    console.log('[Call] ✅ Recording started with', tracks.length, 'track(s) via retry polling');
  } catch (err) {
    console.error('[Call] startRecorderFromTracks failed:', err);
    startMicRecording();
  }
}

// ─── Mixed recording: local mic + remote audio ──────
function startMixedRecording(room: Room): void {
  console.log('[Call] startMixedRecording() called, current mediaRecorder:', mediaRecorder?.state ?? 'null');
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    console.log('[Call] Recording already active, skipping');
    return;
  }

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  // Strategy 1: Use LiveKit tracks directly (no extra AudioContext)
  try {
    const tracks: MediaStreamTrack[] = [];

    // Local mic track from LiveKit
    const localPubs = Array.from(room.localParticipant.audioTrackPublications.values()) as any[];
    for (const pub of localPubs) {
      const mst = pub?.track?.mediaStreamTrack;
      if (mst && mst.readyState === 'live') {
        tracks.push(mst);
        console.log('[Call] ✅ Local audio track found');
      }
    }

    // Remote audio tracks
    room.remoteParticipants.forEach(participant => {
      participant.audioTrackPublications.forEach((pub: any) => {
        const mst = pub?.track?.mediaStreamTrack;
        if (mst && mst.readyState === 'live') {
          tracks.push(mst);
          console.log('[Call] ✅ Remote audio track found:', participant.identity);
        }
      });
    });

    if (tracks.length > 0) {
      // If multiple tracks, mix via AudioContext
      if (tracks.length > 1) {
        recordingAudioContext = new AudioContext();
        if (recordingAudioContext.state === 'suspended') recordingAudioContext.resume().catch(() => {});
        recordingDestination = recordingAudioContext.createMediaStreamDestination();
        for (const t of tracks) {
          const src = recordingAudioContext.createMediaStreamSource(new MediaStream([t]));
          src.connect(recordingDestination);
        }
        audioChunks = [];
        mediaRecorder = new MediaRecorder(recordingDestination.stream, { mimeType });
      } else {
        // Single track — record directly
        audioChunks = [];
        mediaRecorder = new MediaRecorder(new MediaStream(tracks), { mimeType });
      }

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onerror = (e) => console.error('[Call] MediaRecorder error:', e);
      mediaRecorder.start(1000);
      callStartTime = Date.now();
      console.log('[Call] ✅ Recording started with', tracks.length, 'track(s)');
      return;
    }

    console.warn('[Call] No live audio tracks found from LiveKit');
  } catch (err) {
    console.error('[Call] LiveKit track recording failed:', err);
  }

  // Strategy 2: getUserMedia fallback
  startMicRecording();
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
  console.log('[Call] startMicRecording() fallback called');
  if (mediaRecorder && mediaRecorder.state === 'recording') return;
  try {
    // Try to reuse LiveKit's mic track via getUserMedia with same constraints
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('[Call] ✅ Got mic stream via getUserMedia');
    audioChunks = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    mediaRecorder = new MediaRecorder(micStream, { mimeType });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onerror = (e) => console.error('[Call] MediaRecorder error:', e);
    mediaRecorder.start(1000);
    callStartTime = Date.now();
    console.log('[Call] ✅ Mic-only recording started');
  } catch (err) {
    console.error('[Call] ❌ All recording methods failed:', err);
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
  let audioBlob: Blob | null = null;
  console.log('[Call] Recording state check:', {
    hasMediaRecorder: !!mediaRecorder,
    state: mediaRecorder?.state ?? 'null',
    chunks: audioChunks.length,
    chunksSize: audioChunks.reduce((sum, c) => sum + c.size, 0),
  });

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      audioBlob = await Promise.race([
        stopAndCollectBlob(),
        new Promise<null>(resolve => setTimeout(() => {
          console.warn('[Call] ⚠️ Recording collection TIMED OUT after 8s');
          resolve(null);
        }, 8000)),
      ]);
      console.log('[Call] Recording collected:', audioBlob ? `${Math.round(audioBlob.size / 1024)}KB blob` : 'null (timeout or empty)');
    } catch (err) {
      console.warn('[Call] Recording collection failed:', err);
    }
  } else if (audioChunks.length > 0) {
    audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    console.log('[Call] Collected from chunks:', Math.round(audioBlob.size / 1024), 'KB');
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

  // Process call end: direct client-side upload (same as Voice Recorder)
  if (roomInfo) {
    const roomId = roomInfo.id;
    const duration = currentState.durationSeconds || Math.round((Date.now() - (callStartTime || Date.now())) / 1000);

    // 1. End room on backend (no audio — just status update)
    supabase.functions.invoke('call-room-end', {
      body: { roomId, liveTranscript: liveTranscriptText || null },
    }).then((resp) => {
      console.log('[Call] Room ended:', JSON.stringify(resp.data));
    }).catch(err => console.error('[Call] call-room-end failed:', err));

    // 2. Client-side upload + pipeline (Voice Recorder pattern)
    if (audioBlob && audioBlob.size > 0) {
      processCallRecording(roomId, audioBlob, duration, liveTranscriptText).catch(err => {
        console.error('[Call] processCallRecording failed:', err);
      });
    } else if (liveTranscriptText && liveTranscriptText.trim().length > 10) {
      console.log('[Call] No audio, using liveTranscript for analysis');
      processLiveTranscriptOnly(roomId, liveTranscriptText, duration).catch(err => {
        console.error('[Call] processLiveTranscriptOnly failed:', err);
      });
    }
  }
}

async function stopAndCollectBlob(): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      if (audioChunks.length > 0) {
        resolve(new Blob(audioChunks, { type: 'audio/webm' }));
      } else {
        resolve(null);
      }
      return;
    }

    console.log('[Call] stopAndCollect: stopping recorder, state:', mediaRecorder.state, 'chunks:', audioChunks.length);

    mediaRecorder.onstop = () => {
      console.log('[Call] stopAndCollect: onstop fired, chunks:', audioChunks.length);
      if (audioChunks.length > 0) {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log('[Call] stopAndCollect: blob size:', blob.size);
        resolve(blob);
      } else {
        resolve(null);
      }
    };

    mediaRecorder.stop();
  });
}

// ─── Client-side upload + pipeline (Voice Recorder pattern) ──────

async function processCallRecording(roomId: string, blob: Blob, duration: number, liveTranscript: string | null): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) { console.error('[Call] No user session for upload'); return; }

  console.log('[Call] 📤 Uploading recording...', Math.round(blob.size / 1024), 'KB');

  // 1. Upload to storage (same path pattern as audioService)
  const storagePath = `${userId}/call_${roomId}_${Date.now()}.webm`;
  const { error: uploadError } = await supabase.storage
    .from('voice-recordings')
    .upload(storagePath, blob, { contentType: 'audio/webm', upsert: true });

  if (uploadError) {
    console.error('[Call] ❌ Storage upload failed:', uploadError);
    // Fallback to liveTranscript
    if (liveTranscript && liveTranscript.trim().length > 10) {
      return processLiveTranscriptOnly(roomId, liveTranscript, duration);
    }
    return;
  }
  console.log('[Call] ✅ Upload success:', storagePath);

  // 2. Create voice_recordings entry (same as audioService)
  const { data: voiceRec, error: insertError } = await supabase
    .from('voice_recordings')
    .insert({
      user_id: userId,
      title: 'In-App Call',
      audio_storage_path: storagePath,
      duration_seconds: duration,
      status: 'transcribing',
      recording_type: 'online_meeting',
    })
    .select()
    .single();

  if (insertError || !voiceRec) {
    console.error('[Call] ❌ voice_recordings insert failed:', insertError);
    return;
  }
  console.log('[Call] ✅ voice_recordings created:', voiceRec.id);

  // 3. Link to call_rooms
  await supabase.from('call_rooms').update({
    voice_recording_id: voiceRec.id,
    analysis_status: 'transcribing',
  }).eq('id', roomId);

  // 4. Trigger STT (voice-transcribe) → same as Voice Recorder
  console.log('[Call] 🎙️ Starting transcription...');
  const { data: sttData, error: sttError } = await supabase.functions.invoke('voice-transcribe', {
    body: { recordingId: voiceRec.id, userId, audioStoragePath: storagePath },
  });

  if (sttError || sttData?.error) {
    console.error('[Call] ❌ STT failed:', sttError || sttData?.error);
    await supabase.from('call_rooms').update({ analysis_status: 'error' }).eq('id', roomId);
    return;
  }
  console.log('[Call] ✅ STT done, segments:', sttData?.transcript?.length || 0);

  // 5. Trigger Brain Analysis (voice-brain-analyze) → same as Voice Recorder
  console.log('[Call] 🧠 Starting brain analysis...');
  await supabase.from('call_rooms').update({ analysis_status: 'analyzing' }).eq('id', roomId);

  const { data: brainData, error: brainError } = await supabase.functions.invoke('voice-brain-analyze', {
    body: { recordingId: voiceRec.id, userId, transcript: sttData.transcript },
  });

  if (brainError || brainData?.error) {
    console.error('[Call] ❌ Brain analysis failed:', brainError || brainData?.error);
    await supabase.from('call_rooms').update({ analysis_status: 'error' }).eq('id', roomId);
    return;
  }
  console.log('[Call] ✅ Brain analysis done');

  // 6. Mark complete
  await supabase.from('call_rooms').update({
    analysis_status: 'completed',
    status: 'completed',
  }).eq('id', roomId);
}

async function processLiveTranscriptOnly(roomId: string, liveTranscript: string, duration: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;

  const transcript = liveTranscript.split('\n').filter(l => l.trim()).map((line, i) => ({
    speaker: '화자 1', text: line.trim(), startTime: i * 10, endTime: (i + 1) * 10,
  }));

  const { data: voiceRec } = await supabase.from('voice_recordings').insert({
    user_id: userId, title: 'In-App Call', duration_seconds: duration,
    status: 'analyzing', recording_type: 'online_meeting',
    transcript: JSON.stringify(transcript),
  }).select().single();

  if (!voiceRec) return;

  await supabase.from('call_rooms').update({
    voice_recording_id: voiceRec.id, analysis_status: 'analyzing',
  }).eq('id', roomId);

  const { error } = await supabase.functions.invoke('voice-brain-analyze', {
    body: { recordingId: voiceRec.id, userId, transcript },
  });

  if (error) {
    console.error('[Call] Live transcript analysis failed:', error);
    await supabase.from('call_rooms').update({ analysis_status: 'error' }).eq('id', roomId);
    return;
  }

  await supabase.from('call_rooms').update({
    analysis_status: 'completed', status: 'completed',
  }).eq('id', roomId);
  console.log('[Call] ✅ Live transcript analysis done');
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
let translationEnabled = false;

export interface TranscriptLine {
  id: number;
  text: string;
  translation?: string | null;
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

        // Auto-translate if enabled
        if (translationEnabled) {
          const lineId = id;
          const finalText = text;
          console.log('[STT] Translating final line:', lineId, finalText.slice(0, 30));
          import('@/services/translateService').then(({ translate }) => {
            translate(finalText).then(result => {
              console.log('[STT] Translation result for', lineId, ':', result?.slice(0, 30) || 'null');
              if (result) {
                const line = transcriptLines.find(l => l.id === lineId);
                if (line) {
                  line.translation = result;
                  notifyTranscript();
                }
              }
            }).catch(err => console.error('[STT] Translation error:', err));
          }).catch(err => console.error('[STT] Import error:', err));
        }
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
  } catch (err: any) {
    console.error('[STT] Start failed:', err?.message || err);
    // Retry after a short delay (mic might be temporarily locked by LiveKit)
    setTimeout(() => {
      try {
        recognition.start();
        speechRecognition = recognition;
        console.log('[STT] Started on retry, lang:', lang);
      } catch (retryErr: any) {
        console.error('[STT] Retry also failed:', retryErr?.message || retryErr);
      }
    }, 500);
    // Return true optimistically since retry may succeed
    speechRecognition = recognition;
    return true;
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

export function setTranslationEnabled(enabled: boolean) {
  translationEnabled = enabled;
  console.log('[STT] Translation:', enabled ? 'ON' : 'OFF');
  if (enabled) {
    // Translate existing final lines that don't have translations yet
    import('@/services/translateService').then(({ translate }) => {
      transcriptLines.forEach(line => {
        if (line.isFinal && !line.translation) {
          translate(line.text).then(result => {
            if (result) {
              line.translation = result;
              notifyTranscript();
            }
          });
        }
      });
    });
  }
}

export function isTranslationEnabled(): boolean {
  return translationEnabled;
}

// ─── Format Duration ─────────────────────────────────

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
