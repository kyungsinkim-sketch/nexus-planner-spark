/**
 * VoiceRecorderWidget — Record audio, upload files, manage recordings.
 *
 * Three modes:
 * 1. Record — Browser microphone recording with waveform visualization
 * 2. Upload — Drag & drop or file picker for audio files
 * 3. History — List of past recordings with status and Brain results
 *
 * Optimizations:
 * - React.memo on sub-components to prevent unnecessary re-renders
 * - Reusable dataArray buffer in WaveformCanvas (avoids GC pressure)
 * - Stable callback refs to minimize re-renders
 * - Sorted recordings memoized to avoid sort on every render
 * - Lazy-loaded TranscriptViewDialog
 */

import { useState, useRef, useEffect, useCallback, useMemo, memo, lazy, Suspense } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Mic,
  MicOff,
  Square,
  Pause,
  Play,
  Upload,
  List,
  Loader2,
  FileAudio,
  Brain,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FolderOpen,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { WidgetDataContext } from '@/types/widget';
import type { VoiceRecording } from '@/types/core';
import {
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  cancelRecording,
  getAnalyserNode,
  getRecordingDuration,
  validateAudioFile,
} from '@/services/audioService';

// Lazy-load the transcript dialog — only needed when user clicks a recording
const TranscriptViewDialog = lazy(() => import('./TranscriptViewDialog'));

type TabMode = 'record' | 'upload' | 'history';

// ─── Waveform Visualizer ─────────────────────────────

const WaveformCanvas = memo(function WaveformCanvas({ isRecording }: { isRecording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  // Reuse buffer to avoid GC pressure during animation
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (!isRecording) {
      cancelAnimationFrame(animationRef.current);
      return;
    }

    const draw = () => {
      const canvas = canvasRef.current;
      const analyser = getAnalyserNode();
      if (!canvas || !analyser) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Allocate buffer once, reuse across frames
      const bufferLength = analyser.frequencyBinCount;
      if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
        dataArrayRef.current = new Uint8Array(bufferLength);
      }
      analyser.getByteTimeDomainData(dataArrayRef.current);

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArrayRef.current[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(w, h / 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    // Small delay to allow analyser to initialize
    const timer = setTimeout(() => {
      animationRef.current = requestAnimationFrame(draw);
    }, 100);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animationRef.current);
    };
  }, [isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={60}
      className="w-full h-[60px] rounded-md bg-muted/20"
    />
  );
});

// ─── Recording Timer ─────────────────────────────────

const RecordingTimer = memo(function RecordingTimer({ isRecording }: { isRecording: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      setSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setSeconds(getRecordingDuration());
    }, 500);
    return () => clearInterval(interval);
  }, [isRecording]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <span className="font-mono text-lg tabular-nums text-foreground">
      {mm}:{ss}
    </span>
  );
});

// ─── Status Icon ─────────────────────────────────────

const RecordingStatusIcon = memo(function RecordingStatusIcon({ status }: { status: VoiceRecording['status'] }) {
  switch (status) {
    case 'uploading':
    case 'transcribing':
    case 'analyzing':
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />;
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    case 'error':
      return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  }
});

const STATUS_LABELS: Record<string, string> = {
  uploading: '업로드 중',
  transcribing: '음성 인식 중',
  analyzing: 'Brain 분석 중',
  completed: '완료',
  error: '오류',
};

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Recording List Item ────────────────────────────

const RecordingListItem = memo(function RecordingListItem({
  recording,
  projectTitle,
  onSelect,
}: {
  recording: VoiceRecording;
  projectTitle: string | null;
  onSelect: (recording: VoiceRecording) => void;
}) {
  const handleClick = useCallback(() => onSelect(recording), [recording, onSelect]);

  return (
    <button
      onClick={handleClick}
      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <RecordingStatusIcon status={recording.status} />
        <span className="text-xs font-medium truncate flex-1">
          {recording.title}
        </span>
        <span className="text-[9px] text-muted-foreground shrink-0">
          {formatDuration(recording.duration)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 pl-5">
        <span className="text-[9px] text-muted-foreground/60">
          {STATUS_LABELS[recording.status] || recording.status}
        </span>
        {projectTitle && (
          <span className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <FolderOpen className="w-2 h-2" />
            {projectTitle}
          </span>
        )}
        {recording.brainAnalysis && (
          <Brain className="w-2.5 h-2.5 text-primary" />
        )}
      </div>
    </button>
  );
});

// ─── Main Widget ─────────────────────────────────────

function VoiceRecorderWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();

  // Use selector pattern to minimize re-renders — only subscribe to what we need
  const projects = useAppStore(s => s.projects);
  const currentUser = useAppStore(s => s.currentUser);
  const voiceRecordings = useAppStore(s => s.voiceRecordings);
  const startVoiceRecordingAction = useAppStore(s => s.startVoiceRecording);
  const uploadVoiceFileAction = useAppStore(s => s.uploadVoiceFile);

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'ACTIVE'),
    [projects],
  );

  // Build project lookup map once
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach(p => map.set(p.id, p.title));
    return map;
  }, [projects]);

  const [tab, setTab] = useState<TabMode>('record');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(context.projectId || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<VoiceRecording | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter and sort recordings — memoized to avoid recomputing on every render
  const sortedRecordings = useMemo(() => {
    const list = context.type === 'project' && context.projectId
      ? voiceRecordings.filter(r => r.projectId === context.projectId)
      : voiceRecordings;
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [voiceRecordings, context.type, context.projectId]);

  // ─── Record handlers ───────
  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording();
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      console.error('[VoiceRecorder] Failed to start recording:', err);
      alert(t('voiceRecorderMicError'));
    }
  }, [t]);

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      resumeRecording();
      setIsPaused(false);
    } else {
      pauseRecording();
      setIsPaused(true);
    }
  }, [isPaused]);

  const handleStopRecording = useCallback(async () => {
    setIsProcessing(true);
    try {
      const { blob } = await stopRecording();
      setIsRecording(false);
      setIsPaused(false);

      if (blob.size > 0 && currentUser) {
        await startVoiceRecordingAction(blob, {
          title: title || `녹음 ${new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
          projectId: projectId || undefined,
        });
        setTitle('');
        setTab('history');
      }
    } catch (err) {
      console.error('[VoiceRecorder] Stop recording error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [title, projectId, currentUser, startVoiceRecordingAction]);

  const handleCancelRecording = useCallback(() => {
    cancelRecording();
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  // ─── Upload handlers ───────
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files?.length || !currentUser) return;

    const file = files[0];
    const error = validateAudioFile(file);
    if (error) {
      alert(error);
      return;
    }

    setIsProcessing(true);
    try {
      await uploadVoiceFileAction(file, {
        title: title || file.name.replace(/\.[^.]+$/, ''),
        projectId: projectId || undefined,
      });
      setTitle('');
      setTab('history');
    } catch (err) {
      console.error('[VoiceRecorder] Upload error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [title, projectId, currentUser, uploadVoiceFileAction]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  const handleOpenFileInput = useCallback(() => fileInputRef.current?.click(), []);

  const handleProjectChange = useCallback((v: string) => setProjectId(v === '__none__' ? '' : v), []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value), []);

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) setSelectedRecording(null);
  }, []);

  const handleSelectRecording = useCallback((recording: VoiceRecording) => {
    setSelectedRecording(recording);
  }, []);

  // ─── Tab buttons ───────
  const tabs = useMemo<Array<{ key: TabMode; icon: typeof Mic; label: string }>>(() => [
    { key: 'record', icon: Mic, label: t('voiceRecorderRecord') },
    { key: 'upload', icon: Upload, label: t('voiceRecorderUpload') },
    { key: 'history', icon: List, label: t('voiceRecorderHistory') },
  ], [t]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border/30 shrink-0">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors ${
              tab === key
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-2.5">
        {/* ───── Record Mode ───── */}
        {tab === 'record' && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            {!isRecording ? (
              <>
                {/* Metadata inputs */}
                <div className="w-full space-y-2">
                  <Input
                    value={title}
                    onChange={handleTitleChange}
                    placeholder={t('voiceRecorderTitlePlaceholder')}
                    className="h-8 text-xs"
                  />
                  <Select value={projectId || '__none__'} onValueChange={handleProjectChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={t('brainFieldProjectNone')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('brainFieldProjectNone')}</SelectItem>
                      {activeProjects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Big record button */}
                <button
                  onClick={handleStartRecording}
                  disabled={isProcessing}
                  className="relative w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <Mic className="w-7 h-7" />
                  )}
                  <span className="absolute inset-0 rounded-full animate-ping bg-red-500/30" style={{ animationDuration: '2s' }} />
                </button>
                <span className="text-[10px] text-muted-foreground">{t('voiceRecorderTapToRecord')}</span>
              </>
            ) : (
              <>
                {/* Waveform + timer */}
                <WaveformCanvas isRecording={isRecording && !isPaused} />
                <RecordingTimer isRecording={isRecording} />

                {/* Recording controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePauseResume}
                    className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                  >
                    {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={handleStopRecording}
                    disabled={isProcessing}
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Square className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={handleCancelRecording}
                    className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                  >
                    <MicOff className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
                <span className="text-[9px] text-red-500 font-medium animate-pulse">
                  {isPaused ? t('voiceRecorderPaused') : t('voiceRecorderRecording')}
                </span>
              </>
            )}
          </div>
        )}

        {/* ───── Upload Mode ───── */}
        {tab === 'upload' && (
          <div className="flex flex-col h-full gap-3">
            {/* Metadata */}
            <div className="space-y-2">
              <Input
                value={title}
                onChange={handleTitleChange}
                placeholder={t('voiceRecorderTitlePlaceholder')}
                className="h-8 text-xs"
              />
              <Select value={projectId || '__none__'} onValueChange={handleProjectChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t('brainFieldProjectNone')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('brainFieldProjectNone')}</SelectItem>
                  {activeProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleOpenFileInput}
              className={`flex-1 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border/50 hover:border-primary/40 hover:bg-muted/20'
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : (
                <FileAudio className="w-8 h-8 text-muted-foreground/50" />
              )}
              <span className="text-xs text-muted-foreground">
                {isProcessing ? t('voiceRecorderUploading') : t('voiceRecorderDropHere')}
              </span>
              <span className="text-[9px] text-muted-foreground/50">
                mp3, wav, m4a, webm, ogg
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
        )}

        {/* ───── History Mode ───── */}
        {tab === 'history' && (
          <div className="space-y-1">
            {sortedRecordings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60 gap-1">
                <FileAudio className="w-5 h-5" />
                <span className="text-xs">{t('voiceRecorderNoRecordings')}</span>
              </div>
            ) : (
              sortedRecordings.map(recording => (
                <RecordingListItem
                  key={recording.id}
                  recording={recording}
                  projectTitle={recording.projectId ? projectMap.get(recording.projectId) || null : null}
                  onSelect={handleSelectRecording}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Transcript View Dialog — lazy-loaded */}
      {selectedRecording && (
        <Suspense fallback={null}>
          <TranscriptViewDialog
            open={!!selectedRecording}
            onOpenChange={handleDialogClose}
            recording={selectedRecording}
          />
        </Suspense>
      )}
    </div>
  );
}

export default VoiceRecorderWidget;
