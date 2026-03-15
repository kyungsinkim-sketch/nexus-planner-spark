/**
 * VoiceRecorderWidget — 녹음 + STT Transcript + Brain AI 분석
 *
 * Flow:
 * 1. 녹음 시작 (MediaRecorder, webm/opus)
 * 2. 녹음 종료 → Supabase Storage 업로드
 * 3. voice-transcribe Edge Function 호출 (Google STT)
 * 4. voice-brain-analyze Edge Function 호출 (Claude Haiku)
 * 5. 결과 표시 (transcript + 분석 결과)
 *
 * 프로젝트 컨텍스트 내에서 사용 시 projectId 전달
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import {
  Mic, Square, Loader2, FileText, Brain, ChevronDown, ChevronUp,
  Clock, CheckCircle2, AlertCircle, ListTodo, CalendarPlus, Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface BrainAnalysis {
  summary: string;
  decisions: Array<{ text: string; confidence: number }>;
  suggestedEvents: Array<{ title: string; date: string; time: string; attendees: string[] }>;
  actionItems: Array<{ text: string; assignee: string; dueDate?: string }>;
  followups: Array<{ text: string; deadline?: string }>;
  keyQuotes: Array<{ speaker: string; text: string }>;
}

type RecordingStatus = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'analyzing' | 'done' | 'error';

interface VoiceRecorderWidgetProps {
  projectId?: string;
  projectTitle?: string;
  className?: string;
}

export function VoiceRecorderWidget({ projectId, projectTitle, className }: VoiceRecorderWidgetProps) {
  const { currentUser, projects, users } = useAppStore();
  const { language } = useTranslation();

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [analysis, setAnalysis] = useState<BrainAnalysis | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [recordingTitle, setRecordingTitle] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Format duration as mm:ss
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─── Start Recording ──────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      setErrorMessage('');
      setTranscript([]);
      setAnalysis(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(1000); // Collect chunks every 1s
      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();
      setStatus('recording');
      setDuration(0);

      // Timer
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

    } catch (err) {
      console.error('[VoiceRecorder] Mic access error:', err);
      setErrorMessage(language === 'ko' ? '마이크 접근이 거부되었습니다.' : 'Microphone access denied.');
      setStatus('error');
    }
  }, [language]);

  // ─── Stop Recording + Process ──────────────────────
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setDuration(finalDuration);

    // Stop recording and wait for final data
    return new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!;

      recorder.onstop = async () => {
        // Stop all tracks
        recorder.stream.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log(`[VoiceRecorder] Recording stopped. Size: ${(audioBlob.size / 1024).toFixed(1)} KB, Duration: ${finalDuration}s`);

        if (audioBlob.size < 1000) {
          setErrorMessage(language === 'ko' ? '녹음이 너무 짧습니다.' : 'Recording too short.');
          setStatus('error');
          resolve();
          return;
        }

        await processRecording(audioBlob, finalDuration);
        resolve();
      };

      recorder.stop();
    });
  }, [language]);

  // ─── Process: Upload → Transcribe → Analyze ────────
  const processRecording = async (audioBlob: Blob, durationSec: number) => {
    if (!isSupabaseConfigured() || !currentUser) return;

    const userId = currentUser.id;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `${userId}/${timestamp}.webm`;
    const title = recordingTitle.trim() ||
      (language === 'ko' ? `녹음 ${new Date().toLocaleString('ko-KR')}` : `Recording ${new Date().toLocaleString('en-US')}`);

    try {
      // Step 1: Upload to Storage
      setStatus('uploading');
      const { error: uploadError } = await supabase.storage
        .from('voice-recordings')
        .upload(storagePath, audioBlob, { contentType: 'audio/webm' });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // Step 2: Create DB record
      const { data: recording, error: dbError } = await supabase
        .from('voice_recordings')
        .insert({
          user_id: userId,
          project_id: projectId || null,
          title,
          audio_storage_path: storagePath,
          duration_seconds: durationSec,
          status: 'uploaded',
          recording_type: 'voice_memo',
          language: language === 'ko' ? 'ko-KR' : 'en-US',
        })
        .select()
        .single();

      if (dbError || !recording) throw new Error(`DB insert failed: ${dbError?.message}`);

      const recordingId = recording.id;

      // Step 3: Transcribe
      setStatus('transcribing');
      const { data: transcriptData, error: transcribeError } = await supabase.functions.invoke('voice-transcribe', {
        body: { userId, recordingId, audioStoragePath: storagePath },
      });

      if (transcribeError) throw new Error(`Transcription failed: ${transcribeError.message}`);

      const transcriptSegments: TranscriptSegment[] = transcriptData?.transcript || [];
      setTranscript(transcriptSegments);

      if (transcriptSegments.length === 0) {
        setStatus('done');
        return;
      }

      // Step 4: Brain AI Analysis
      setStatus('analyzing');

      // Build context
      const context: Record<string, unknown> = {};
      if (projectId) {
        const activeProjects = projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'PLANNING');
        context.projects = activeProjects.map(p => ({
          id: p.id, title: p.title, client: p.client || '', status: p.status,
        }));
      }
      if (users) {
        context.users = users.map(u => ({ id: u.id, name: u.name, role: u.role || '' }));
      }

      const { data: analysisData, error: analyzeError } = await supabase.functions.invoke('voice-brain-analyze', {
        body: {
          userId,
          recordingId,
          transcript: transcriptSegments,
          context,
        },
      });

      if (analyzeError) {
        console.error('[VoiceRecorder] Analysis error (non-fatal):', analyzeError);
        // Analysis failure is non-fatal — transcript is still saved
      }

      if (analysisData?.analysis) {
        setAnalysis(analysisData.analysis);
      }

      setStatus('done');
      setShowTranscript(true);
      setShowAnalysis(true);

    } catch (err) {
      console.error('[VoiceRecorder] Processing error:', err);
      setErrorMessage((err as Error).message);
      setStatus('error');
    }
  };

  // ─── Status labels ─────────────────────────────────
  const statusLabel = {
    idle: '',
    recording: language === 'ko' ? '녹음 중...' : 'Recording...',
    uploading: language === 'ko' ? '업로드 중...' : 'Uploading...',
    transcribing: language === 'ko' ? '음성 인식 중...' : 'Transcribing...',
    analyzing: language === 'ko' ? 'Brain AI 분석 중...' : 'Analyzing with Brain AI...',
    done: language === 'ko' ? '완료' : 'Done',
    error: language === 'ko' ? '오류' : 'Error',
  };

  const isProcessing = ['uploading', 'transcribing', 'analyzing'].includes(status);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Recording Control */}
      <div className="rounded-xl border bg-card p-4">
        {/* Title input */}
        {status === 'idle' && (
          <input
            type="text"
            value={recordingTitle}
            onChange={e => setRecordingTitle(e.target.value)}
            placeholder={language === 'ko' ? '녹음 제목 (선택)' : 'Recording title (optional)'}
            className="w-full text-sm bg-transparent border-b border-border/50 pb-2 mb-3 outline-none placeholder:text-muted-foreground/40"
          />
        )}

        {/* Record button + timer */}
        <div className="flex items-center justify-center gap-4">
          {status === 'idle' || status === 'done' || status === 'error' ? (
            <button
              onClick={startRecording}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg shadow-red-500/20 active:scale-95"
            >
              <Mic className="w-6 h-6 text-white" />
            </button>
          ) : status === 'recording' ? (
            <div className="flex items-center gap-4">
              {/* Pulsing indicator */}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-mono font-medium text-red-400">
                  {formatDuration(duration)}
                </span>
              </div>

              {/* Stop button */}
              <button
                onClick={stopRecording}
                className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-colors active:scale-95"
              >
                <Square className="w-5 h-5 text-white fill-white" />
              </button>
            </div>
          ) : (
            /* Processing states */
            <div className="flex items-center gap-3 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">{statusLabel[status]}</span>
            </div>
          )}
        </div>

        {/* Status hint */}
        {status === 'idle' && (
          <p className="text-xs text-muted-foreground/40 text-center mt-3">
            {language === 'ko'
              ? '녹음 버튼을 눌러 시작하세요. 미팅, 메모, 아이디어를 녹음하고 AI가 정리해드립니다.'
              : 'Press record to start. Record meetings, memos, ideas — AI will organize them.'}
          </p>
        )}

        {/* Error */}
        {status === 'error' && errorMessage && (
          <div className="flex items-start gap-2 mt-3 p-2 rounded-lg bg-destructive/10">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{errorMessage}</p>
          </div>
        )}

        {/* Project context badge */}
        {projectId && projectTitle && (
          <div className="flex items-center justify-center mt-3">
            <span className="text-[10px] text-muted-foreground/50 bg-muted/50 px-2 py-0.5 rounded-full">
              📁 {projectTitle}
            </span>
          </div>
        )}
      </div>

      {/* Transcript Section */}
      {transcript.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">
                {language === 'ko' ? 'Transcript' : 'Transcript'}
              </span>
              <span className="text-xs text-muted-foreground">
                ({transcript.length} {language === 'ko' ? '구간' : 'segments'})
              </span>
            </div>
            {showTranscript ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showTranscript && (
            <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
              {transcript.map((seg, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-1 w-12">
                    {seg.startTime > 0 ? formatDuration(Math.floor(seg.startTime)) : ''}
                  </span>
                  <div>
                    <span className="text-[11px] font-semibold text-primary/70">{seg.speaker}</span>
                    <p className="text-[13px] text-foreground/80 leading-relaxed">{seg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Brain AI Analysis Section */}
      {analysis && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">
                {language === 'ko' ? 'Brain AI 분석' : 'Brain AI Analysis'}
              </span>
            </div>
            {showAnalysis ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showAnalysis && (
            <div className="px-4 pb-4 space-y-4">
              {/* Summary */}
              {analysis.summary && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {language === 'ko' ? '요약' : 'Summary'}
                  </p>
                  <p className="text-[13px] text-foreground/70 leading-relaxed">{analysis.summary}</p>
                </div>
              )}

              {/* Decisions */}
              {analysis.decisions?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {language === 'ko' ? '결정사항' : 'Decisions'}
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {analysis.decisions.map((d, i) => (
                      <li key={i} className="text-[13px] text-foreground/70 flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        {d.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {analysis.actionItems?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-blue-500" />
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {language === 'ko' ? '할 일' : 'Action Items'}
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {analysis.actionItems.map((item, i) => (
                      <li key={i} className="text-[13px] text-foreground/70 flex items-start gap-1.5">
                        <span className="text-blue-500 mt-0.5">☐</span>
                        <div>
                          {item.text}
                          {item.assignee && (
                            <span className="text-[10px] text-muted-foreground ml-1.5 bg-muted/50 px-1.5 py-0.5 rounded">
                              @{item.assignee}
                            </span>
                          )}
                          {item.dueDate && (
                            <span className="text-[10px] text-amber-500 ml-1">
                              ~{item.dueDate}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Events */}
              {analysis.suggestedEvents?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CalendarPlus className="w-3.5 h-3.5 text-purple-500" />
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {language === 'ko' ? '일정 제안' : 'Suggested Events'}
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {analysis.suggestedEvents.map((evt, i) => (
                      <li key={i} className="text-[13px] text-foreground/70 flex items-start gap-1.5">
                        <span className="text-purple-500 mt-0.5">📅</span>
                        <div>
                          {evt.title}
                          <span className="text-[10px] text-muted-foreground ml-1.5">
                            {evt.date} {evt.time}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Quotes */}
              {analysis.keyQuotes?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Quote className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {language === 'ko' ? '주요 발언' : 'Key Quotes'}
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {analysis.keyQuotes.map((q, i) => (
                      <li key={i} className="text-[13px] text-foreground/70 italic border-l-2 border-amber-500/30 pl-2.5">
                        "{q.text}"
                        <span className="text-[10px] text-muted-foreground not-italic ml-1.5">— {q.speaker}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Duration */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-border/30">
                <Clock className="w-3 h-3 text-muted-foreground/40" />
                <span className="text-[10px] text-muted-foreground/40">
                  {language === 'ko' ? `녹음 시간: ${formatDuration(duration)}` : `Duration: ${formatDuration(duration)}`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default VoiceRecorderWidget;
