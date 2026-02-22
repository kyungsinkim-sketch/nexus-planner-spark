import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { submitRAGFeedback } from '@/services/ragService';
import { useAppStore } from '@/stores/appStore';

interface RAGFeedbackButtonProps {
  queryLogId: string;
  className?: string;
}

/**
 * 👍/👎 피드백 버튼 — Brain AI 응답 하단에 배치
 * 사용자 피드백을 rag_query_log.was_helpful에 기록하면
 * DB 트리거가 knowledge_items.relevance_score를 자동 조정합니다.
 */
export function RAGFeedbackButton({ queryLogId, className }: RAGFeedbackButtonProps) {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = useAppStore((s) => s.currentUser);

  if (!queryLogId || !currentUser) return null;

  const handleFeedback = async (wasHelpful: boolean) => {
    if (feedback !== null || isSubmitting) return; // 이미 피드백 완료
    setIsSubmitting(true);
    try {
      const success = await submitRAGFeedback(currentUser.id, queryLogId, wasHelpful);
      if (success) {
        setFeedback(wasHelpful);
      }
    } catch (err) {
      console.error('[RAGFeedback] Failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className || ''}`}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-6 w-6 p-0 ${feedback === true ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground hover:text-emerald-600'}`}
        onClick={() => handleFeedback(true)}
        disabled={feedback !== null || isSubmitting}
        title="도움이 됐어요"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-6 w-6 p-0 ${feedback === false ? 'text-red-600 bg-red-50' : 'text-muted-foreground hover:text-red-600'}`}
        onClick={() => handleFeedback(false)}
        disabled={feedback !== null || isSubmitting}
        title="도움이 안 됐어요"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
      {feedback !== null && (
        <span className="text-xs text-muted-foreground ml-1">
          {feedback ? '감사합니다!' : '개선할게요'}
        </span>
      )}
    </div>
  );
}
