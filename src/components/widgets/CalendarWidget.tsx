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

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useAppStore } from '@/stores/appStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/hooks/useTranslation';
import { subscribeToEvents } from '@/services/eventService';
import { EventSidePanel } from '@/components/calendar/EventSidePanel';
import { NewEventModal } from '@/components/project/NewEventModal';
import { toast } from 'sonner';
import type { CalendarEvent } from '@/types/core';
import type { WidgetDataContext } from '@/types/widget';
import { syncGoogleCalendar, getGoogleCalendarStatus } from '@/services/googleCalendarService';
import { isSupabaseConfigured } from '@/lib/supabase';

function CalendarWidget({ context }: { context: WidgetDataContext }) {
  const { events, projects, currentUser, getProjectById, updateEvent, deleteEvent, loadEvents } = useAppStore();
  const isMobile = useIsMobile();
  const { language } = useTranslation();

  // Debounced loadEvents to prevent rapid-fire calls that cause AbortError cascades
  // Use isMounted ref to prevent setState on unmounted component
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const debouncedLoadEvents = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) loadEvents();
    }, 500);
  }, [loadEvents]);

  // Subscribe to realtime calendar_events changes so brain-created events
  // appear without page refresh
  useEffect(() => {
    const unsubscribe = subscribeToEvents((_event, _eventType) => {
      debouncedLoadEvents();
    });
    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [debouncedLoadEvents]);

  // Also refresh events when the widget mounts or regains focus (debounced)
  useEffect(() => {
    loadEvents();
    const onFocus = () => debouncedLoadEvents();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadEvents, debouncedLoadEvents]);

  // Trigger Google Calendar sync on mount to catch deletions & new events
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser) return;
    getGoogleCalendarStatus(currentUser.id).then(status => {
      if (status.isConnected) {
        syncGoogleCalendar(currentUser.id).then(() => loadEvents());
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Event detail panel
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // New/edit event modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [newEventDate, setNewEventDate] = useState<string | undefined>();
  const [newEventStartTime, setNewEventStartTime] = useState<string | undefined>();
  const [newEventEndTime, setNewEventEndTime] = useState<string | undefined>();

  // Build set of project IDs the current user is a member of (for dashboard filtering)
  const myProjectIds = useMemo(() => {
    if (!currentUser) return new Set<string>();
    return new Set(
      projects
        .filter(p => p.teamMemberIds?.includes(currentUser.id))
        .map(p => p.id),
    );
  }, [projects, currentUser]);

  const filteredEvents = useMemo(() => {
    if (context.type === 'project' && context.projectId) {
      return events.filter((e) => e.projectId === context.projectId);
    }
    // Dashboard: show only events relevant to current user
    const userId = currentUser?.id;
    if (userId) {
      return events.filter((e) => {
        const isOwner = e.ownerId === userId;
        const isAttendee = e.attendeeIds?.includes(userId);
        const isTeamProject = e.projectId ? myProjectIds.has(e.projectId) : false;
        return isOwner || isAttendee || isTeamProject;
      });
    }
    return events;
  }, [events, context, currentUser, myProjectIds]);

  const calendarEvents = useMemo(
    () =>
      filteredEvents.map((event) => {
        const project = event.projectId ? getProjectById(event.projectId) : null;
        // R_TRAINING always uses purple; project events use keyColor;
        // Google events use teal; fallback to primary
        const color = event.type === 'R_TRAINING'
          ? 'hsl(270 70% 55%)'
          : project?.keyColor
            || (event.source === 'GOOGLE' ? 'hsl(200 80% 50%)' : 'hsl(234 89% 60%)');
        return {
          id: event.id,
          title: event.title,
          start: event.startAt,
          end: event.endAt,
          allDay: event.startAt?.includes('T00:00:00') && event.endAt?.includes('T23:59:59'),
          backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
          borderColor: color,
          textColor: 'inherit',
          extendedProps: {
            location: event.location,
            type: event.type,
            source: event.source,
            dotColor: color,
          },
        };
      }),
    [filteredEvents, getProjectById],
  );

  // Custom event rendering — desktop: color dot + time + title; mobile: clean title only
  const renderEventContent = (eventInfo: { event: { title: string; extendedProps: { location?: string; type?: string; source?: string; dotColor?: string } }; timeText: string }) => {
    if (isMobile) {
      // Mobile: no colored dot — just time + title for readability
      return (
        <div className="fc-event-inner flex items-center gap-1 px-0.5 overflow-hidden min-w-0">
          {eventInfo.timeText && (
            <span className="text-[10px] text-muted-foreground shrink-0">{eventInfo.timeText}</span>
          )}
          <span className="truncate text-[11px] font-medium text-foreground">{eventInfo.event.title}</span>
        </div>
      );
    }
    // Desktop: color dot + time + title
    return (
      <div className="fc-event-inner flex items-center gap-1 px-0.5 overflow-hidden min-w-0">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: eventInfo.event.extendedProps.dotColor || 'hsl(234 89% 60%)' }}
        />
        {eventInfo.timeText && (
          <span className="text-[10px] text-muted-foreground shrink-0">{eventInfo.timeText}</span>
        )}
        <span className="truncate text-[11px] font-medium text-foreground">{eventInfo.event.title}</span>
      </div>
    );
  };

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
  const handleDeleteEvent = async (event: CalendarEvent) => {
    try {
      await deleteEvent(event.id);
      setIsPanelOpen(false);
      setSelectedEvent(null);
      toast.success(`"${event.title}" deleted`);
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('Failed to delete event');
    }
  };

  return (
    <>
      <div className="h-full overflow-hidden text-xs calendar-widget-content">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
          headerToolbar={isMobile ? {
            left: 'prev,next',
            center: 'title',
            right: 'listWeek,dayGridMonth,timeGridWeek',
          } : {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listDay',
          }}
          views={{
            listWeek: { buttonText: language === 'ko' ? '목록' : 'List' },
            timeGridWeek: { buttonText: language === 'ko' ? '주간' : 'Week' },
            dayGridMonth: { buttonText: language === 'ko' ? '월간' : 'Month' },
            listDay: { buttonText: language === 'ko' ? '일간' : 'Day' },
          }}
          buttonText={{
            today: language === 'ko' ? '오늘' : 'Today',
          }}
          events={calendarEvents}
          eventContent={renderEventContent}
          height="100%"
          dayMaxEvents={false}
          nowIndicator={true}
          titleFormat={{ year: 'numeric', month: 'short' }}
          editable={true}
          selectable={true}
          selectMirror={true}
          allDaySlot={true}
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
