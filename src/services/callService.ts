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
  remoteParticipantName: string | null;
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
  remoteParticipantName: null,
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

export async function createCall(targetUserId: string, projectId?: string, title?: string): Promise<void> {
  try {
    setState({ status: 'creating', error: null });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    console.log('[Call] Creating room for target:', targetUserId);
    const response = await supabase.functions.invoke('call-room-create', {
      body: { targetUserId, projectId, title },
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

    // Auto-connect caller
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
    setState({ status: 'active' });
    startDurationTimer();
    // Delay recording start to ensure local track is published
    setTimeout(() => startRecording(room), 1500);
  });

  room.on(RoomEvent.LocalTrackPublished, () => {
    // Retry recording if it failed on first attempt
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      startRecording(room);
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
    setState({ remoteParticipantName: participant.name || participant.identity });
  });

  room.on(RoomEvent.ParticipantDisconnected, () => {
    setState({ remoteParticipantName: null });
  });

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Audio) {
      const element = track.attach();
      element.dataset.livekitAudio = participant.identity;
      document.body.appendChild(element);

      // Route through Web Audio API for volume control (mobile-compatible)
      try {
        if (!audioOutputContext) {
          audioOutputContext = new AudioContext();
          audioOutputGain = audioOutputContext.createGain();
          audioOutputGain.gain.value = currentState.isSpeakerOn ? 1.0 : 0.12;
          audioOutputGain.connect(audioOutputContext.destination);
        }
        const source = audioOutputContext.createMediaElementSource(element);
        source.connect(audioOutputGain!);
        console.log('[Call] Audio routed through gain node, volume:', audioOutputGain!.gain.value);
      } catch (err) {
        console.warn('[Call] Web Audio routing failed, using direct playback:', err);
      }
    }
  });

  room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
    track.detach().forEach(el => el.remove());
  });

  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    if (state === ConnectionState.Reconnecting) {
      console.warn('[Call] Reconnecting...');
    }
  });

  // Connect
  try {
    console.log('[Call] Connecting to', wsUrl);
    await room.connect(wsUrl, token);
    console.log('[Call] Connected successfully');
  } catch (err: any) {
    console.error('[Call] Connection failed:', err);
    setState({ status: 'error', error: `연결 실패: ${err.message}` });
    return;
  }

  // Enable microphone
  try {
    await room.localParticipant.setMicrophoneEnabled(true);
    console.log('[Call] Microphone enabled');
  } catch (err: any) {
    console.warn('[Call] Microphone enable failed:', err);
    // Don't fail the call, just warn
  }

  currentRoom = room;
}

// ─── Client-side Recording (MVP) ─────────────────────

function startRecording(room: Room) {
  try {
    // Get local audio stream for recording
    const localTrack = room.localParticipant.audioTrackPublications.values().next().value;
    if (!localTrack?.track?.mediaStream) {
      console.warn('[Call] No local audio track for recording');
      return;
    }

    // Create AudioContext to mix local + remote audio
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    // Add local audio
    const localStream = localTrack.track.mediaStream;
    const localSource = audioContext.createMediaStreamSource(localStream);
    localSource.connect(destination);

    // Add remote audio tracks
    room.remoteParticipants.forEach(participant => {
      participant.audioTrackPublications.forEach(pub => {
        if (pub.track?.mediaStream) {
          const source = audioContext.createMediaStreamSource(pub.track.mediaStream);
          source.connect(destination);
        }
      });
    });

    // Listen for new remote tracks
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio && track.mediaStream) {
        const source = audioContext.createMediaStreamSource(track.mediaStream);
        source.connect(destination);
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

export function toggleSpeaker(): boolean {
  const newSpeakerOn = !currentState.isSpeakerOn;
  const targetVolume = newSpeakerOn ? 1.0 : 0.12;

  // Web Audio API gain control (works on mobile)
  if (audioOutputGain && audioOutputContext) {
    audioOutputGain.gain.setTargetAtTime(targetVolume, audioOutputContext.currentTime, 0.05);
    console.log('[Call] Speaker toggle:', newSpeakerOn ? 'SPEAKER' : 'EARPIECE', 'volume:', targetVolume);
  }

  // Also try direct volume as fallback
  document.querySelectorAll('[data-livekit-audio]').forEach(el => {
    const audio = el as HTMLAudioElement;
    audio.volume = targetVolume;
  });

  setState({ isSpeakerOn: newSpeakerOn });
  return newSpeakerOn;
}

// ─── End Call ────────────────────────────────────────

export async function endCall(): Promise<void> {
  console.log('[Call] endCall() called, current status:', currentState.status);

  // Immediately disconnect and reset UI
  stopRingbackTone();

  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }

  // Disconnect from LiveKit immediately
  const roomRef = currentRoom;
  currentRoom = null;
  if (roomRef) {
    try { roomRef.disconnect(); } catch {}
  }

  // Clean up audio
  document.querySelectorAll('[data-livekit-audio]').forEach(el => el.remove());
  if (audioOutputContext) {
    try { audioOutputContext.close(); } catch {}
    audioOutputContext = null;
    audioOutputGain = null;
  }

  // Save room info before resetting
  const roomInfo = currentState.room;

  // Stop recording (with timeout so it doesn't hang)
  let audioBase64: string | null = null;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      audioBase64 = await Promise.race([
        stopAndCollectRecording(),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)), // 3s timeout
      ]);
    } catch (err) {
      console.warn('[Call] Recording collection failed:', err);
    }
  }

  // Reset state immediately so UI closes
  mediaRecorder = null;
  audioChunks = [];
  callStartTime = null;

  setState({
    status: 'idle',
    room: null,
    token: null,
    wsUrl: null,
    durationSeconds: 0,
    isMuted: false,
    isSpeakerOn: true,
    remoteParticipantName: null,
    error: null,
  });

  console.log('[Call] UI reset to idle');

  // Send end signal to backend (non-blocking, after UI reset)
  if (roomInfo) {
    try {
      supabase.functions.invoke('call-room-end', {
        body: {
          roomId: roomInfo.id,
          audioBlob: audioBase64,
        },
      }).then(() => {
        console.log('[Call] End signal sent to backend');
      }).catch(err => {
        console.error('[Call] End call API failed:', err);
      });
    } catch {}
  }
}

async function stopAndCollectRecording(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = async () => {
      try {
        if (audioChunks.length > 0) {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          // Only encode if under 5MB to avoid blocking
          if (blob.size < 5 * 1024 * 1024) {
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            resolve(btoa(binary));
          } else {
            console.warn('[Call] Recording too large for base64:', blob.size);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      } catch {
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

// ─── Format Duration ─────────────────────────────────

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
