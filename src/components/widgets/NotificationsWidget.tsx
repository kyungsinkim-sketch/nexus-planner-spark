/**
 * NotificationsWidget — Shows unread notifications from OTHER users.
 * - Excludes current user's own messages
 * - Click notification → dismiss + activate chat widget with that conversation
 * - Already-seen items tracked in sessionStorage
 */

import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Bell, MessageSquare, Calendar, Check } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

const DISMISSED_KEY = 'rebe-notif-dismissed';
function getDismissedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveDismissedIds(ids: Set<string>) {
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

function NotificationsWidget({ context }: { context: WidgetDataContext }) {
  const { messages, events, currentUser, getUserById } = useAppStore();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedIds(next);
      return next;
    });
  }, []);

  // Build notification list — exclude own messages
  const notifications = useMemo(() => {
    const items: {
      id: string;
      icon: typeof Bell;
      text: string;
      time: string;
      type: 'message' | 'event';
      senderName?: string;
      projectId?: string;
    }[] = [];

    // Recent messages from OTHER users (last 15, reversed = newest first)
    const recentMsgs = messages
      .filter((m) => {
        // Exclude own messages
        if (currentUser && m.userId === currentUser.id) return false;
        if (context.type === 'project' && context.projectId) {
          return m.projectId === context.projectId;
        }
        return true;
      })
      .slice(-15)
      .reverse();

    recentMsgs.forEach((m) => {
      const id = `msg-${m.id}`;
      if (dismissedIds.has(id)) return;
      const sender = getUserById(m.userId);
      items.push({
        id,
        icon: MessageSquare,
        text: m.content.slice(0, 80),
        time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        type: 'message',
        senderName: sender?.name,
        projectId: m.projectId,
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
      .slice(0, 5)
      .forEach((e) => {
        const id = `evt-${e.id}`;
        if (dismissedIds.has(id)) return;
        items.push({
          id,
          icon: Calendar,
          text: e.title,
          time: new Date(e.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'event',
        });
      });

    return items.slice(0, 12);
  }, [messages, events, context, dismissedIds, currentUser, getUserById]);

  const handleDismissAll = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      notifications.forEach((n) => next.add(n.id));
      saveDismissedIds(next);
      return next;
    });
  }, [notifications]);

  const handleClick = useCallback((n: typeof notifications[0]) => {
    dismiss(n.id);
    // Future: could scroll chat to the specific message
  }, [dismiss]);

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 text-sm gap-1">
        <Check className="w-5 h-5" />
        <span>All caught up!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end px-1 pb-1 shrink-0">
        <button
          onClick={handleDismissAll}
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          Mark all read
        </button>
      </div>

      <div className="space-y-0.5 flex-1 min-h-0 overflow-auto">
        {notifications.map((n) => {
          const Icon = n.icon;
          return (
            <div
              key={n.id}
              className="flex items-start gap-2 p-1.5 rounded hover:bg-white/5 transition-colors group cursor-pointer"
              onClick={() => handleClick(n)}
              title="Click to dismiss"
            >
              <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {n.senderName && (
                  <span className="text-[10px] font-medium text-primary/80">{n.senderName}</span>
                )}
                <p className="text-xs text-foreground truncate">{n.text}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{n.time}</span>
              <Check className="w-3 h-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors shrink-0 mt-0.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NotificationsWidget;
