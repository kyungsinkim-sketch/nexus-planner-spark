import { useState, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { CalendarEvent, EventType } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EventSidePanel } from '@/components/calendar/EventSidePanel';
import { CalendarEventFilter } from './CalendarEventFilter';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectCalendarTabProps {
  projectId: string;
}

const eventTypeColors: Record<EventType, string> = {
  TASK: 'fc-event-task',
  DEADLINE: 'fc-event-deadline',
  MEETING: 'fc-event-meeting',
  PT: 'fc-event-pt',
  DELIVERY: 'fc-event-delivery',
};

export function ProjectCalendarTab({ projectId }: ProjectCalendarTabProps) {
  const { getEventsByProject, updateEvent } = useAppStore();
  const projectEvents = getEventsByProject(projectId);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>(['TASK', 'DEADLINE', 'MEETING', 'PT', 'DELIVERY']);

  // Calculate event counts by type
  const eventCounts = useMemo(() => {
    return projectEvents.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<EventType, number>);
  }, [projectEvents]);

  // Filter events by selected types
  const filteredEvents = useMemo(() => {
    return projectEvents.filter((event) => selectedTypes.includes(event.type));
  }, [projectEvents, selectedTypes]);

  const calendarEvents = filteredEvents.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.startAt,
    end: event.endAt,
    className: eventTypeColors[event.type],
    extendedProps: {
      type: event.type,
      ownerId: event.ownerId,
    },
  }));

  const handleToggleType = (type: EventType) => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        // Don't allow deselecting all types
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleEventClick = (info: any) => {
    const eventId = info.event.id;
    const event = projectEvents.find((e) => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setIsPanelOpen(true);
    }
  };

  const handleEventDrop = (info: any) => {
    const eventId = info.event.id;
    const newStart = info.event.start?.toISOString();
    const newEnd = info.event.end?.toISOString() || newStart;

    if (newStart) {
      updateEvent(eventId, {
        startAt: newStart,
        endAt: newEnd || newStart,
      });
      
      toast.success('Event rescheduled', {
        description: `"${info.event.title}" moved to ${new Date(newStart).toLocaleDateString()}`,
      });
    }
  };

  const handleEventResize = (info: any) => {
    const eventId = info.event.id;
    const newStart = info.event.start?.toISOString();
    const newEnd = info.event.end?.toISOString();

    if (newStart) {
      updateEvent(eventId, {
        startAt: newStart,
        endAt: newEnd || newStart,
      });
      
      toast.success('Event duration updated', {
        description: `"${info.event.title}" duration changed`,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <CalendarEventFilter
          selectedTypes={selectedTypes}
          onToggleType={handleToggleType}
          eventCounts={eventCounts}
        />
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {filteredEvents.length} of {projectEvents.length} events
          </p>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Event
          </Button>
        </div>
      </div>

      <Card className="p-4 shadow-card">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            list: 'Agenda',
          }}
          events={calendarEvents}
          editable={true}
          droppable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={3}
          height="auto"
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventContent={(eventInfo) => (
            <div className="px-1.5 py-0.5 overflow-hidden cursor-pointer">
              <div className="text-xs font-medium truncate">{eventInfo.event.title}</div>
            </div>
          )}
        />
      </Card>

      <EventSidePanel
        event={selectedEvent}
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          setSelectedEvent(null);
        }}
      />
    </div>
  );
}
