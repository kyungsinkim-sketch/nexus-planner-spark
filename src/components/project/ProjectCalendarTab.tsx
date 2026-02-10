import React from 'react';
import { useState, useMemo, useRef } from 'react';
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
import { NewEventModal } from './NewEventModal';
import { Plus, CheckSquare, AlertCircle, Users, Presentation, Truck, ListTodo, FileText, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectCalendarTabProps {
  projectId: string;
}

// Event type icons (pictograms) - same as main calendar
const eventTypeIcons: Record<EventType, React.ComponentType<{ className?: string }>> = {
  TASK: CheckSquare,
  DEADLINE: AlertCircle,
  MEETING: Users,
  PT: Presentation,
  DELIVERY: Truck,
  TODO: ListTodo,
  DELIVERABLE: FileText,
  R_TRAINING: Dumbbell,
};

// Fallback colors if project has no key color
const eventTypeColors: Record<EventType, string> = {
  TASK: 'fc-event-task',
  DEADLINE: 'fc-event-deadline',
  MEETING: 'fc-event-meeting',
  PT: 'fc-event-pt',
  DELIVERY: 'fc-event-delivery',
  TODO: 'fc-event-task',
  DELIVERABLE: 'fc-event-delivery',
  R_TRAINING: 'fc-event-training',
};

export function ProjectCalendarTab({ projectId }: ProjectCalendarTabProps) {
  const { getEventsByProject, updateEvent, getProjectById } = useAppStore();
  const projectEvents = getEventsByProject(projectId);
  const project = getProjectById(projectId);
  const calendarRef = useRef<FullCalendar>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>(['TASK', 'DEADLINE', 'MEETING', 'PT', 'DELIVERY', 'TODO', 'DELIVERABLE', 'R_TRAINING']);
  const [currentView, setCurrentView] = useState<string>('dayGridMonth');

  // New event modal state
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEventDate, setNewEventDate] = useState<string | undefined>();
  const [newEventStartTime, setNewEventStartTime] = useState<string | undefined>();
  const [newEventEndTime, setNewEventEndTime] = useState<string | undefined>();

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

  // Use project key color for all events, fallback to event type colors
  const calendarEvents = filteredEvents.map((event) => {
    const backgroundColor = project?.keyColor || undefined;
    const className = !backgroundColor ? eventTypeColors[event.type] : '';

    return {
      id: event.id,
      title: event.title,
      start: event.startAt,
      end: event.endAt,
      className,
      backgroundColor,
      borderColor: backgroundColor,
      extendedProps: {
        type: event.type,
        ownerId: event.ownerId,
        icon: eventTypeIcons[event.type],
      },
    };
  });

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

  const handleEventClick = (info: { event: { id: string } }) => {
    const eventId = info.event.id;
    const event = projectEvents.find((e) => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setIsPanelOpen(true);
    }
  };

  const handleEventDrop = (info: { event: { id: string; title: string; start: Date | null; end: Date | null } }) => {
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

  const handleEventResize = (info: { event: { id: string; title: string; start: Date | null; end: Date | null } }) => {
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

  // Handle double-click on date (month view)
  const handleDateClick = (_info: { date: Date }) => {
    // Only trigger on double-click-like behavior by using select
  };

  // Handle date selection (for creating events)
  const handleSelect = (info: { start: Date; end: Date }) => {
    const startDate = info.start;
    const endDate = info.end;

    const dateStr = startDate.toISOString().split('T')[0];
    const startTimeStr = startDate.toTimeString().slice(0, 5);
    const endTimeStr = endDate.toTimeString().slice(0, 5);

    setNewEventDate(dateStr);
    setNewEventStartTime(startTimeStr);
    setNewEventEndTime(endTimeStr);
    setShowNewEventModal(true);
  };

  // Handle view change to track current view
  const handleViewChange = (viewInfo: { view: { type: string } }) => {
    setCurrentView(viewInfo.view.type);
  };

  // Handle Today button click
  const handleTodayClick = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().today();
    }
  };

  // Open new event modal with default date
  const handleAddEventClick = () => {
    setNewEventDate(undefined);
    setNewEventStartTime(undefined);
    setNewEventEndTime(undefined);
    setShowNewEventModal(true);
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
          <Button size="sm" className="gap-2" onClick={handleAddEventClick}>
            <Plus className="w-4 h-4" />
            Add Event
          </Button>
        </div>
      </div>

      <Card className="p-4 shadow-card project-calendar">
        <FullCalendar
          ref={calendarRef}
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
          select={handleSelect}
          datesSet={handleViewChange}
          eventContent={(eventInfo) => {
            const EventIcon = eventInfo.event.extendedProps.icon;

            return (
              <div className="px-1 sm:px-1.5 py-0.5 overflow-hidden">
                <div className="flex items-center gap-1 text-[10px] sm:text-xs font-medium truncate">
                  {EventIcon && <EventIcon className="w-3 h-3 shrink-0" />}
                  <span className="truncate">{eventInfo.event.title}</span>
                </div>
              </div>
            );
          }}
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

      <NewEventModal
        open={showNewEventModal}
        onClose={() => setShowNewEventModal(false)}
        projectId={projectId}
        defaultDate={newEventDate}
        defaultStartTime={newEventStartTime}
        defaultEndTime={newEventEndTime}
      />
    </div>
  );
}
