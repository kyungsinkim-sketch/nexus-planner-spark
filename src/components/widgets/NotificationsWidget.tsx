/**
 * NotificationsWidget — Shows unread notifications.
 * - Chat messages from other users (all messages, not just @mentions)
 * - @mentions highlighted with AtSign icon
 * - Upcoming events (owned by current user only)
 * - Company-wide notifications from admin
 * - Click message notification → dismiss + open project tab (chat visible)
 * - Dismissed IDs stored in appStore (synced across all widget instances)
 */

import { useMemo, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Bell, MessageSquare, Calendar, Check, AtSign, Megaphone } from 'lucide-react';
import { BRAIN_BOT_USER_ID } from '@/types/core';
import type { WidgetDataContext } from '@/types/widget';

function NotificationsWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const {
    messages, events, currentUser, getUserById, projects,
    companyNotifications,
    dismissedNotificationIds, dismissNotification, dismissAllNotifications,
  } = useAppStore();
  const { openProjectTab } = useWidgetStore();

  const dismissedSet = useMemo(() => new Set(dismissedNotificationIds), [dismissedNotificationIds]);

  // Build notification list
  const notifications = useMemo(() => {
    const items: {
      id: string;
      icon: typeof Bell;
      text: string;
      time: string;
      type: 'message' | 'event' | 'company';
      senderName?: string;
      projectId?: string;
      isMention?: boolean;
    }[] = [];

    // Recent messages from OTHER users (last 20, newest first)
    const recentMsgs = messages
      .filter((m) => {
        if (currentUser && m.userId === currentUser.id) return false;
        if (m.userId === BRAIN_BOT_USER_ID) return false;
        if (context.type === 'project' && context.projectId) {
          return m.projectId === context.projectId;
        }
        return true;
      })
      .slice(-20)
      .reverse();

    const mentionTag = currentUser ? `@${currentUser.name}` : null;

    recentMsgs.forEach((m) => {
      const id = `msg-${m.id}`;
      if (dismissedSet.has(id)) return;
      const sender = getUserById(m.userId);
      const isMention = mentionTag ? m.content.includes(mentionTag) : false;

      items.push({
        id,
        icon: isMention ? AtSign : MessageSquare,
        text: m.content.slice(0, 80),
        time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        type: 'message',
        senderName: sender?.name,
        projectId: m.projectId,
        isMention,
      });
    });

    // Upcoming events (next 24h) — only current user's events
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const todayStr = now.toDateString();
    const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    events
      .filter((e) => {
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

    // Company-wide notifications (newest first, shown before other items)
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
          type: 'company',
          senderName: sender?.name || 'Admin',
        });
      });

    // Sort: @mentions first, then company, then regular messages, then events
    const mentionItems = items.filter((i) => i.isMention);
    const msgItems = items.filter((i) => i.type === 'message' && !i.isMention);
    const eventItems = items.filter((i) => i.type === 'event');

    return [...companyItems, ...mentionItems, ...msgItems, ...eventItems].slice(0, 20);
  }, [messages, events, context, dismissedSet, currentUser, getUserById, companyNotifications, t]);

  const handleDismissAll = useCallback(() => {
    dismissAllNotifications(notifications.map((n) => n.id));
  }, [notifications, dismissAllNotifications]);

  const handleClick = useCallback((n: typeof notifications[0]) => {
    dismissNotification(n.id);
    // Navigate to project chat: open the project tab (chat widget is in project layout)
    if (n.projectId && n.type === 'message') {
      const project = projects.find((p) => p.id === n.projectId);
      if (project) {
        openProjectTab(project.id, project.title, project.keyColor);
      }
    }
  }, [dismissNotification, projects, openProjectTab]);

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
              className={`flex items-start gap-2 p-1.5 rounded transition-colors group cursor-pointer ${
                n.isMention
                  ? 'bg-primary/5 hover:bg-primary/10 border-l-2 border-primary/40'
                  : 'hover:bg-white/5'
              }`}
              onClick={() => handleClick(n)}
              title={n.projectId ? t('clickToOpenChat') : t('clickToDismiss')}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                n.isMention ? 'text-primary' : 'text-muted-foreground'
              }`} />
              <div className="flex-1 min-w-0">
                {n.senderName && (
                  <span className={`text-[10px] font-medium ${
                    n.isMention ? 'text-primary' : 'text-primary/80'
                  }`}>{n.senderName}</span>
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
