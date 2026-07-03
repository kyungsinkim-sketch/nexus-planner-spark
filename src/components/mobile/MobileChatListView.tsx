/**
 * MobileChatListView — Mobile chat tab.
 *
 * Renders the shared `ChatPanel` (Projects / Direct / Groups tabs) so the
 * mobile chat tab uses the same layout as the desktop widget. ChatPanel has
 * built-in mobile responsive sizing (md: prefixes), so on phones the fonts,
 * icons, and avatars are scaled up for readability while desktop keeps the
 * compact widget look.
 *
 * Previously this component rendered a custom flat list of all conversations.
 * Pablo asked to unify the mobile chat surface around the tabbed ChatPanel
 * layout (image #1) while keeping the larger mobile sizing (image #2). The
 * flat list lives in git history if we ever want it back.
 */

import { lazy, Suspense } from 'react';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';

const ChatPanel = lazy(() =>
  import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel }))
);

function MobileChatListView() {
  // Keyboard-aware viewport — translateY(offsetTop) tracks the iOS pan so
  // the container always covers exactly the visible area (see hook docs)
  const { height: viewH, offsetTop, keyboardOpen } = useKeyboardViewport();

  return (
    <div
      className={`flex flex-col widget-area-bg overflow-hidden ${keyboardOpen ? 'fixed top-0 left-0 right-0 z-50' : 'h-full'}`}
      style={keyboardOpen ? { height: `${viewH}px`, transform: `translateY(${offsetTop}px)` } : undefined}
    >
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <ChatPanel keyboardOpen={keyboardOpen} />
      </Suspense>
    </div>
  );
}

export default MobileChatListView;
