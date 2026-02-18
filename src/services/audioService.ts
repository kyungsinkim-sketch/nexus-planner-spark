/**
 * Audio Service — Browser audio recording + Supabase upload + STT pipeline.
 *
 * Handles:
 * - Browser microphone recording (MediaRecorder API)
 * - Real-time audio analysis (AnalyserNode for waveform visualization)
 * - File upload to Supabase Storage
 * - STT transcription via Edge Function (Google Cloud STT v2)
 * - Brain analysis via Edge Function
 *
 * Mock mode: simulates recording and returns mock transcripts.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { VoiceRecording, RecordingMetadata, TranscriptSegment, VoiceBrainAnalysis } from '@/types/core';

// ─── Constants ───────────────────────────────────────

const STORAGE_BUCKET = 'voice-recordings';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_AUDIO_TYPES = [
  'audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg',
  'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
];

function isMockMode(): boolean {
  return !isSupabaseConfigured();
}

// ─── Browser Recording Manager ──────────────────────

let mediaRecorder: MediaRecorder | null = null;
let audioStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let recordedChunks: Blob[] = [];
let recordingStartTime = 0;

export async function startRecording(): Promise<void> {
  // Request microphone access
  audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 48000,
    },
  });

  // Set up audio analysis for waveform visualization
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(audioStream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;
  source.connect(analyserNode);

  // Set up MediaRecorder
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(audioStream, { mimeType });
  recordedChunks = [];

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.start(1000); // Collect data every 1 second
  recordingStartTime = Date.now();
}

export function pauseRecording(): void {
  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.pause();
  }
}

export function resumeRecording(): void {
  if (mediaRecorder?.state === 'paused') {
    mediaRecorder.resume();
  }
}

export function getRecordingState(): 'inactive' | 'recording' | 'paused' {
  return mediaRecorder?.state || 'inactive';
}

export function getRecordingDuration(): number {
  if (!recordingStartTime) return 0;
  return Math.floor((Date.now() - recordingStartTime) / 1000);
}

export function getAnalyserNode(): AnalyserNode | null {
  return analyserNode;
}

export async function stopRecording(): Promise<{ blob: Blob; duration: number }> {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve({ blob: new Blob(), duration: 0 });
      return;
    }

    const duration = getRecordingDuration();

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, {
        type: mediaRecorder?.mimeType || 'audio/webm',
      });

      // Clean up
      audioStream?.getTracks().forEach(track => track.stop());
      audioContext?.close();
      audioStream = null;
      audioContext = null;
      analyserNode = null;
      mediaRecorder = null;
      recordedChunks = [];
      recordingStartTime = 0;

      resolve({ blob, duration });
    };

    mediaRecorder.stop();
  });
}

export function cancelRecording(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  audioStream?.getTracks().forEach(track => track.stop());
  audioContext?.close();
  audioStream = null;
  audioContext = null;
  analyserNode = null;
  mediaRecorder = null;
  recordedChunks = [];
  recordingStartTime = 0;
}

// ─── Upload to Supabase Storage ─────────────────────

export async function uploadAudio(
  blob: Blob,
  userId: string,
  metadata: RecordingMetadata,
): Promise<{ storagePath: string; publicUrl: string }> {
  if (isMockMode()) {
    const mockPath = `mock/${userId}/${Date.now()}.webm`;
    return { storagePath: mockPath, publicUrl: `https://mock.storage/${mockPath}` };
  }

  if (blob.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 50MB limit');
  }

  const ext = blob.type.includes('webm') ? 'webm'
    : blob.type.includes('mp3') || blob.type.includes('mpeg') ? 'mp3'
    : blob.type.includes('wav') ? 'wav'
    : blob.type.includes('m4a') || blob.type.includes('mp4') ? 'm4a'
    : 'webm';

  const storagePath = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, {
      contentType: blob.type || 'audio/webm',
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: urlData.publicUrl,
  };
}

// ─── Transcription (STT) ────────────────────────────

export async function transcribeAudio(
  userId: string,
  recordingId: string,
  audioStoragePath: string,
): Promise<TranscriptSegment[]> {
  if (isMockMode()) {
    // Simulate processing delay
    await new Promise(r => setTimeout(r, 2000));
    return [
      { speaker: '화자 1', text: '안녕하세요, 오늘 회의를 시작하겠습니다.', startTime: 0, endTime: 3.5 },
      { speaker: '화자 2', text: '네, 오늘 안건은 프로젝트 일정 조율입니다.', startTime: 4.0, endTime: 7.5 },
      { speaker: '화자 1', text: '다음 주 수요일에 클라이언트 미팅을 잡아야 합니다.', startTime: 8.0, endTime: 12.0 },
    ];
  }

  const { data, error } = await supabase.functions.invoke('voice-transcribe', {
    body: { userId, recordingId, audioStoragePath },
  });

  if (error) {
    console.error('[Audio] Transcription error:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(`Transcription failed: ${data.error}`);
  }

  return data?.transcript || [];
}

// ─── Brain Analysis of Transcript ────────────────────

export interface BrainContext {
  projects: Array<{ id: string; title: string; client: string; status: string; teamMemberIds?: string[] }>;
  users: Array<{ id: string; name: string; department?: string; role: string }>;
}

export async function analyzeTranscript(
  userId: string,
  recordingId: string,
  transcript: TranscriptSegment[],
  context?: BrainContext,
): Promise<VoiceBrainAnalysis> {
  if (isMockMode()) {
    await new Promise(r => setTimeout(r, 1500));
    return {
      summary: '프로젝트 일정 조율을 위한 회의. 클라이언트 미팅 일정을 다음 주 수요일로 확정.',
      decisions: [
        { content: '클라이언트 미팅을 다음 주 수요일 오후 2시로 확정', decidedBy: '화자 1', confidence: 0.9 },
      ],
      suggestedEvents: [],
      actionItems: [],
      followups: [
        { content: '클라이언트에게 미팅 장소 확인', remindDate: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
      ],
      keyQuotes: [
        { speaker: '화자 1', text: '다음 주 수요일에 클라이언트 미팅을 잡아야 합니다', timestamp: 8.0 },
      ],
    };
  }

  const { data, error } = await supabase.functions.invoke('voice-brain-analyze', {
    body: { userId, recordingId, transcript, context },
  });

  if (error) {
    console.error('[Audio] Brain analysis error:', error);
    throw new Error(`Brain analysis failed: ${error.message}`);
  }

  if (data?.error) {
    throw new Error(`Brain analysis failed: ${data.error}`);
  }

  return data?.analysis;
}

// ─── Validate uploaded file ─────────────────────────

export function validateAudioFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
  }
  if (!ACCEPTED_AUDIO_TYPES.some(t => file.type.startsWith(t.split('/')[0]))) {
    return 'Unsupported audio format. Use mp3, wav, m4a, webm, or ogg.';
  }
  return null;
}

// ─── Get audio file duration from blob ──────────────

export function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      resolve(Math.ceil(audio.duration));
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(audio.src);
    };
    audio.src = URL.createObjectURL(blob);
  });
}
