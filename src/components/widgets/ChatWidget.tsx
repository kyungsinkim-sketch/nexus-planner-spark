/**
 * ChatWidget — Embeds the ChatPanel in a widget.
 * Dashboard: general chat. Project: auto-selects project chat room.
 */

import { ChatPanel } from '@/components/chat/ChatPanel';
import type { WidgetDataContext } from '@/types/widget';

function ChatWidget({ context }: { context: WidgetDataContext }) {
  // On project tabs, auto-select the project's default chat room
  const projectId = context.type === 'project' ? context.projectId : undefined;

  return (
    <div className="h-full min-h-[200px] overflow-hidden">
      <ChatPanel defaultProjectId={projectId} />
    </div>
  );
}

export default ChatWidget;
