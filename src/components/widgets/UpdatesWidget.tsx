/**
 * UpdatesWidget — Shows real-time updates (web dashboard + mobile synced).
 *
 * Content:
 * - 💬 New messages (DM, group, project chat)
 * - 📧 New emails
 * - 🧠 Brain AI suggestions
 * - 📋 Todo alerts (deadline reminders from others)
 *
 * Does NOT include calendar events or self-created todos (those are separate widgets).
 * Synced across web ↔ mobile via appNotifications + notification_read_state.
 */

import { useMemo, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { WidgetDataContext } from '@/types/widget';
import type { AppNotification } from '@/types/core';
import {
  Bell, MessageSquare, ListTodo, Brain, Mail,
  Check, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function UpdatesWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const {
    appNotifications,
    markAppNotificationRead,
    currentUser,
    projects,
  } = useAppStore();

  const isProjectContext = context.type === 'project' && !!context.projectId;

  // Filter updates by context
  const updates = useMemo(() => {
    if (!appNotifications) return [];

    let filtered = appNotifications.filter(n => !n.read);

    // In project context, only show that project's updates
    if (isProjectContext && context.projectId) {
      filtered = filtered.filter(n => n.projectId === context.projectId);
    }

    return filtered.slice(0, 15);
  }, [appNotifications, isProjectContext, context.projectId]);

  // Group by type for summary header
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of updates) {
      counts[u.type] = (counts[u.type] || 0) + 1;
    }
    return counts;
  }, [updates]);

  const handleClick = useCallback((notif: AppNotification) => {
    // Mark as read (synced across devices)
    markAppNotificationRead(notif.id);

    // Navigate based on type
    const widgetStore = useWidgetStore.getState();
    const appStore = useAppStore.getState();

    if (notif.type === 'chat' && notif.directUserId) {
      // Open DM
      if (widgetStore.openMobileDm) {
        widgetStore.openMobileDm(notif.directUserId);
      }
    } else if (notif.type === 'chat' && notif.projectId) {
      const project = appStore.projects.find(p => p.id === notif.projectId);
      if (project) {
        if (!widgetStore.openTabs.find(t => t.projectId === notif.projectId)) {
          widgetStore.openProjectTab(project.id, project.title, project.keyColor);
        }
        const tab = widgetStore.openTabs.find(t => t.projectId === notif.projectId);
        if (tab) widgetStore.setActiveTab(tab.id);
        appStore.setPendingChatNavigation({ type: 'project', id: notif.projectId, roomId: notif.roomId });
        appStore.setChatPanelCollapsed(false);
      }
    } else if (notif.type === 'chat' && notif.roomId) {
      if (widgetStore.openMobileGroupChat) {
        widgetStore.openMobileGroupChat(notif.roomId);
      }
    }
  }, [markAppNotificationRead]);

  const handleMarkAllRead = useCallback(() => {
    for (const u of updates) {
      markAppNotificationRead(u.id);
    }
  }, [updates, markAppNotificationRead]);

  const iconForType = (type: string) => {
    switch (type) {
      case 'chat': return MessageSquare;
      case 'todo': return ListTodo;
      case 'brain': return Brain;
      default: return Bell;
    }
  };

  const colorForType = (type: string) => {
    switch (type) {
      case 'chat': return 'text-blue-500';
      case 'todo': return 'text-emerald-500';
      case 'brain': return 'text-amber-500';
      default: return 'text-muted-foreground';
    }
  };

  const bgForType = (type: string) => {
    switch (type) {
      case 'chat': return 'bg-blue-500/10';
      case 'todo': return 'bg-emerald-500/10';
      case 'brain': return 'bg-amber-500/10';
      default: return 'bg-muted/50';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            {t('updates') || (t('language') === 'ko' ? '업데이트' : 'Updates')}
          </h3>
          {updates.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
              {updates.length}
            </span>
          )}
        </div>
        {updates.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Check className="w-3 h-3" />
            {t('markAllRead') || (t('language') === 'ko' ? '모두 읽음' : 'Mark all read')}
          </button>
        )}
      </div>

      {/* Summary badges */}
      {updates.length > 0 && Object.keys(summary).length > 1 && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/30">
          {summary.chat && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
              <MessageSquare className="w-2.5 h-2.5" /> {summary.chat}
            </span>
          )}
          {summary.todo && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
              <ListTodo className="w-2.5 h-2.5" /> {summary.todo}
            </span>
          )}
          {summary.brain && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
              <Brain className="w-2.5 h-2.5" /> {summary.brain}
            </span>
          )}
        </div>
      )}

      {/* Updates list */}
      <div className="flex-1 overflow-y-auto">
        {updates.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-sm text-muted-foreground/50">
              {t('language') === 'ko' ? '조용한 하루예요 ✨' : 'All quiet today ✨'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {updates.map((notif) => {
              const Icon = iconForType(notif.type);
              return (
                <button
                  key={notif.id}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/50 active:bg-accent transition-colors text-left"
                  onClick={() => handleClick(notif)}
                >
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', bgForType(notif.type))}>
                    <Icon className={cn('w-3.5 h-3.5', colorForType(notif.type))} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-foreground/80 truncate">{notif.title}</p>
                    {notif.message && (
                      <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{notif.message}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/30 mt-1">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 shrink-0 mt-2" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default UpdatesWidget;
