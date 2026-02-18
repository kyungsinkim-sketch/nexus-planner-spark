/**
 * TranscriptViewDialog — View recording transcript + Brain analysis results.
 *
 * Shows:
 * - Audio player
 * - Transcript timeline with speaker colors
 * - Brain analysis cards (summary, decisions, events, todos, quotes)
 * - Action buttons to create calendar events / todos from analysis
 */

import { useState, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import type { VoiceRecording, TranscriptSegment, VoiceBrainAnalysis } from '@/types/core';

interface TranscriptViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recording: VoiceRecording | null;
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

function TranscriptTimeline({
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
        트랜스크립트가 없습니다
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
            <span className="text-[9px] text-muted-foreground/60 shrink-0 w-10 pt-0.5 tabular-nums">
              {formatTime(seg.startTime)}
            </span>
            <div className="min-w-0">
              <span className={`text-[10px] font-medium ${SPEAKER_COLORS[colorIdx]}`}>
                {seg.speaker}
              </span>
              <p className="text-[11px] text-foreground/80">{seg.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Brain Analysis Section ──────────────────────────

function BrainAnalysisView({
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

  const sections = [
    {
      id: 'summary',
      icon: Brain,
      label: t('voiceRecorderSummary'),
      color: 'text-primary',
      content: analysis.summary ? (
        <p className="text-[11px] text-foreground/80">{analysis.summary}</p>
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
            <li key={i} className="text-[11px] text-foreground/80 flex gap-1.5">
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
            <div key={i} className="flex items-start gap-1.5 text-[11px]">
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
            <div key={i} className="flex items-start gap-1.5 text-[11px]">
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
            <div key={i} className="text-[11px] px-2 py-1.5 rounded-md bg-violet-500/5 border-l-2 border-violet-500/30">
              <p className="italic text-foreground/80">"{q.text}"</p>
              <span className="text-[9px] text-muted-foreground">
                — {q.speaker} ({formatTime(q.timestamp)})
              </span>
            </div>
          ))}
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-1">
      {sections.map(section => {
        if (!section.content && section.id !== 'summary') return null;
        const isExpanded = expandedSection === section.id;
        const Icon = section.icon;

        return (
          <div key={section.id} className="rounded-md border border-border/30">
            <button
              onClick={() => setExpandedSection(isExpanded ? null : section.id)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium hover:bg-muted/30 transition-colors"
            >
              <Icon className={`w-3 h-3 ${section.color}`} />
              <span className="flex-1 text-left">{section.label}</span>
              {section.count !== undefined && section.count > 0 && (
                <span className="text-[9px] text-muted-foreground">{section.count}</span>
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
}

// ─── Main Dialog ─────────────────────────────────────

function TranscriptViewDialog({
  open,
  onOpenChange,
  recording,
}: TranscriptViewDialogProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAddEvent = (event: VoiceBrainAnalysis['suggestedEvents'][0]) => {
    // TODO: Integrate with calendar event creation
    console.log('[TranscriptView] Add event:', event);
  };

  const handleAddTodo = (todo: VoiceBrainAnalysis['actionItems'][0]) => {
    // TODO: Integrate with todo creation
    console.log('[TranscriptView] Add todo:', todo);
  };

  if (!recording) return null;

  const isProcessing = ['uploading', 'transcribing', 'analyzing'].includes(recording.status);
  const transcript = recording.transcript || [];
  const analysis = recording.brainAnalysis;

  return (
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
          {/* Audio Player */}
          {recording.audioUrl && (
            <div className="flex items-center gap-2 rounded-md bg-muted/30 p-2">
              <button
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <audio
                ref={audioRef}
                src={recording.audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
              <div className="flex-1 text-[10px] text-muted-foreground">
                {t('voiceRecorderAudioPlayer')}
              </div>
            </div>
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
              <h4 className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('voiceRecorderTranscript')}
              </h4>
              <TranscriptTimeline segments={transcript} onSeek={handleSeek} />
            </div>
          )}

          {/* Brain Analysis */}
          {analysis && (
            <div>
              <h4 className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Brain className="w-3 h-3 text-primary" />
                {t('voiceRecorderBrainAnalysis')}
              </h4>
              <BrainAnalysisView
                analysis={analysis}
                onAddEvent={handleAddEvent}
                onAddTodo={handleAddTodo}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TranscriptViewDialog;
