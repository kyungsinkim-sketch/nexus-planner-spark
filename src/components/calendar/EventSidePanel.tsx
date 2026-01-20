import { CalendarEvent, EventType } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { X, Calendar, Clock, User, FolderKanban, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

interface EventSidePanelProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

const eventTypeBadges: Record<EventType, { label: string; className: string }> = {
  TASK: { label: 'Task', className: 'event-badge event-badge-task' },
  DEADLINE: { label: 'Deadline', className: 'event-badge event-badge-deadline' },
  MEETING: { label: 'Meeting', className: 'event-badge event-badge-meeting' },
  PT: { label: 'Presentation', className: 'event-badge event-badge-pt' },
  DELIVERY: { label: 'Delivery', className: 'event-badge event-badge-delivery' },
};

export function EventSidePanel({ event, isOpen, onClose }: EventSidePanelProps) {
  const { getProjectById, getUserById } = useAppStore();

  if (!isOpen || !event) return null;

  const project = event.projectId ? getProjectById(event.projectId) : null;
  const owner = getUserById(event.ownerId);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-96 bg-card border-l border-border shadow-lg z-50 animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className={eventTypeBadges[event.type].className}>
            {eventTypeBadges[event.type].label}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <h2 className="text-xl font-semibold text-foreground">{event.title}</h2>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-4">
            {/* Date & Time */}
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {format(new Date(event.startAt), 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(event.startAt), 'h:mm a')} - {format(new Date(event.endAt), 'h:mm a')}
                </p>
              </div>
            </div>

            {/* Project */}
            {project && (
              <div className="flex items-start gap-3">
                <FolderKanban className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{project.title}</p>
                  <p className="text-sm text-muted-foreground">{project.client}</p>
                </div>
              </div>
            )}

            {/* Owner */}
            {owner && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{owner.name}</p>
                  <p className="text-sm text-muted-foreground">{owner.role}</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Quick Actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="justify-start">
                <Clock className="w-4 h-4 mr-2" />
                Reschedule
              </Button>
              <Button variant="outline" size="sm" className="justify-start">
                <User className="w-4 h-4 mr-2" />
                Reassign
              </Button>
            </div>
          </div>

          {/* Project Link */}
          {project && (
            <div className="pt-4">
              <Button variant="secondary" className="w-full" asChild>
                <a href={`/projects/${project.id}`}>
                  View Project Details
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}