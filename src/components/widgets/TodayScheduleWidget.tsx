/**
 * TodayScheduleWidget — Shows today's events in a detailed timeline view.
 * Displays all events for today with time, title, project color, and location.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { CalendarCheck, MapPin, Clock } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function TodayScheduleWidget({ context }: { context: WidgetDataContext }) {
  const { events, getProjectById } = useAppStore();
  const { t } = useTranslation();

  const todayEvents = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return events
      .filter((e) => {
        if (context.type === 'project' && context.projectId) {
          if (e.projectId !== context.projectId) return false;
        }
        // Check if event overlaps with today
        const startDate = e.startAt.split('T')[0];
        const endDate = e.endAt.split('T')[0];
        return startDate <= todayStr && endDate >= todayStr;
      })
      .sort((a, b) => {
        // All-day events first, then by start time
        const aAllDay = a.startAt.includes('T00:00:00');
        const bAllDay = b.startAt.includes('T00:00:00');
        if (aAllDay && !bAllDay) return -1;
        if (!aAllDay && bAllDay) return 1;
        return a.startAt.localeCompare(b.startAt);
      });
  }, [events, context]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const isAllDay = (event: typeof todayEvents[0]) => {
    return event.startAt.includes('T00:00:00') && event.endAt.includes('T23:59:59');
  };

  const isCurrentEvent = (event: typeof todayEvents[0]) => {
    const now = new Date();
    return new Date(event.startAt) <= now && new Date(event.endAt) >= now;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {todayEvents.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <CalendarCheck className="w-8 h-8 opacity-40" />
          <p className="text-sm">{t('allCaughtUp')}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {todayEvents.map((event) => {
            const project = event.projectId ? getProjectById(event.projectId) : null;
            const color = project?.keyColor
              || (event.source === 'GOOGLE' ? 'hsl(200 80% 50%)' : 'hsl(234 89% 60%)');
            const isCurrent = !isAllDay(event) && isCurrentEvent(event);

            return (
              <div
                key={event.id}
                className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                  isCurrent
                    ? 'bg-primary/8 ring-1 ring-primary/20'
                    : 'hover:bg-muted/50'
                }`}
              >
                {/* Color bar */}
                <div
                  className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: color }}
                />

                <div className="flex-1 min-w-0">
                  {/* Time */}
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span className="text-[11px] font-medium">
                      {isAllDay(event)
                        ? (t('allDay') || '종일')
                        : `${formatTime(event.startAt)} – ${formatTime(event.endAt)}`
                      }
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        NOW
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <p className="text-sm font-medium text-foreground truncate">
                    {event.title}
                  </p>

                  {/* Project name + location */}
                  <div className="flex items-center gap-2 mt-0.5">
                    {project && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                          color: color,
                        }}
                      >
                        {project.name}
                      </span>
                    )}
                    {event.source === 'GOOGLE' && !project && (
                      <span className="text-[10px] font-medium text-sky-600 bg-sky-500/10 px-1.5 py-0.5 rounded">
                        Google
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground truncate">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TodayScheduleWidget;
