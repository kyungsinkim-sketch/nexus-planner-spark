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

const listeners = new Set<(state: CallState) => void>();
let currentState: CallState = {
  status: 'idle',
  room: null,
  wsUrl: null,
  token: null,
  durationSeconds: 0,
  error: null,
  isMuted: false,
  isSpeakerOn: true,
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
    handleCallEnd();
  });

  room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
    setState({ remoteParticipantName: participant.name || participant.identity });
  });

  room.on(RoomEvent.ParticipantDisconnected, () => {
    setState({ remoteParticipantName: null });
  });

  room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Audio) {
      const element = track.attach();
      document.body.appendChild(element);
      element.dataset.livekitAudio = participant.identity;
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
  // For mobile: would switch audio output
  // For web: toggle remote audio elements
  const newState = !currentState.isSpeakerOn;
  document.querySelectorAll('[data-livekit-audio]').forEach(el => {
    (el as HTMLAudioElement).muted = !newState;
  });
  setState({ isSpeakerOn: newState });
  return newState;
}

// ─── End Call ────────────────────────────────────────

export async function endCall(): Promise<void> {
  setState({ status: 'ending' });
  await handleCallEnd();
}

async function handleCallEnd(): Promise<void> {
  // Stop timer
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }

  // Stop recording and get blob
  let audioBase64: string | null = null;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    await new Promise<void>(resolve => {
      mediaRecorder!.onstop = () => resolve();
      mediaRecorder!.stop();
    });

    if (audioChunks.length > 0) {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      // Convert to base64
      const buffer = await blob.arrayBuffer();
      audioBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }
  }

  // Disconnect from LiveKit
  if (currentRoom) {
    currentRoom.disconnect();
    currentRoom = null;
  }

  // Clean up audio elements
  document.querySelectorAll('[data-livekit-audio]').forEach(el => el.remove());

  // Send end signal + audio to backend
  if (currentState.room) {
    setState({ status: 'processing' });
    try {
      await supabase.functions.invoke('call-room-end', {
        body: {
          roomId: currentState.room.id,
          audioBlob: audioBase64,
        },
      });
    } catch (err) {
      console.error('[Call] End call API failed:', err);
    }
  }

  // Reset state
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
