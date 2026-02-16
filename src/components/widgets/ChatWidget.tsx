/**
 * ChatWidget — Embeds the ChatPanel in a widget.
 * Dashboard: general chat. Project: project chat (filtered).
 */

import { ChatPanel } from '@/components/chat/ChatPanel';
import type { WidgetDataContext } from '@/types/widget';

function ChatWidget({ context: _context }: { context: WidgetDataContext }) {
  // ChatPanel manages its own room/conversation selection.
  // In the future, auto-select based on context.projectId.
  return (
    <div className="h-full min-h-[200px]">
      <ChatPanel />
    </div>
  );
}

export default ChatWidget;
