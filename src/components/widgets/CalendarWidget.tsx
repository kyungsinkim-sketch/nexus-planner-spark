/**
 * CalendarWidget — Full-featured calendar with event interactions.
 * Frameless: rendered directly inside widget glass (no WidgetContainer).
 *
 * Features:
 * - Event click → EventSidePanel popup
 * - Date select → NewEventModal
 * - Drag & drop to reschedule events
 * - Event resize to adjust duration
 */

import { useState, useMemo, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useAppStore } from '@/stores/appStore';
import { subscribeToEvents } from '@/services/eventService';
import { EventSidePanel } from '@/components/calendar/EventSidePanel';
import { NewEventModal } from '@/components/project/NewEventModal';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/types/core';
import type { WidgetDataContext } from '@/types/widget';

function CalendarWidget({ context }: { context: WidgetDataContext }) {
  const { events, getProjectById, updateEvent, deleteEvent, loadEvents } = useAppStore();

  // Subscribe to realtime calendar_events changes so brain-created events
  // appear without page refresh
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event, eventType) => {
      console.log('[CalendarWidget] Realtime event:', eventType, event?.id, event?.title);
      loadEvents();
    });
    return () => unsubscribe();
  }, [loadEvents]);

  // Also refresh events periodically when the widget mounts or regains focus
  useEffect(() => {
    loadEvents();
    const onFocus = () => loadEvents();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadEvents]);

  // Event detail panel
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // New/edit event modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [newEventDate, setNewEventDate] = useState<string | undefined>();
  const [newEventStartTime, setNewEventStartTime] = useState<string | undefined>();
  const [newEventEndTime, setNewEventEndTime] = useState<string | undefined>();

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

  // Event click → open side panel
  const handleEventClick = (info: { event: { id: string } }) => {
    const event = events.find((e) => e.id === info.event.id);
    if (event) {
      setSelectedEvent(event);
      setIsPanelOpen(true);
    }
  };

  // Date range select → open new event modal
  // IMPORTANT: Use local date components, NOT toISOString() which converts to UTC
  // and shifts the date backward in KST (UTC+9). e.g., Feb 16 00:00 KST → Feb 15 15:00 UTC
  const handleSelect = (info: { start: Date; end: Date }) => {
    setEditingEvent(undefined);
    const y = info.start.getFullYear();
    const m = String(info.start.getMonth() + 1).padStart(2, '0');
    const d = String(info.start.getDate()).padStart(2, '0');
    setNewEventDate(`${y}-${m}-${d}`);
    setNewEventStartTime(info.start.toTimeString().slice(0, 5));
    setNewEventEndTime(info.end.toTimeString().slice(0, 5));
    setShowEventModal(true);
  };

  // Drag & drop → reschedule
  const handleEventDrop = (info: { event: { id: string; title: string; start: Date | null; end: Date | null }; view: { type: string } }) => {
    const originalEvent = events.find((e) => e.id === info.event.id);
    const newStart = info.event.start;
    if (!newStart || !originalEvent) return;

    if (info.view.type === 'dayGridMonth') {
      const origStart = new Date(originalEvent.startAt);
      const origEnd = new Date(originalEvent.endAt);
      const duration = origEnd.getTime() - origStart.getTime();
      const updatedStart = new Date(newStart);
      updatedStart.setHours(origStart.getHours(), origStart.getMinutes(), origStart.getSeconds());
      const updatedEnd = new Date(updatedStart.getTime() + duration);

      updateEvent(info.event.id, {
        startAt: updatedStart.toISOString(),
        endAt: updatedEnd.toISOString(),
      });
      toast.success(`"${info.event.title}" → ${updatedStart.toLocaleDateString()}`);
    } else {
      updateEvent(info.event.id, {
        startAt: newStart.toISOString(),
        endAt: (info.event.end || newStart).toISOString(),
      });
      toast.success(`"${info.event.title}" rescheduled`);
    }
  };

  // Resize → change duration
  const handleEventResize = (info: { event: { id: string; title: string; start: Date | null; end: Date | null } }) => {
    const newStart = info.event.start?.toISOString();
    const newEnd = info.event.end?.toISOString();
    if (newStart) {
      updateEvent(info.event.id, { startAt: newStart, endAt: newEnd || newStart });
      toast.success(`"${info.event.title}" duration updated`);
    }
  };

  // Edit from side panel
  const handleEditEvent = (event: CalendarEvent) => {
    setIsPanelOpen(false);
    setEditingEvent(event);
    setNewEventDate(event.startAt.split('T')[0]);
    setNewEventStartTime(new Date(event.startAt).toTimeString().slice(0, 5));
    setNewEventEndTime(new Date(event.endAt).toTimeString().slice(0, 5));
    setShowEventModal(true);
  };

  // Delete from side panel
  const handleDeleteEvent = (event: CalendarEvent) => {
    deleteEvent(event.id);
    setIsPanelOpen(false);
    setSelectedEvent(null);
    toast.success(`"${event.title}" deleted`);
  };

  return (
    <>
      <div className="h-full overflow-hidden text-xs calendar-widget-content">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listDay',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            list: 'List',
          }}
          events={calendarEvents}
          height="100%"
          dayMaxEvents={2}
          nowIndicator={true}
          titleFormat={{ year: 'numeric', month: 'short' }}
          editable={true}
          selectable={true}
          selectMirror={true}
          eventClick={handleEventClick}
          select={handleSelect}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
        />
      </div>

      {/* Event Detail Panel */}
      <EventSidePanel
        event={selectedEvent}
        isOpen={isPanelOpen}
        onClose={() => { setIsPanelOpen(false); setSelectedEvent(null); }}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />

      {/* New/Edit Event Modal */}
      <NewEventModal
        open={showEventModal}
        onClose={() => { setShowEventModal(false); setEditingEvent(undefined); }}
        projectId={context.projectId || ''}
        defaultDate={newEventDate}
        defaultStartTime={newEventStartTime}
        defaultEndTime={newEventEndTime}
        editEvent={editingEvent}
      />
    </>
  );
}

export default CalendarWidget;
