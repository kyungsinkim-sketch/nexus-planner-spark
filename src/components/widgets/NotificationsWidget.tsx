/**
 * NotificationsWidget — Shows unread notifications.
 * - @mentions only (regular chat text notifications excluded)
 * - Upcoming events (owned by current user only)
 * - Company-wide notifications from admin
 * - Brain AI notifications
 * - Click message notification → dismiss + open project tab (chat visible)
 * - Dismissed IDs stored in appStore (synced across all widget instances)
 */

import { useMemo, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Bell, Calendar, Check, Megaphone, Brain, MessageSquare, ListTodo } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function NotificationsWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const {
    events, currentUser, getUserById,
    companyNotifications, brainNotifications,
    dismissedNotificationIds, dismissNotification, dismissAllNotifications,
    appNotifications,
  } = useAppStore();


  const dismissedSet = useMemo(() => new Set(dismissedNotificationIds), [dismissedNotificationIds]);

  const isProjectContext = context.type === 'project' && !!context.projectId;

  // Build notification list
  const notifications = useMemo(() => {
    const items: {
      id: string;
      icon: typeof Bell;
      text: string;
      time: string;
      type: 'event' | 'company' | 'brain' | 'chat' | 'todo';
      senderName?: string;
      projectId?: string;
    }[] = [];

    // App notifications (chat, todo, brain) — filtered by project if in project context
    const relevantAppNotifs = isProjectContext
      ? appNotifications.filter(n => n.projectId === context.projectId)
      : appNotifications;

    relevantAppNotifs
      .filter(n => !n.read)
      .slice(0, 10)
      .forEach((n) => {
        const id = `app-${n.id}`;
        if (dismissedSet.has(id)) return;
        const iconMap: Record<string, typeof Bell> = {
          chat: MessageSquare,
          todo: ListTodo,
          event: Calendar,
          brain: Brain,
          company: Megaphone,
        };
        items.push({
          id,
          icon: iconMap[n.type] || Bell,
          text: `${n.title}: ${n.message}`,
          time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: n.type as 'event' | 'company' | 'brain' | 'chat' | 'todo',
          projectId: n.projectId,
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
        if (isProjectContext) {
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

    // Company-wide notifications (only in global dashboard, not per-project)
    if (!isProjectContext) {
      companyNotifications
        .slice()
        .reverse()
        .forEach((cn) => {
          const id = `company-${cn.id}`;
          if (dismissedSet.has(id)) return;
          const sender = getUserById(cn.sentBy);
          items.push({
            id,
            icon: Megaphone,
            text: `${cn.title}: ${cn.message}`,
            time: new Date(cn.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'company',
            senderName: sender?.name || 'Admin',
          });
        });
    }

    // Brain AI notifications (newest first) — filtered by project context
    brainNotifications
      .slice(0, 10)
      .forEach((bn) => {
        // In project context, only show brain notifs linked to this project's chat rooms
        if (isProjectContext && bn.chatRoomId) {
          // Check if chatRoom belongs to this project
          const { chatRooms } = useAppStore.getState();
          const room = chatRooms.find(r => r.id === bn.chatRoomId);
          if (room && room.projectId !== context.projectId) return;
        }
        const id = `brain-${bn.id}`;
        if (dismissedSet.has(id)) return;
        items.push({
          id,
          icon: Brain,
          text: `${bn.title}: ${bn.message}`,
          time: new Date(bn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'brain',
          senderName: bn.emailSubject ? `📧 ${bn.emailSubject}` : 'Brain AI',
        });
      });

    return items.slice(0, 20);
  }, [events, context, dismissedSet, currentUser, companyNotifications, brainNotifications, appNotifications, isProjectContext, t]);

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
              className={`flex items-start gap-2 p-1.5 rounded transition-colors group cursor-pointer ${
                n.type === 'brain'
                  ? 'bg-violet-500/5 hover:bg-violet-500/10 border-l-2 border-violet-500/40'
                  : 'hover:bg-white/5'
              }`}
              onClick={() => handleClick(n)}
              title={t('clickToDismiss')}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                n.type === 'brain' ? 'text-violet-500' : 'text-muted-foreground'
              }`} />
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
