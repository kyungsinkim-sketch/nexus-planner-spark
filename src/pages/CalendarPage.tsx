import React, { useState, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useAppStore } from '@/stores/appStore';
import { CalendarEvent, EventType } from '@/types/core';
import { Plus, Filter, ChevronDown, Settings, Download, ExternalLink, CheckSquare, AlertCircle, Users, Presentation, Truck, ListTodo, FileText, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { EventSidePanel } from '@/components/calendar/EventSidePanel';
import { NewEventModal } from '@/components/project/NewEventModal';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/i18n';
import { subscribeToEvents } from '@/services/eventService';

// Event type icons (pictograms)
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

// Event type colors (fallback if no project key color)
const eventTypeColors: Record<EventType, string> = {
  TASK: 'fc-event-task',
  DEADLINE: 'fc-event-deadline',
  MEETING: 'fc-event-meeting',
  PT: 'fc-event-pt',
  DELIVERY: 'fc-event-delivery',
  TODO: 'fc-event-todo',
  DELIVERABLE: 'fc-event-delivery',
  R_TRAINING: 'fc-event-training',
};

const eventTypeBadgeKeys: Record<EventType, { labelKey: TranslationKey; className: string }> = {
  TASK: { labelKey: 'task', className: 'event-badge event-badge-task' },
  DEADLINE: { labelKey: 'deadline', className: 'event-badge event-badge-deadline' },
  MEETING: { labelKey: 'meeting', className: 'event-badge event-badge-meeting' },
  PT: { labelKey: 'pt', className: 'event-badge event-badge-pt' },
  DELIVERY: { labelKey: 'delivery', className: 'event-badge event-badge-delivery' },
  TODO: { labelKey: 'todo', className: 'event-badge event-badge-todo' },
  DELIVERABLE: { labelKey: 'deliverable', className: 'event-badge event-badge-delivery' },
  R_TRAINING: { labelKey: 'renatus', className: 'event-badge event-badge-training' },
};

function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className}>
      <rect x="3" y="3" width="12" height="12" rx="1.5" fill="#4285F4" />
      <rect x="3" y="3" width="12" height="3" rx="1" fill="#1A73E8" />
      <line x1="6" y1="8" x2="12" y2="8" stroke="white" strokeWidth="1" />
      <line x1="6" y1="11" x2="10" y2="11" stroke="white" strokeWidth="1" />
    </svg>
  );
}

export default function CalendarPage() {
  const { events, getProjectById, deleteEvent, updateEvent, loadEvents } = useAppStore();
  const calendarRef = useRef<FullCalendar>(null);
  const { t } = useTranslation();
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>(['TASK', 'DEADLINE', 'MEETING', 'PT', 'DELIVERY', 'TODO', 'DELIVERABLE', 'R_TRAINING']);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentView, setCurrentView] = useState<string>('dayGridMonth');

  // Realtime subscription — refresh events when calendar_events table changes
  useEffect(() => {
    const unsubscribe = subscribeToEvents(() => {
      // When any calendar event is inserted/updated/deleted, reload all events
      loadEvents();
    });
    return () => {
      unsubscribe();
    };
  }, [loadEvents]);

  // New event modal state
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEventDate, setNewEventDate] = useState<string | undefined>();
  const [newEventStartTime, setNewEventStartTime] = useState<string | undefined>();
  const [newEventEndTime, setNewEventEndTime] = useState<string | undefined>();
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsPanelOpen(false);
    setSelectedEvent(null);
    setShowNewEventModal(true);
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (confirm('Delete this event?')) {
      try {
        await deleteEvent(event.id);
        toast.success('Event deleted');
        setIsPanelOpen(false);
        setSelectedEvent(null);
      } catch (error) {
        console.error('Failed to delete event:', error);
        toast.error('Failed to delete event');
      }
    }
  };

  const filteredEvents = events.filter((e) => {
    const typeMatch = selectedTypes.includes(e.type);
    const sourceMatch = showGoogleEvents || e.source !== 'GOOGLE';
    return typeMatch && sourceMatch;
  });

  const googleEventCount = events.filter((e) => e.source === 'GOOGLE').length;

  const calendarEvents = filteredEvents.map((event) => {
    const project = event.projectId ? getProjectById(event.projectId) : null;
    const isGoogleEvent = event.source === 'GOOGLE';

    // Use project key color if available, otherwise use event type color
    const backgroundColor = project?.keyColor || undefined;
    const className = `${!backgroundColor ? eventTypeColors[event.type] : ''} ${isGoogleEvent ? 'fc-event-google' : ''}`;

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
        projectTitle: project?.title,
        source: event.source,
        icon: eventTypeIcons[event.type],
      },
    };
  });

  const toggleEventType = (type: EventType) => {
    setSelectedTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };

  const handleEventClick = (info: { event: { id: string } }) => {
    const event = events.find((e) => e.id === info.event.id);
    if (event) { setSelectedEvent(event); setIsPanelOpen(true); }
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

  // Handle drag & drop in month view (change date only, keep time)
  // Handle drag & drop in week/day view (change date + time)
  const handleEventDrop = (info: { event: { id: string; title: string; start: Date | null; end: Date | null }; view: { type: string } }) => {
    const eventId = info.event.id;
    const originalEvent = events.find((e) => e.id === eventId);
    const newStart = info.event.start;
    const newEnd = info.event.end;

    if (!newStart || !originalEvent) return;

    if (info.view.type === 'dayGridMonth') {
      // Month view: keep original time and duration, only change date
      const origStart = new Date(originalEvent.startAt);
      const origEnd = new Date(originalEvent.endAt);
      const duration = origEnd.getTime() - origStart.getTime();

      // Set new start: take dropped date, keep original hours/minutes/seconds
      const updatedStart = new Date(newStart);
      updatedStart.setHours(origStart.getHours(), origStart.getMinutes(), origStart.getSeconds(), origStart.getMilliseconds());

      // Set new end: simply add original duration to new start
      const updatedEnd = new Date(updatedStart.getTime() + duration);

      updateEvent(eventId, {
        startAt: updatedStart.toISOString(),
        endAt: updatedEnd.toISOString(),
      });

      toast.success('Event rescheduled', {
        description: `"${info.event.title}" moved to ${updatedStart.toLocaleDateString()}`,
      });
    } else {
      // Week/Day view: update both date and time
      updateEvent(eventId, {
        startAt: newStart.toISOString(),
        endAt: (newEnd || newStart).toISOString(),
      });

      toast.success('Event rescheduled', {
        description: `"${info.event.title}" moved to ${newStart.toLocaleString()}`,
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

  // Handle view change
  const handleViewChange = (viewInfo: { view: { type: string } }) => {
    setCurrentView(viewInfo.view.type);
  };

  // Handle New Event button click
  const handleNewEventClick = () => {
    setNewEventDate(undefined);
    setNewEventStartTime(undefined);
    setNewEventEndTime(undefined);
    setShowNewEventModal(true);
  };

  // Export to Google Calendar
  const handleExportToGoogle = () => {
    // Generate ICS file content
    const icsEvents = events
      .filter(e => e.source === 'PAULUS')
      .map(event => {
        const startDate = new Date(event.startAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const endDate = new Date(event.endAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        return `BEGIN:VEVENT
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${event.title}
DESCRIPTION:Event from Re-Be.io
END:VEVENT`;
      }).join('\n');

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Re-Be.io//Calendar Export//EN
${icsEvents}
END:VCALENDAR`;

    // Download ICS file
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rebe-calendar-export.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t('export'), {
      description: 'Import the .ics file into Google Calendar to sync your events',
    });
  };

  const todayEvents = events.filter((e) => new Date(e.startAt).toDateString() === new Date().toDateString());

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('calendar')}</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your schedule and project timelines</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />{t('filter')}<ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(Object.keys(eventTypeBadgeKeys) as EventType[]).map((type) => (
                <DropdownMenuItem key={type} onClick={() => toggleEventType(type)} className="gap-2">
                  <div className={`w-3 h-3 rounded-full ${selectedTypes.includes(type) ? 'bg-primary' : 'bg-muted'}`} />
                  {t(eventTypeBadgeKeys[type].labelKey)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowGoogleEvents(!showGoogleEvents)} className="gap-2">
                <div className={`w-3 h-3 rounded-full ${showGoogleEvents ? 'bg-blue-500' : 'bg-muted'}`} />
                <GoogleCalendarIcon className="w-4 h-4" />Google ({googleEventCount})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />{t('export')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportToGoogle} className="gap-2">
                <GoogleCalendarIcon className="w-4 h-4" />
                {t('exportToGoogle')}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Export as ICS file
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                  <Link to="/settings"><Settings className="w-4 h-4" /></Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('settings')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" className="gap-2" onClick={handleNewEventClick}>
            <Plus className="w-4 h-4" />{t('newEvent')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(eventTypeBadgeKeys) as EventType[]).map((type) => {
          const EventIcon = eventTypeIcons[type];
          const isSelected = selectedTypes.includes(type);
          
          return (
            <button 
              key={type} 
              onClick={() => toggleEventType(type)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                isSelected 
                  ? 'bg-foreground text-background border-foreground' 
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
              }`}
            >
              <EventIcon className="w-3.5 h-3.5" />
              {t(eventTypeBadgeKeys[type].labelKey)}
            </button>
          );
        })}
        <button onClick={() => setShowGoogleEvents(!showGoogleEvents)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
            showGoogleEvents 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
          }`}>
          <GoogleCalendarIcon className="w-3.5 h-3.5" />Google
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="p-2 sm:p-4 shadow-card overflow-hidden calendar-view-toggle">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }}
            buttonText={{ today: t('today'), month: t('month'), week: t('week'), day: t('day'), list: t('agenda') }}
            events={calendarEvents}
            editable={true}
            droppable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={2}
            height="auto"
            slotMinTime="07:00:00"
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            select={handleSelect}
            datesSet={handleViewChange}
            eventContent={(eventInfo) => {
              const isGoogle = eventInfo.event.extendedProps.source === 'GOOGLE';
              const EventIcon = eventInfo.event.extendedProps.icon;

              return (
                <div className="px-1 sm:px-1.5 py-0.5 overflow-hidden">
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs font-medium truncate">
                    {isGoogle && <GoogleCalendarIcon className="w-3 h-3 shrink-0" />}
                    {!isGoogle && EventIcon && <EventIcon className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{eventInfo.event.title}</span>
                  </div>
                </div>
              );
            }}
          />
        </Card>

        <div className="space-y-4">
          <Card className="p-4 shadow-card">
            <h3 className="font-semibold text-foreground mb-3">{t('todaysEvents')}</h3>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noEventsToday')}</p>
            ) : (
              <div className="space-y-3">
                {todayEvents.map((event) => {
                  const project = event.projectId ? getProjectById(event.projectId) : null;
                  const isGoogle = event.source === 'GOOGLE';
                  return (
                    <div key={event.id} onClick={() => { setSelectedEvent(event); setIsPanelOpen(true); }}
                      className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                            {isGoogle && <GoogleCalendarIcon className="w-3.5 h-3.5 shrink-0" />}
                            {event.title}
                          </p>
                          {project && <p className="text-xs text-muted-foreground mt-0.5 truncate">{project.title}</p>}
                        </div>
                        <span className={eventTypeBadgeKeys[event.type].className}>{t(eventTypeBadgeKeys[event.type].labelKey)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <EventSidePanel event={selectedEvent} isOpen={isPanelOpen} onClose={() => { setIsPanelOpen(false); setSelectedEvent(null); }} onEdit={handleEditEvent} onDelete={handleDeleteEvent} />

      <NewEventModal
        open={showNewEventModal}
        onClose={() => {
          setShowNewEventModal(false);
          setEditingEvent(null);
        }}
        projectId={editingEvent?.projectId || ""}
        editEvent={editingEvent || undefined}
        defaultDate={editingEvent ? undefined : newEventDate}
        defaultStartTime={editingEvent ? undefined : newEventStartTime}
        defaultEndTime={editingEvent ? undefined : newEventEndTime}
      />
    </div>
  );
}
