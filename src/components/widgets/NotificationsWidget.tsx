/**
 * NotificationsWidget — Shows unread notifications from OTHER users.
 * - Excludes current user's own messages
 * - Click notification → dismiss globally (synced across all widget instances)
 * - Dismissed IDs stored in appStore (persisted across refreshes)
 * - Events filtered by currentUser.ownerId to prevent cross-user leaking
 */

import { useMemo, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Bell, MessageSquare, Calendar, Check, AtSign, Megaphone } from 'lucide-react';
import { BRAIN_BOT_USER_ID } from '@/types/core';
import type { WidgetDataContext } from '@/types/widget';

function NotificationsWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const {
    messages, events, currentUser, getUserById,
    companyNotifications,
    dismissedNotificationIds, dismissNotification, dismissAllNotifications,
  } = useAppStore();

  const dismissedSet = useMemo(() => new Set(dismissedNotificationIds), [dismissedNotificationIds]);

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
    // Exclude Brain bot messages — only show human @mention messages
    const recentMsgs = messages
      .filter((m) => {
        // Exclude own messages
        if (currentUser && m.userId === currentUser.id) return false;
        // Exclude Brain AI bot messages
        if (m.userId === BRAIN_BOT_USER_ID) return false;
        if (context.type === 'project' && context.projectId) {
          return m.projectId === context.projectId;
        }
        return true;
      })
      .slice(-15)
      .reverse();

    // Filter to only @mention messages that mention the current user
    const mentionTag = currentUser ? `@${currentUser.name}` : null;

    recentMsgs.forEach((m) => {
      const id = `msg-${m.id}`;
      if (dismissedSet.has(id)) return;
      const sender = getUserById(m.userId);
      const isMention = mentionTag ? m.content.includes(mentionTag) : false;

      // Only show @mention messages in notifications (not all messages)
      if (!isMention) return;

      items.push({
        id,
        icon: isMention ? AtSign : MessageSquare,
        text: m.content.slice(0, 80),
        time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        type: 'message',
        senderName: sender?.name,
        projectId: m.projectId,
      });
    });

    // Upcoming events (next 24h) — only show current user's events
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const todayStr = now.toDateString();
    const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    events
      .filter((e) => {
        // Only show events owned by the current user
        if (currentUser && e.ownerId && e.ownerId !== currentUser.id) return false;
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
        if (dismissedSet.has(id)) return;
        const eventStart = new Date(e.startAt);
        const timeStr = eventStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const eventDateStr = eventStart.toDateString();
        let datePrefix = '';
        if (eventDateStr === todayStr) {
          datePrefix = t('today') || '오늘';
        } else if (eventDateStr === tomorrowStr) {
          datePrefix = t('tomorrow') || '내일';
        } else {
          datePrefix = eventStart.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
        }
        items.push({
          id,
          icon: Calendar,
          text: e.title,
          time: `${datePrefix} ${timeStr}`,
          type: 'event',
        });
      });

    // Company-wide notifications from admin (show newest first, before other items)
    const companyItems: typeof items = [];
    companyNotifications
      .slice()
      .reverse()
      .forEach((cn) => {
        const id = `company-${cn.id}`;
        if (dismissedSet.has(id)) return;
        const sender = getUserById(cn.sentBy);
        companyItems.push({
          id,
          icon: Megaphone,
          text: `${cn.title}: ${cn.message}`,
          time: new Date(cn.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'message',
          senderName: sender?.name || 'Admin',
        });
      });

    return [...companyItems, ...items].slice(0, 15);
  }, [messages, events, context, dismissedSet, currentUser, getUserById, companyNotifications, t]);

  const handleDismissAll = useCallback(() => {
    dismissAllNotifications(notifications.map((n) => n.id));
  }, [notifications, dismissAllNotifications]);

  const handleClick = useCallback((n: typeof notifications[0]) => {
    dismissNotification(n.id);
  }, [dismissNotification]);

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 text-sm gap-1">
        <Check className="w-5 h-5" />
        <span>{t('allCaughtUp')}</span>
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
          {t('markAllRead')}
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
              title={t('clickToDismiss')}
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
