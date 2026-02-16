/**
 * CalendarWidget — Shows calendar events.
 * Dashboard: all events. Project: project-specific events.
 */

import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import { useAppStore } from '@/stores/appStore';
import type { WidgetDataContext } from '@/types/widget';

function CalendarWidget({ context }: { context: WidgetDataContext }) {
  const { events, getProjectById } = useAppStore();

  const filteredEvents = useMemo(() => {
    if (context.type === 'project' && context.projectId) {
      return events.filter((e) => e.projectId === context.projectId);
    }
    return events;
  }, [events, context]);

  const calendarEvents = useMemo(
    () =>
      filteredEvents.map((event) => {
        const project = event.projectId ? getProjectById(event.projectId) : null;
        return {
          id: event.id,
          title: event.title,
          start: event.startAt,
          end: event.endAt,
          backgroundColor: project?.keyColor || undefined,
          borderColor: project?.keyColor || undefined,
        };
      }),
    [filteredEvents, getProjectById],
  );

  return (
    <div className="h-full overflow-auto text-xs">
      <FullCalendar
        plugins={[dayGridPlugin, listPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next',
          center: 'title',
          right: 'dayGridMonth,listWeek',
        }}
        events={calendarEvents}
        height="100%"
        dayMaxEvents={2}
        titleFormat={{ year: 'numeric', month: 'short' }}
      />
    </div>
  );
}

export default CalendarWidget;
