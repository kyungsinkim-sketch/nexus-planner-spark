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

const ChatPanel = lazy(() =>
  import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel }))
);

function MobileChatListView() {
  return (
    <div className="h-full flex flex-col bg-background">
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <ChatPanel />
      </Suspense>
    </div>
  );
}

export default MobileChatListView;
