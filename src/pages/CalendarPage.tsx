import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useAppStore } from '@/stores/appStore';
import { CalendarEvent, EventType } from '@/types/core';
import { Plus, Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

const eventTypeColors: Record<EventType, string> = {
  TASK: 'fc-event-task',
  DEADLINE: 'fc-event-deadline',
  MEETING: 'fc-event-meeting',
  PT: 'fc-event-pt',
  DELIVERY: 'fc-event-delivery',
};

const eventTypeBadges: Record<EventType, { label: string; className: string }> = {
  TASK: { label: 'Task', className: 'event-badge event-badge-task' },
  DEADLINE: { label: 'Deadline', className: 'event-badge event-badge-deadline' },
  MEETING: { label: 'Meeting', className: 'event-badge event-badge-meeting' },
  PT: { label: 'Presentation', className: 'event-badge event-badge-pt' },
  DELIVERY: { label: 'Delivery', className: 'event-badge event-badge-delivery' },
};

export default function CalendarPage() {
  const { events, projects, getProjectById } = useAppStore();
  const [selectedTypes, setSelectedTypes] = useState<EventType[]>([
    'TASK', 'DEADLINE', 'MEETING', 'PT', 'DELIVERY'
  ]);

  const filteredEvents = events.filter((e) => selectedTypes.includes(e.type));

  const calendarEvents = filteredEvents.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.startAt,
    end: event.endAt,
    className: eventTypeColors[event.type],
    extendedProps: {
      type: event.type,
      projectId: event.projectId,
    },
  }));

  const toggleEventType = (type: EventType) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  const todayEvents = events.filter((e) => {
    const eventDate = new Date(e.startAt).toDateString();
    const today = new Date().toDateString();
    return eventDate === today;
  });

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your schedule and project timelines
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Filter
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(Object.keys(eventTypeBadges) as EventType[]).map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => toggleEventType(type)}
                  className="gap-2"
                >
                  <div className={`w-3 h-3 rounded-full ${selectedTypes.includes(type) ? 'bg-primary' : 'bg-muted'}`} />
                  {eventTypeBadges[type].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Event
          </Button>
        </div>
      </div>

      {/* Event Type Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(eventTypeBadges) as EventType[]).map((type) => (
          <button
            key={type}
            onClick={() => toggleEventType(type)}
            className={`${eventTypeBadges[type].className} cursor-pointer transition-opacity ${
              selectedTypes.includes(type) ? 'opacity-100' : 'opacity-40'
            }`}
          >
            {eventTypeBadges[type].label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar */}
        <Card className="p-4 shadow-card">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={calendarEvents}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={3}
            height="auto"
            eventClick={(info) => {
              // Placeholder for event click handler
              console.log('Event clicked:', info.event);
            }}
            select={(info) => {
              // Placeholder for date selection handler
              console.log('Date selected:', info);
            }}
          />
        </Card>

        {/* Today's Events Sidebar */}
        <div className="space-y-4">
          <Card className="p-4 shadow-card">
            <h3 className="font-semibold text-foreground mb-3">Today's Events</h3>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {todayEvents.map((event) => {
                  const project = event.projectId ? getProjectById(event.projectId) : null;
                  return (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {event.title}
                          </p>
                          {project && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {project.title}
                            </p>
                          )}
                        </div>
                        <span className={eventTypeBadges[event.type].className}>
                          {eventTypeBadges[event.type].label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Upcoming Deadlines */}
          <Card className="p-4 shadow-card">
            <h3 className="font-semibold text-foreground mb-3">Upcoming Deadlines</h3>
            <div className="space-y-3">
              {events
                .filter((e) => e.type === 'DEADLINE' && new Date(e.startAt) >= new Date())
                .slice(0, 3)
                .map((event) => {
                  const project = event.projectId ? getProjectById(event.projectId) : null;
                  const daysUntil = Math.ceil(
                    (new Date(event.startAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-medium text-foreground truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground truncate">
                          {project?.title}
                        </p>
                        <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
                          {daysUntil === 0 ? 'Today' : `${daysUntil}d`}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
