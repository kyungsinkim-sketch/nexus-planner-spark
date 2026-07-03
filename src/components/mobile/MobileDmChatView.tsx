/**
 * MobileDmChatView — Full-screen 1:1 DM chat triggered from member detail
 */

import { lazy, Suspense } from 'react';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';

const ChatPanel = lazy(() =>
  import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel }))
);

export function MobileDmChatView() {
  const { mobileDmTargetUserId, mobileGroupRoomId, setMobileView } = useWidgetStore();
  const { chatRooms } = useAppStore();

  // Back from a DM/group thread should return to the unified mobile chat
  // list (image #2 styling) rather than fall through to ChatPanel's internal
  // desktop-styled Projects/Direct/Groups list.
  const handleBackToList = () => setMobileView('chat-list');

  // Keyboard-aware viewport — translateY(offsetTop) tracks the iOS pan so
  // the container always covers exactly the visible area (see hook docs)
  const { height: viewH, offsetTop, keyboardOpen } = useKeyboardViewport();

  return (
    <div
      className={`flex flex-col widget-area-bg overflow-hidden ${keyboardOpen ? 'fixed top-0 left-0 right-0 z-50' : 'h-full'}`}
      style={keyboardOpen ? { height: `${viewH}px`, transform: `translateY(${offsetTop}px)` } : undefined}
    >
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {mobileDmTargetUserId && (
            <ChatPanel
              defaultDmUserId={mobileDmTargetUserId}
              keyboardOpen={keyboardOpen}
              onBackToList={handleBackToList}
            />
          )}
          {mobileGroupRoomId && (
            <ChatPanel
              defaultGroupRoomId={mobileGroupRoomId}
              keyboardOpen={keyboardOpen}
              onBackToList={handleBackToList}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default MobileDmChatView;
