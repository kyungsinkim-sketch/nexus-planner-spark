/**
 * BrainPopupToast — Brain AI floating notification popup.
 *
 * Design: matches dashboard glass-widget style
 *   - Glass background with backdrop blur
 *   - Blue primary button (#3B82F6)
 *   - Policy-matching typography (typo-widget-body / typo-widget-sub)
 * Mobile: centered overlay with backdrop
 * Desktop: top-center Sonner toast
 * Duration: stays until user clicks a button (no auto-dismiss)
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

function BrainPopupCard({
  data,
  onDismiss,
}: {
  data: BrainPopupData;
  onDismiss: () => void;
}) {
  const handleAccept = () => {
    data.onAccept?.();
    onDismiss();
  };

  const handleReject = () => {
    data.onReject?.();
    onDismiss();
  };

  const handleReply = () => {
    data.onReply?.();
    onDismiss();
  };

  return (
    <div className="w-[320px] sm:w-[360px] rounded-2xl border border-border/50 bg-background/80 backdrop-blur-xl p-5 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-violet-500" />
        </div>
        <span className="typo-label text-violet-500">Brain AI</span>
        {data.fromUserName && (
          <span className="typo-caption text-muted-foreground ml-auto">
            from {data.fromUserName}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="typo-widget-body font-medium text-foreground leading-snug mb-1.5">{data.title}</p>

      {/* Message */}
      <p className="typo-widget-sub leading-relaxed mb-4 whitespace-pre-line">
        {data.message}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {data.onAccept && (
          <button
            onClick={handleAccept}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[13px] font-semibold transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {data.actionLabel || '확인'}
          </button>
        )}
        {data.onReply && (
          <button
            onClick={handleReply}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:border-border/80 text-muted-foreground hover:text-foreground text-[13px] font-medium transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            답장
          </button>
        )}
        {data.onReject && (
          <button
            onClick={handleReject}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border hover:border-border/80 text-muted-foreground text-[13px] font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            무시
          </button>
        )}
        {!data.onAccept && !data.onReject && (
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[13px] font-semibold transition-colors ml-auto"
          >
            확인
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Desktop toast wrapper — rendered inside Sonner
 */
export function BrainPopupToast({
  data,
  toastId,
}: {
  data: BrainPopupData;
  toastId: string | number;
}) {
  return <BrainPopupCard data={data} onDismiss={() => toast.dismiss(toastId)} />;
}

/**
 * Mobile centered overlay — fixed position center of screen
 */
function BrainPopupMobileOverlay({
  data,
  onDismiss,
}: {
  data: BrainPopupData;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onDismiss}
    >
      <div
        className="animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <BrainPopupCard data={data} onDismiss={onDismiss} />
      </div>
    </div>
  );
}

// Track mobile overlay root
let mobileOverlayCleanup: (() => void) | null = null;

function isMobileDevice(): boolean {
  return window.innerWidth < 768;
}

/**
 * Show a Brain AI popup.
 * Mobile: centered overlay with backdrop
 * Desktop: Sonner toast (top-center)
 * Duration: Infinity — stays until user clicks a button
 */
export function showBrainPopup(data: BrainPopupData): string | number {
  const id = data.id || `brain_${Date.now()}`;

  if (isMobileDevice()) {
    // Mobile: render centered overlay (no auto-dismiss)
    if (mobileOverlayCleanup) mobileOverlayCleanup();

    const container = document.createElement('div');
    container.id = `brain-popup-${id}`;
    document.body.appendChild(container);

    const cleanup = () => {
      container.remove();
      if (mobileOverlayCleanup === cleanup) mobileOverlayCleanup = null;
    };

    mobileOverlayCleanup = cleanup;

    // Use React 18 createRoot
    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        <BrainPopupMobileOverlay data={data} onDismiss={() => {
          root.unmount();
          container.remove();
          if (mobileOverlayCleanup) mobileOverlayCleanup = null;
        }} />
      );
      // Update cleanup to use root.unmount
      mobileOverlayCleanup = () => {
        root.unmount();
        container.remove();
        mobileOverlayCleanup = null;
      };
    });

    return id;
  }

  // Desktop: Sonner toast — Infinity duration, dismiss only on button click
  toast.custom(
    (toastId) => <BrainPopupToast data={data} toastId={toastId} />,
    {
      id,
      duration: Infinity,
      position: 'top-center',
    },
  );
  return id;
}
