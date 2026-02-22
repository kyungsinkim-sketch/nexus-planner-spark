/**
 * PersonaResponseBubble — Renders the AI persona's response message.
 *
 * Supports multiple personas with distinct themes:
 * - Pablo AI (CEO): amber/gold + Crown icon
 * - CD AI (Creative Director): blue/indigo + Palette icon
 * - PD AI (Producer): green/emerald + ClipboardList icon
 *
 * Displays:
 * - Persona avatar + name (themed)
 * - Free-form text response (whitespace preserved)
 * - RAG reference count badge
 * - Feedback buttons (thumbs up/down → confidence adjustment)
 */

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Crown,
  Palette,
  ClipboardList,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import type { ChatMessage } from '@/types/core';
import * as personaService from '@/services/personaService';

interface PersonaTheme {
  bg: string;
  border: string;
  feedbackBorder: string;
  Icon: LucideIcon;
  iconColor: string;
  nameColor: string;
  badgeColor: string;
}

function getPersonaTheme(personaId: string): PersonaTheme {
  switch (personaId) {
    case 'cd_ai':
      return {
        bg: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
        border: 'border-blue-200/50 dark:border-blue-800/50',
        feedbackBorder: 'border-blue-200/30 dark:border-blue-700/30',
        Icon: Palette,
        iconColor: 'text-blue-500',
        nameColor: 'text-blue-700 dark:text-blue-400',
        badgeColor: 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700',
      };
    case 'pd_ai':
      return {
        bg: 'from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30',
        border: 'border-green-200/50 dark:border-green-800/50',
        feedbackBorder: 'border-green-200/30 dark:border-green-700/30',
        Icon: ClipboardList,
        iconColor: 'text-green-500',
        nameColor: 'text-green-700 dark:text-green-400',
        badgeColor: 'text-green-600 dark:text-green-400 border-green-300 dark:border-green-700',
      };
    default: // pablo_ai / CEO
      return {
        bg: 'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
        border: 'border-amber-200/50 dark:border-amber-800/50',
        feedbackBorder: 'border-amber-200/30 dark:border-amber-700/30',
        Icon: Crown,
        iconColor: 'text-amber-500',
        nameColor: 'text-amber-700 dark:text-amber-400',
        badgeColor: 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700',
      };
  }
}

interface PersonaResponseBubbleProps {
  message: ChatMessage;
}

export function PersonaResponseBubble({ message }: PersonaResponseBubbleProps) {
  const personaData = message.personaResponseData;
  const [feedbackState, setFeedbackState] = useState<'none' | 'helpful' | 'unhelpful' | 'submitting'>('none');

  const theme = useMemo(
    () => getPersonaTheme(personaData?.personaId || ''),
    [personaData?.personaId],
  );

  // Fallback if personaResponseData is missing
  if (!personaData) {
    return (
      <div
        className="w-fit max-w-full rounded-2xl px-4 py-2 text-sm bg-muted text-foreground"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {message.content}
      </div>
    );
  }

  const handleFeedback = async (feedback: 'helpful' | 'unhelpful') => {
    if (!personaData.queryLogId || feedbackState !== 'none') return;
    setFeedbackState('submitting');

    try {
      await personaService.submitPersonaFeedback(personaData.queryLogId, feedback);
      setFeedbackState(feedback);
    } catch (err) {
      console.error('Failed to submit persona feedback:', err);
      setFeedbackState('none');
    }
  };

  const ragCount = personaData.ragContext?.length || 0;
  const { Icon } = theme;

  return (
    <div className="space-y-1 max-w-full overflow-hidden">
      {/* Persona response bubble */}
      <div
        className={`w-fit max-w-full rounded-2xl px-4 py-2.5 text-sm bg-gradient-to-br ${theme.bg} border ${theme.border}`}
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {/* Persona header */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className={`w-3.5 h-3.5 ${theme.iconColor} shrink-0`} />
          <span className={`text-xs font-semibold ${theme.nameColor}`}>
            {personaData.personaName || 'AI Persona'}
          </span>
          {ragCount > 0 && (
            <Badge
              variant="outline"
              className={`text-[10px] gap-0.5 ${theme.badgeColor} ml-1`}
            >
              <BookOpen className="w-2.5 h-2.5" />
              {ragCount}개 지식 참조
            </Badge>
          )}
        </div>

        {/* Response text */}
        <p className="text-foreground leading-relaxed whitespace-pre-wrap">
          {personaData.response}
        </p>

        {/* Feedback buttons */}
        {personaData.queryLogId && (
          <div className={`flex items-center gap-1.5 mt-2 pt-2 border-t ${theme.feedbackBorder}`}>
            {feedbackState === 'none' ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                  onClick={() => handleFeedback('helpful')}
                >
                  <ThumbsUp className="w-3 h-3" />
                  도움됨
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => handleFeedback('unhelpful')}
                >
                  <ThumbsDown className="w-3 h-3" />
                  부족함
                </Button>
              </>
            ) : feedbackState === 'submitting' ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                전송 중...
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {feedbackState === 'helpful' ? '감사합니다! 👍' : '피드백 감사합니다'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
