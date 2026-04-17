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

import { lazy, Suspense, useState, useEffect } from 'react';

const ChatPanel = lazy(() =>
  import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel }))
);

function MobileChatListView() {
  const [viewH, setViewH] = useState(() => window.visualViewport?.height || window.innerHeight);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const initialH = vv.height;
    const update = () => {
      setViewH(vv.height);
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
      className={`flex flex-col widget-area-bg overflow-hidden ${keyboardOpen ? 'fixed top-0 left-0 right-0' : 'h-full'}`}
      style={keyboardOpen ? { height: `${viewH}px` } : undefined}
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
