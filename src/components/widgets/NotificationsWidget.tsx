/**
 * NotificationsWidget — Shows recent notifications/activity.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Bell, MessageSquare, Calendar, FileText } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function NotificationsWidget({ context }: { context: WidgetDataContext }) {
  const { messages, events } = useAppStore();

  // Simple notification list from recent messages and upcoming events
  const notifications = useMemo(() => {
    const items: { id: string; icon: typeof Bell; text: string; time: string }[] = [];

    // Recent messages (last 5)
    const recentMsgs = messages
      .filter((m) => {
        if (context.type === 'project' && context.projectId) {
          return m.projectId === context.projectId;
        }
        return true;
      })
      .slice(-5)
      .reverse();

    recentMsgs.forEach((m) => {
      items.push({
        id: `msg-${m.id}`,
        icon: MessageSquare,
        text: m.content.slice(0, 60),
        time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      });
    });

    // Upcoming events (next 24h)
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    events
      .filter((e) => {
        const start = new Date(e.startAt);
        const match = start >= now && start <= next24h;
        if (context.type === 'project' && context.projectId) {
          return match && e.projectId === context.projectId;
        }
        return match;
      })
      .slice(0, 3)
      .forEach((e) => {
        items.push({
          id: `evt-${e.id}`,
          icon: Calendar,
          text: e.title,
          time: new Date(e.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      });

    return items.slice(0, 8);
  }, [messages, events, context]);

  if (notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        <Bell className="w-4 h-4 mr-2" /> No notifications
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {notifications.map((n) => {
        const Icon = n.icon;
        return (
          <div key={n.id} className="flex items-start gap-2 p-1.5 rounded hover:bg-white/5 transition-colors">
            <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-foreground truncate flex-1">{n.text}</p>
            <span className="text-[10px] text-muted-foreground shrink-0">{n.time}</span>
          </div>
        );
      })}
    </div>
  );
}

export default NotificationsWidget;
