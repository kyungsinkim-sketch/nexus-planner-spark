/**
 * BrainPopupToast — Brain AI floating notification popup.
 * Rendered via sonner toast.custom() for non-blocking, auto-dismiss behavior.
 *
 * Design: Cosmos theme (pure black bg, gold accent #D4A843)
 * Mobile: centered overlay with backdrop
 * Desktop: top-center toast
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
    <div className="w-[320px] sm:w-[360px] rounded-2xl border border-[#D4A843]/20 bg-black p-5 shadow-[0_8px_32px_rgba(212,168,67,0.12)]">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-full bg-[#D4A843]/15 flex items-center justify-center shrink-0">
          <Brain className="w-4.5 h-4.5 text-[#D4A843]" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-[#D4A843]">Brain AI</span>
        {data.fromUserName && (
          <span className="text-[11px] text-white/40 ml-auto">
            from {data.fromUserName}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="text-[14px] font-medium text-white leading-snug mb-1.5">{data.title}</p>

      {/* Message */}
      <p className="text-[12px] text-white/50 leading-relaxed mb-4 whitespace-pre-line">
        {data.message}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {data.onAccept && (
          <button
            onClick={handleAccept}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D4A843] hover:bg-[#D4A843]/90 text-black text-[12px] font-semibold transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {data.actionLabel || '확인'}
          </button>
        )}
        {data.onReply && (
          <button
            onClick={handleReply}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-white/70 text-[12px] font-medium transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            답장
          </button>
        )}
        {data.onReject && (
          <button
            onClick={handleReject}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-white/40 text-[12px] font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            무시
          </button>
        )}
        {!data.onAccept && !data.onReject && (
          <button
            onClick={onDismiss}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D4A843] hover:bg-[#D4A843]/90 text-black text-[12px] font-semibold transition-colors ml-auto"
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
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
 */
export function showBrainPopup(data: BrainPopupData): string | number {
  const id = data.id || `brain_${Date.now()}`;

  if (isMobileDevice()) {
    // Mobile: render centered overlay
    if (mobileOverlayCleanup) mobileOverlayCleanup();

    const container = document.createElement('div');
    container.id = `brain-popup-${id}`;
    document.body.appendChild(container);

    const cleanup = () => {
      container.remove();
      if (mobileOverlayCleanup === cleanup) mobileOverlayCleanup = null;
    };

    mobileOverlayCleanup = cleanup;

    // Auto-dismiss after duration
    const duration = data.source === 'briefing' ? 15000 : 10000;
    const timer = setTimeout(cleanup, duration);

    const dismissWithTimer = () => {
      clearTimeout(timer);
      cleanup();
    };

    // Use React 18 createRoot
    import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        <BrainPopupMobileOverlay data={data} onDismiss={dismissWithTimer} />
      );
      // Update cleanup to use root.unmount
      mobileOverlayCleanup = () => {
        clearTimeout(timer);
        root.unmount();
        container.remove();
        mobileOverlayCleanup = null;
      };
    });

    return id;
  }

  // Desktop: Sonner toast
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
