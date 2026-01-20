import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useAppStore } from '@/stores/appStore';
import { CalendarEvent, EventType } from '@/types/core';
import { Plus, Filter, ChevronDown, Settings } from 'lucide-react';
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
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EventSidePanel } from '@/components/calendar/EventSidePanel';

const eventTypeColors: Record<EventType, string> = {
  TASK: 'fc-event-task',
  DEADLINE: 'fc-event-deadline',
  MEETING: 'fc-event-meeting',
  PT: 'fc-event-pt',
  DELIVERY: 'fc-event-delivery',
  TODO: 'fc-event-todo',
  DELIVERABLE: 'fc-event-delivery',
};

const eventTypeBadges: Record<EventType, { label: string; className: string }> = {
  TASK: { label: 'Task', className: 'event-badge event-badge-task' },
  DEADLINE: { label: 'Deadline', className: 'event-badge event-badge-deadline' },
  MEETING: { label: 'Meeting', className: 'event-badge event-badge-meeting' },
  PT: { label: 'Presentation', className: 'event-badge event-badge-pt' },
  DELIVERY: { label: 'Delivery', className: 'event-badge event-badge-delivery' },
  TODO: { label: 'To-do', className: 'event-badge event-badge-todo' },
  DELIVERABLE: { label: 'Deliverable', className: 'event-badge event-badge-delivery' },
};

function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className}>
      <rect x="3" y="3" width="12" height="12" rx="1.5" fill="#4285F4"/>
      <rect x="3" y="3" width="12" height="3" rx="1" fill="#1A73E8"/>
      <line x1="6" y1="8" x2="12" y2="8" stroke="white" strokeWidth="1"/>
      <line x1="6" y1="11" x2="10" y2="11" stroke="white" strokeWidth="1"/>
    </svg>
  );
}

export default function CalendarPage() {
  const { events, getProjectById } = useAppStore();
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>(['TASK', 'DEADLINE', 'MEETING', 'PT', 'DELIVERY', 'TODO', 'DELIVERABLE']);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const filteredEvents = events.filter((e) => {
    const typeMatch = selectedTypes.includes(e.type);
    const sourceMatch = showGoogleEvents || e.source !== 'GOOGLE';
    return typeMatch && sourceMatch;
  });

  const googleEventCount = events.filter((e) => e.source === 'GOOGLE').length;

  const calendarEvents = filteredEvents.map((event) => {
    const project = event.projectId ? getProjectById(event.projectId) : null;
    const isGoogleEvent = event.source === 'GOOGLE';
    return {
      id: event.id,
      title: event.title,
      start: event.startAt,
      end: event.endAt,
      className: `${eventTypeColors[event.type]} ${isGoogleEvent ? 'fc-event-google' : ''}`,
      extendedProps: { type: event.type, projectTitle: project?.title, source: event.source },
    };
  });

  const toggleEventType = (type: EventType) => {
    setSelectedTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  };

  const handleEventClick = (info: any) => {
    const event = events.find((e) => e.id === info.event.id);
    if (event) { setSelectedEvent(event); setIsPanelOpen(true); }
  };

  const todayEvents = events.filter((e) => new Date(e.startAt).toDateString() === new Date().toDateString());

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your schedule and project timelines</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />Filter<ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(Object.keys(eventTypeBadges) as EventType[]).map((type) => (
                <DropdownMenuItem key={type} onClick={() => toggleEventType(type)} className="gap-2">
                  <div className={`w-3 h-3 rounded-full ${selectedTypes.includes(type) ? 'bg-primary' : 'bg-muted'}`} />
                  {eventTypeBadges[type].label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowGoogleEvents(!showGoogleEvents)} className="gap-2">
                <div className={`w-3 h-3 rounded-full ${showGoogleEvents ? 'bg-blue-500' : 'bg-muted'}`} />
                <GoogleCalendarIcon className="w-4 h-4" />Google ({googleEventCount})
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
              <TooltipContent>Calendar Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="sm" className="gap-2"><Plus className="w-4 h-4" />New Event</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(eventTypeBadges) as EventType[]).map((type) => (
          <button key={type} onClick={() => toggleEventType(type)}
            className={`${eventTypeBadges[type].className} cursor-pointer transition-opacity ${selectedTypes.includes(type) ? 'opacity-100' : 'opacity-40'}`}>
            {eventTypeBadges[type].label}
          </button>
        ))}
        <button onClick={() => setShowGoogleEvents(!showGoogleEvents)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity cursor-pointer ${showGoogleEvents ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 opacity-100' : 'bg-muted text-muted-foreground border-border opacity-40'}`}>
          <GoogleCalendarIcon className="w-3.5 h-3.5" />Google
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="p-2 sm:p-4 shadow-card overflow-hidden">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }}
            buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'Agenda' }}
            events={calendarEvents}
            editable={true}
            selectable={true}
            dayMaxEvents={2}
            height="auto"
            eventClick={handleEventClick}
            eventContent={(eventInfo) => {
              const isGoogle = eventInfo.event.extendedProps.source === 'GOOGLE';
              return (
                <div className="px-1 sm:px-1.5 py-0.5 overflow-hidden">
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs font-medium truncate">
                    {isGoogle && <GoogleCalendarIcon className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{eventInfo.event.title}</span>
                  </div>
                </div>
              );
            }}
          />
        </Card>

        <div className="space-y-4">
          <Card className="p-4 shadow-card">
            <h3 className="font-semibold text-foreground mb-3">Today's Events</h3>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events scheduled for today</p>
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
                        <span className={eventTypeBadges[event.type].className}>{eventTypeBadges[event.type].label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <EventSidePanel event={selectedEvent} isOpen={isPanelOpen} onClose={() => { setIsPanelOpen(false); setSelectedEvent(null); }} />
    </div>
  );
}
