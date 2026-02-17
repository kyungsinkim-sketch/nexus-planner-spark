/**
 * ActionsWidget — Shows next actions / alerts for a project.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { AlertTriangle, Clock } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function ActionsWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const { personalTodos, events } = useAppStore();

  const overdueTodos = useMemo(() => {
    const now = new Date();
    let todos = personalTodos.filter(
      (t) => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < now,
    );
    if (context.type === 'project' && context.projectId) {
      todos = todos.filter((t) => t.projectId === context.projectId);
    }
    return todos.slice(0, 5);
  }, [personalTodos, context]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    let evts = events.filter((e) => {
      const start = new Date(e.startAt);
      return start >= now && start <= next24h;
    });
    if (context.type === 'project' && context.projectId) {
      evts = evts.filter((e) => e.projectId === context.projectId);
    }
    return evts.slice(0, 5);
  }, [events, context]);

  if (overdueTodos.length === 0 && upcomingEvents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        {t('allCaughtUp')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {overdueTodos.map((t) => (
        <div key={t.id} className="flex items-center gap-2 p-1.5 rounded text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
          <span className="truncate text-foreground">{t.title}</span>
          <span className="text-destructive ml-auto shrink-0">Overdue</span>
        </div>
      ))}
      {upcomingEvents.map((e) => (
        <div key={e.id} className="flex items-center gap-2 p-1.5 rounded text-xs">
          <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate text-foreground">{e.title}</span>
          <span className="text-muted-foreground ml-auto shrink-0">
            {new Date(e.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}
    </div>
  );
}

export default ActionsWidget;
