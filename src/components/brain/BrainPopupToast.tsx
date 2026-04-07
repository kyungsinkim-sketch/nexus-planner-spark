/**
 * BrainPopupToast — Brain AI floating notification popup.
 * Rendered via sonner toast.custom() for non-blocking, auto-dismiss behavior.
 *
 * Used for:
 * - Brain AI todo assignments to other users
 * - Daily briefing popup
 * - Brain AI action confirmations
 */

import { Brain, Check, X, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export interface BrainPopupData {
  id: string;
  title: string;
  message: string;
  source: 'todo_assignment' | 'briefing' | 'event_request' | 'brain_action';
  fromUserName?: string;
  actionLabel?: string;
  onAccept?: () => void;
  onReject?: () => void;
  onReply?: () => void;
}

export function BrainPopupToast({
  data,
  toastId,
}: {
  data: BrainPopupData;
  toastId: string | number;
}) {
  const handleAccept = () => {
    data.onAccept?.();
    toast.dismiss(toastId);
  };

  const handleReject = () => {
    data.onReject?.();
    toast.dismiss(toastId);
  };

  const handleReply = () => {
    data.onReply?.();
    toast.dismiss(toastId);
  };

  return (
    <div className="w-[360px] bg-black/95 border border-[#D4A843]/30 rounded-xl p-4 shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-[#D4A843]/20 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-[#D4A843]" />
        </div>
        <span className="text-sm font-semibold text-[#D4A843]">Brain AI</span>
        {data.fromUserName && (
          <span className="text-xs text-muted-foreground ml-auto">
            from {data.fromUserName}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-white mb-1">{data.title}</p>

      {/* Message */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        {data.message}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {data.onAccept && (
          <button
            onClick={handleAccept}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#D4A843]/20 hover:bg-[#D4A843]/30 text-[#D4A843] text-xs font-medium transition-colors"
          >
            <Check className="w-3 h-3" />
            {data.actionLabel || '확인'}
          </button>
        )}
        {data.onReply && (
          <button
            onClick={handleReply}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            답장
          </button>
        )}
        {data.onReject && (
          <button
            onClick={handleReject}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground text-xs font-medium transition-colors"
          >
            <X className="w-3 h-3" />
            무시
          </button>
        )}
        {!data.onAccept && !data.onReject && (
          <button
            onClick={() => toast.dismiss(toastId)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground text-xs font-medium transition-colors ml-auto"
          >
            확인
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Show a Brain AI popup toast.
 * Returns the toast ID for programmatic dismissal.
 */
export function showBrainPopup(data: BrainPopupData): string | number {
  const id = data.id || `brain_${Date.now()}`;
  toast.custom(
    (toastId) => <BrainPopupToast data={data} toastId={toastId} />,
    {
      id,
      duration: data.source === 'briefing' ? 15000 : 10000,
      position: 'top-center',
    },
  );
  return id;
}
