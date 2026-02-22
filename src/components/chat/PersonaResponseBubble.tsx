/**
 * PersonaResponseBubble — Renders the AI persona's response message.
 *
 * Displays:
 * - CEO persona avatar + name
 * - Free-form text response (whitespace preserved)
 * - RAG reference count badge
 * - Feedback buttons (👍/👎)
 *
 * Styled with amber/gold gradient to distinguish from Brain's violet theme.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Crown,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { ChatMessage } from '@/types/core';
import * as personaService from '@/services/personaService';

interface PersonaResponseBubbleProps {
  message: ChatMessage;
}

export function PersonaResponseBubble({ message }: PersonaResponseBubbleProps) {
  const personaData = message.personaResponseData;
  const [feedbackState, setFeedbackState] = useState<'none' | 'helpful' | 'unhelpful' | 'submitting'>('none');

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

  return (
    <div className="space-y-1 max-w-full overflow-hidden">
      {/* Persona response bubble */}
      <div
        className="w-fit max-w-full rounded-2xl px-4 py-2.5 text-sm bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/50"
        style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
      >
        {/* Persona header */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {personaData.personaName || 'Pablo AI'}
          </span>
          {ragCount > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] gap-0.5 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 ml-1"
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
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-amber-200/30 dark:border-amber-700/30">
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
