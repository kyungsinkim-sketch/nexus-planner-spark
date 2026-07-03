/**
 * ChatWidget — Embeds the ChatPanel in a widget.
 * Dashboard: general chat. Project: auto-selects project chat room.
 *
 * On mobile, when the keyboard opens this widget breaks out of the widget
 * grid into a fixed full-viewport container (same pattern as the dedicated
 * mobile chat views) — otherwise the iOS keyboard pan leaves the input
 * stranded mid-screen with a dead gap below it. See useKeyboardViewport.
 */

import { ChatPanel } from '@/components/chat/ChatPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import type { WidgetDataContext } from '@/types/widget';

function ChatWidget({ context }: { context: WidgetDataContext }) {
  // On project tabs, auto-select the project's default chat room
  const projectId = context.type === 'project' ? context.projectId : undefined;

  const isMobile = useIsMobile();
  const { height, offsetTop, keyboardOpen } = useKeyboardViewport();
  const breakout = isMobile && keyboardOpen;

  return (
    <div
      className={
        breakout
          ? 'fixed top-0 left-0 right-0 z-50 widget-area-bg overflow-hidden'
          : 'h-full min-h-[200px] overflow-hidden'
      }
      style={breakout ? { height: `${height}px`, transform: `translateY(${offsetTop}px)` } : undefined}
    >
      <ChatPanel defaultProjectId={projectId} keyboardOpen={breakout} />
    </div>
  );
}

export default ChatWidget;
