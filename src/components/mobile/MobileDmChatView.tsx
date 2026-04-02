/**
 * MobileDmChatView — Full-screen 1:1 DM chat triggered from member detail
 */

import { lazy, Suspense, useState, useEffect } from 'react';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';

const ChatPanel = lazy(() =>
  import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel }))
);

export function MobileDmChatView() {
  const { mobileDmTargetUserId, mobileGroupRoomId } = useWidgetStore();
  const { chatRooms } = useAppStore();

  // Track visual viewport for keyboard handling
  const [viewH, setViewH] = useState(() => window.visualViewport?.height || window.innerHeight);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    // Capture initial height (before keyboard) as baseline
    const initialH = vv.height;
    const update = () => {
      setViewH(vv.height);
      // Keyboard open = viewport shrunk significantly from initial
      setKeyboardOpen(initialH - vv.height > 100);
      window.scrollTo(0, 0);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div
      className={`flex flex-col bg-background overflow-hidden w-full max-w-[100vw] ${keyboardOpen ? 'fixed top-0 left-0 right-0' : 'h-full'}`}
      style={keyboardOpen ? { height: `${viewH}px` } : undefined}
    >
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {mobileDmTargetUserId && (
            <ChatPanel defaultDmUserId={mobileDmTargetUserId} keyboardOpen={keyboardOpen} />
          )}
          {mobileGroupRoomId && (
            <ChatPanel defaultGroupRoomId={mobileGroupRoomId} keyboardOpen={keyboardOpen} />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default MobileDmChatView;
