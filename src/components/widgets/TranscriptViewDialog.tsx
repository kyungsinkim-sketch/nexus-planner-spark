/**
 * TranscriptViewDialog — View recording transcript + Brain analysis results.
 *
 * Shows:
 * - Audio player
 * - Transcript timeline with speaker colors
 * - Brain analysis cards (summary, decisions, events, todos, quotes)
 * - Action buttons to create calendar events / todos from analysis
 *
 * Optimizations:
 * - React.memo on TranscriptTimeline and BrainAnalysisView
 * - Memoized sections array in BrainAnalysisView
 * - Stable callbacks with useCallback
 */

import { useState, useRef, useMemo, useCallback, useEffect, memo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

// ── Waveform Audio Player (lightweight) ──────────────
// Uses a simple progress bar with pseudo-waveform bars (no full audio decode).
// Waveform decode happens lazily after first play to avoid blocking dialog open.
const BARS = 50;
const placeholderBars = Array.from({ length: BARS }, (_, i) => {
  // Deterministic pseudo-random pattern
  const v = Math.sin(i * 0.7) * 0.3 + Math.sin(i * 1.3) * 0.2 + 0.4;
  return Math.max(0.1, Math.min(1, v));
});

const WaveformPlayer = memo(function WaveformPlayer({
  audioUrl,
  onSeekTime,
}: {
  audioUrl: string;
  onSeekTime?: (time: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<number[]>(placeholderBars);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const decodedRef = useRef(false);

  // Lazy decode: only on first play
  const decodeWaveform = useCallback(async () => {
    if (decodedRef.current || !audioUrl) return;
    decodedRef.current = true;
    try {
      const resp = await fetch(audioUrl);
      const buf = await resp.arrayBuffer();
      const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decoded = await actx.decodeAudioData(buf);
      const raw = decoded.getChannelData(0);
      const blockSize = Math.floor(raw.length / BARS);
      const peaks: number[] = [];
      for (let i = 0; i < BARS; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[i * blockSize + j]);
        peaks.push(sum / blockSize);
      }
      const max = Math.max(...peaks, 0.01);
      barsRef.current = peaks.map(p => p / max);
      actx.close();
    } catch { /* keep placeholder */ }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => { if (audio.duration && isFinite(audio.duration)) setProgress(audio.currentTime / audio.duration); };
    const onMeta = () => setDuration(isFinite(audio.duration) ? audio.duration : 0);
    const onEnd = () => { setIsPlaying(false); setProgress(1); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); } else {
      decodeWaveform(); // lazy decode on first play
      audio.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, decodeWaveform]);

  const handleBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const el = e.currentTarget;
    if (!audio || !audio.duration || !isFinite(audio.duration)) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = pct * audio.duration;
    if (!isFinite(seekTime)) return;
    audio.currentTime = seekTime;
    setProgress(pct);
    if (!isPlaying) { decodeWaveform(); audio.play().catch(() => {}); setIsPlaying(true); }
    onSeekTime?.(audio.currentTime);
  }, [isPlaying, onSeekTime, decodeWaveform]);

  const formatSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const bars = barsRef.current;

  return (
    <div className="rounded-lg bg-muted/30 p-2.5">
      <div className="flex items-center gap-2">
        <button
          onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div onClick={handleBarClick} className="flex-1 flex items-center gap-px h-10 cursor-pointer" style={{ minWidth: 0 }}>
          {bars.map((v, i) => {
            const pct = i / bars.length;
            const h = Math.max(3, v * 28);
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-colors duration-75"
                style={{
                  height: h,
                  backgroundColor: pct <= progress ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.2)',
                }}
              />
            );
          })}
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-8 text-right">
          {duration > 0 ? formatSec(duration) : '--:--'}
        </span>
      </div>
      <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
    </div>
  );
});
import {
  Brain,
  Calendar,
  CheckSquare,
  FileText,
  MessageSquare,
  Play,
  Pause,
  Quote,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { VoiceRecording, TranscriptSegment, VoiceBrainAnalysis, EmailBrainSuggestion, BrainExtractedEvent, BrainExtractedTodo } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { SuggestionReviewDialog } from './SuggestionReviewDialog';

export interface TranscriptViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recording: VoiceRecording | null;
  onRecordingUpdate?: (updated: VoiceRecording) => void;
}

// Speaker colors for differentiation
const SPEAKER_COLORS = [
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-orange-600 dark:text-orange-400',
  'text-pink-600 dark:text-pink-400',
  'text-purple-600 dark:text-purple-400',
  'text-cyan-600 dark:text-cyan-400',
];

const SPEAKER_BG_COLORS = [
  'bg-blue-500/10',
  'bg-emerald-500/10',
  'bg-orange-500/10',
  'bg-pink-500/10',
  'bg-purple-500/10',
  'bg-cyan-500/10',
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Transcript Section ──────────────────────────────

const TranscriptTimeline = memo(function TranscriptTimeline({
  segments,
  onSeek,
}: {
  segments: TranscriptSegment[];
  onSeek: (time: number) => void;
}) {
  // Build speaker → color index map
  const speakerMap = useMemo(() => {
    const map = new Map<string, number>();
    segments.forEach(s => {
      if (!map.has(s.speaker)) {
        map.set(s.speaker, map.size % SPEAKER_COLORS.length);
      }
    });
    return map;
  }, [segments]);

  if (segments.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-muted-foreground">
        <FileText className="w-5 h-5 mx-auto mb-1 opacity-50" />
        {t('noTranscript')}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[200px] overflow-auto">
      {segments.map((seg, i) => {
        const colorIdx = speakerMap.get(seg.speaker) || 0;
        return (
          <div
            key={i}
            className={`flex gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-muted/30 transition-colors ${SPEAKER_BG_COLORS[colorIdx]}`}
            onClick={() => onSeek(seg.startTime)}
          >
            <span className="text-xs font-medium text-muted-foreground/60 shrink-0 w-10 pt-0.5 tabular-nums">
              {formatTime(seg.startTime)}
            </span>
            <div className="min-w-0">
              <span className={`text-xs font-medium ${SPEAKER_COLORS[colorIdx]}`}>
                {seg.speaker}
              </span>
              <p className="text-xs text-foreground/80">{seg.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ─── Brain Analysis Section ──────────────────────────

const BrainAnalysisView = memo(function BrainAnalysisView({
  analysis,
  onAddEvent,
  onAddTodo,
}: {
  analysis: VoiceBrainAnalysis;
  onAddEvent: (event: VoiceBrainAnalysis['suggestedEvents'][0]) => void;
  onAddTodo: (todo: VoiceBrainAnalysis['actionItems'][0]) => void;
}) {
  const { t } = useTranslation();
  const [expandedSection, setExpandedSection] = useState<string | null>('summary');

  // Memoize sections array to avoid recreating JSX on every render when only expandedSection changes
  const sections = useMemo(() => [
    {
      id: 'summary',
      icon: Brain,
      label: t('voiceRecorderSummary'),
      color: 'text-primary',
      content: analysis.summary ? (
        <p className="text-xs text-foreground/80">{analysis.summary}</p>
      ) : null,
    },
    {
      id: 'decisions',
      icon: MessageSquare,
      label: t('voiceRecorderDecisions'),
      color: 'text-amber-600 dark:text-amber-400',
      count: analysis.decisions?.length || 0,
      content: analysis.decisions?.length ? (
        <ul className="space-y-1">
          {analysis.decisions.map((d, i) => (
            <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
              <span className="text-amber-500 shrink-0">•</span>
              <span>{d.content}{d.decidedBy ? ` — ${d.decidedBy}` : ''}</span>
            </li>
          ))}
        </ul>
      ) : null,
    },
    {
      id: 'events',
      icon: Calendar,
      label: t('voiceRecorderEvents'),
      color: 'text-blue-600 dark:text-blue-400',
      count: analysis.suggestedEvents?.length || 0,
      content: analysis.suggestedEvents?.length ? (
        <div className="space-y-1.5">
          {analysis.suggestedEvents.map((ev, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <Calendar className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{ev.title}</span>
                {ev.startAt && (
                  <span className="text-muted-foreground ml-1">
                    {new Date(ev.startAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <button
                onClick={() => onAddEvent(ev)}
                className="shrink-0 p-0.5 rounded hover:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                title={t('voiceRecorderAddToCalendar')}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null,
    },
    {
      id: 'actions',
      icon: CheckSquare,
      label: t('voiceRecorderActionItems'),
      color: 'text-green-600 dark:text-green-400',
      count: analysis.actionItems?.length || 0,
      content: analysis.actionItems?.length ? (
        <div className="space-y-1.5">
          {analysis.actionItems.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <CheckSquare className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{item.title}</span>
                {item.assigneeNames?.length > 0 && (
                  <span className="text-muted-foreground ml-1">({item.assigneeNames.join(', ')})</span>
                )}
              </div>
              <button
                onClick={() => onAddTodo(item)}
                className="shrink-0 p-0.5 rounded hover:bg-green-500/10 text-green-600 dark:text-green-400"
                title={t('voiceRecorderAddToTodo')}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null,
    },
    {
      id: 'quotes',
      icon: Quote,
      label: t('voiceRecorderKeyQuotes'),
      color: 'text-violet-600 dark:text-violet-400',
      count: analysis.keyQuotes?.length || 0,
      content: analysis.keyQuotes?.length ? (
        <div className="space-y-1.5">
          {analysis.keyQuotes.map((q, i) => (
            <div key={i} className="text-xs px-2 py-1.5 rounded-md bg-violet-500/5 border-l-2 border-violet-500/30">
              <p className="italic text-foreground/80">"{q.text}"</p>
              <span className="text-xs font-medium text-muted-foreground">
                — {q.speaker} ({formatTime(q.timestamp)})
              </span>
            </div>
          ))}
        </div>
      ) : null,
    },
  ], [analysis, t, onAddEvent, onAddTodo]);

  const handleToggle = useCallback((sectionId: string) => {
    setExpandedSection(prev => prev === sectionId ? null : sectionId);
  }, []);

  return (
    <div className="space-y-1">
      {sections.map(section => {
        if (!section.content && section.id !== 'summary') return null;
        const isExpanded = expandedSection === section.id;
        const Icon = section.icon;

        return (
          <div key={section.id} className="rounded-md border border-border/30">
            <button
              onClick={() => handleToggle(section.id)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium hover:bg-muted/30 transition-colors"
            >
              <Icon className={`w-3 h-3 ${section.color}`} />
              <span className="flex-1 text-left">{section.label}</span>
              {section.count !== undefined && section.count > 0 && (
                <span className="text-xs font-medium text-muted-foreground">{section.count}</span>
              )}
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {isExpanded && section.content && (
              <div className="px-2 pb-2">
                {section.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// ─── Main Dialog ─────────────────────────────────────

function TranscriptViewDialog({
  open,
  onOpenChange,
  recording,
  onRecordingUpdate,
}: TranscriptViewDialogProps) {
  const { t } = useTranslation();
  const handleSeek = useCallback((_time: number) => {
    // WaveformPlayer handles seek internally
  }, []);

  const [showSuggestionReview, setShowSuggestionReview] = useState(false);
  const [analyzingBrain, setAnalyzingBrain] = useState(false);

  // Convert VoiceBrainAnalysis → EmailBrainSuggestion for SuggestionReviewDialog
  const voiceSuggestion = useMemo((): EmailBrainSuggestion | null => {
    if (!recording?.brainAnalysis) return null;
    const a = recording.brainAnalysis;
    return {
      id: `voice_${recording.id}`,
      emailId: recording.id,
      threadId: recording.id,
      intent: 'action_required' as any,
      summary: a.summary || '',
      suggestedEvent: a.suggestedEvents?.[0] || undefined,
      suggestedTodo: a.actionItems?.[0] ? {
        title: a.actionItems[0].title,
        assigneeIds: a.actionItems[0].assigneeIds || [],
        dueDate: a.actionItems[0].dueDate || '',
        priority: a.actionItems[0].priority || 'NORMAL',
        projectId: a.actionItems[0].projectId,
      } : undefined,
      suggestedNote: [
        ...(a.decisions?.map(d => `• ${d.content}${d.decidedBy ? ` (${d.decidedBy})` : ''}`) || []),
        ...(a.keyQuotes?.map(q => `"${q.text}" — ${q.speaker}`) || []),
      ].join('\n') || a.summary || undefined,
      confidence: 0.9,
      status: 'pending',
    };
  }, [recording]);

  const { addEvent, addTodo, loadEvents, loadTodos, events, updateEvent, projects, allUsers } = useAppStore();

  const handleConfirmSuggestion = useCallback(async (
    _suggestion: EmailBrainSuggestion,
    edits: { event?: BrainExtractedEvent; todo?: BrainExtractedTodo; note?: string; includeEvent: boolean; includeTodo: boolean; includeNote: boolean },
  ) => {
    if (edits.includeEvent && edits.event) {
      const evt = edits.event as any;
      // Check if this is an update to an existing event
      if (evt.action === 'update' && evt.originalTitle) {
        const existing = events.find(e =>
          e.title?.includes(evt.originalTitle) || evt.originalTitle?.includes(e.title || '')
        );
        if (existing) {
          await updateEvent(existing.id, {
            startAt: evt.startAt || existing.startAt,
            endAt: evt.endAt || existing.endAt,
            title: evt.title || existing.title,
            location: evt.location || existing.location,
          });
          await loadEvents();
        } else {
          // Couldn't find existing event, create new
          await addEvent({
            title: evt.title, type: 'MEETING',
            startAt: evt.startAt || new Date().toISOString(),
            endAt: evt.endAt || new Date(Date.now() + 3600000).toISOString(),
            location: evt.location, projectId: evt.projectId,
            attendeeIds: evt.attendeeIds,
            ownerId: useAppStore.getState().currentUser?.id,
          });
          await loadEvents();
        }
      } else {
        await addEvent({
          title: evt.title, type: 'MEETING',
          startAt: evt.startAt || new Date().toISOString(),
          endAt: evt.endAt || new Date(Date.now() + 3600000).toISOString(),
          location: evt.location, projectId: evt.projectId,
          attendeeIds: evt.attendeeIds,
          ownerId: useAppStore.getState().currentUser?.id,
        });
        await loadEvents();
      }
    }
    if (edits.includeTodo && edits.todo) {
      await addTodo({
        title: edits.todo.title,
        assigneeIds: edits.todo.assigneeIds || [],
        dueDate: edits.todo.dueDate,
        priority: edits.todo.priority || 'NORMAL',
        projectId: edits.todo.projectId,
      });
      await loadTodos();
    }
    // Note: important_notes could be saved here too if needed
  }, [addEvent, addTodo, loadEvents, loadTodos]);

  const handleAddEvent = useCallback((event: VoiceBrainAnalysis['suggestedEvents'][0]) => {
    console.log('[TranscriptView] Add event:', event);
  }, []);

  const handleAddTodo = useCallback((todo: VoiceBrainAnalysis['actionItems'][0]) => {
    console.log('[TranscriptView] Add todo:', todo);
  }, []);

  if (!recording) return null;

  const isProcessing = ['uploading', 'transcribing', 'analyzing'].includes(recording.status);
  const transcript = recording.transcript || [];
  const analysis = recording.brainAnalysis;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-primary" />
            {recording.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {formatTime(recording.duration)} &middot; {new Date(recording.createdAt).toLocaleDateString('ko-KR')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Audio Waveform Player */}
          {recording.audioUrl && (
            <WaveformPlayer audioUrl={recording.audioUrl} onSeekTime={handleSeek} />
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 justify-center py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {recording.status === 'uploading' && t('voiceRecorderUploading')}
                {recording.status === 'transcribing' && t('voiceRecorderTranscribing')}
                {recording.status === 'analyzing' && t('voiceRecorderAnalyzing')}
              </span>
            </div>
          )}

          {/* Error state */}
          {recording.status === 'error' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{recording.errorMessage || t('voiceRecorderError')}</span>
            </div>
          )}

          {/* Transcript */}
          {transcript.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('voiceRecorderTranscript')}
              </h4>
              <TranscriptTimeline segments={transcript} onSeek={handleSeek} />
            </div>
          )}

          {/* Brain AI: trigger analysis button when no analysis yet */}
          {!analysis && !isProcessing && !analyzingBrain && transcript.length > 0 && (
            <button
              onClick={async () => {
                try {
                  setAnalyzingBrain(true);
                  const { supabase } = await import('@/lib/supabase');
                  await supabase.from('voice_recordings').update({ status: 'analyzing' }).eq('id', recording.id);
                  
                  const { data: { session } } = await supabase.auth.getSession();
                  const userId = session?.user?.id;
                  if (!userId) {
                    console.error('[TranscriptView] No auth session');
                    setAnalyzingBrain(false);
                    return;
                  }

                  // Build context with projects + users for attendee matching
                  const context = {
                    projects: projects?.map(p => ({
                      id: p.id, title: p.title, client: p.clientName || '', status: p.status,
                      teamMemberIds: p.teamMemberIds || [],
                    })) || [],
                    users: allUsers?.map(u => ({
                      id: u.id, name: u.name, department: u.department || '', role: u.role || '',
                    })) || [],
                  };
                  console.log('[TranscriptView] Starting brain analysis for', recording.id, 'with', context.users?.length, 'users');
                  const { data, error } = await supabase.functions.invoke('voice-brain-analyze', {
                    body: { recordingId: recording.id, userId, transcript, context },
                  });
                  
                  console.log('[TranscriptView] Brain response:', { data, error });

                  if (error) {
                    console.error('[TranscriptView] Brain analysis error:', error);
                    setAnalyzingBrain(false);
                    return;
                  }

                  // Reload recording from DB to get updated brain_analysis
                  const { data: updated } = await supabase
                    .from('voice_recordings')
                    .select('*')
                    .eq('id', recording.id)
                    .single();
                  if (updated) {
                    const newRecording: VoiceRecording = {
                      ...recording,
                      brainAnalysis: typeof updated.brain_analysis === 'string' 
                        ? JSON.parse(updated.brain_analysis) : updated.brain_analysis,
                      status: updated.status as VoiceRecording['status'],
                    };
                    onRecordingUpdate?.(newRecording);
                  }
                  setAnalyzingBrain(false);
                } catch (err) {
                  console.error('[TranscriptView] Brain analysis failed:', err);
                  setAnalyzingBrain(false);
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors"
            >
              <Brain className="w-4 h-4" />
              Brain AI 분석 시작
            </button>
          )}
          {analyzingBrain && (
            <div className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin" />
              Brain AI 분석 중...
            </div>
          )}

          {/* Brain Analysis — simplified: summary only + Review button */}
          {analysis && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Brain className="w-3 h-3 text-primary" />
                Meeting Summary
              </h4>
              {analysis.summary && (
                <p className="text-xs text-foreground/80 leading-relaxed mb-2">{analysis.summary}</p>
              )}
              {/* Review Brain AI Suggestions button */}
              <button
                onClick={() => {
                  console.log('[TranscriptView] Review clicked, voiceSuggestion:', voiceSuggestion);
                  console.log('[TranscriptView] brainAnalysis:', recording?.brainAnalysis);
                  setShowSuggestionReview(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Review Brain AI Suggestions
              </button>
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>

    {/* SuggestionReviewDialog — must be outside parent Dialog to avoid z-index/portal issues */}
    {voiceSuggestion && (
      <SuggestionReviewDialog
        open={showSuggestionReview}
        onOpenChange={setShowSuggestionReview}
        suggestion={voiceSuggestion}
        onConfirm={handleConfirmSuggestion}
        sourceLabel={recording?.title || 'Voice Recording'}
      />
    )}
  </>
  );
}

export default TranscriptViewDialog;
