import { CalendarEvent, EventType } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { X, Calendar, Clock, User, FolderKanban, Edit, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/i18n';

interface EventSidePanelProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

const eventTypeBadgeKeys: Record<EventType, { labelKey: TranslationKey; className: string }> = {
  TASK: { labelKey: 'task', className: 'event-badge event-badge-task' },
  DEADLINE: { labelKey: 'deadline', className: 'event-badge event-badge-deadline' },
  MEETING: { labelKey: 'meeting', className: 'event-badge event-badge-meeting' },
  PT: { labelKey: 'pt', className: 'event-badge event-badge-pt' },
  DELIVERY: { labelKey: 'delivery', className: 'event-badge event-badge-delivery' },
  TODO: { labelKey: 'todo', className: 'event-badge event-badge-task' },
  DELIVERABLE: { labelKey: 'deliverable', className: 'event-badge event-badge-delivery' },
  R_TRAINING: { labelKey: 'renatus', className: 'event-badge event-badge-training' },
};

// Google Calendar Icon SVG
function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#4285F4" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10 10-4.48 10-10z" opacity="0.2"/>
      <path fill="#4285F4" d="M12 6v6l4 2"/>
      <path fill="#EA4335" d="M17.5 7.5l-1 1"/>
      <path fill="#FBBC04" d="M6.5 16.5l1-1"/>
      <path fill="#34A853" d="M16.5 16.5l-1-1"/>
      <rect x="7" y="7" width="10" height="10" rx="1" fill="none" stroke="#4285F4" strokeWidth="1.5"/>
      <line x1="7" y1="10" x2="17" y2="10" stroke="#4285F4" strokeWidth="1"/>
      <line x1="10" y1="7" x2="10" y2="17" stroke="#4285F4" strokeWidth="0.5" opacity="0.5"/>
      <line x1="14" y1="7" x2="14" y2="17" stroke="#4285F4" strokeWidth="0.5" opacity="0.5"/>
    </svg>
  );
}

export function EventSidePanel({ event, isOpen, onClose }: EventSidePanelProps) {
  const { getProjectById, getUserById } = useAppStore();
  const { t } = useTranslation();

  if (!isOpen || !event) return null;

  const project = event.projectId ? getProjectById(event.projectId) : null;
  const owner = getUserById(event.ownerId);
  const isGoogleEvent = event.source === 'GOOGLE';
  const attendees = event.attendeeIds?.map(id => getUserById(id)).filter(Boolean) || [];

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

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
          <div className="flex items-center gap-2">
            <span className={eventTypeBadgeKeys[event.type].className}>
              {t(eventTypeBadgeKeys[event.type].labelKey)}
            </span>
            {/* Source Badge */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`gap-1 text-[10px] px-1.5 py-0 ${
                      isGoogleEvent
                        ? 'border-blue-500/30 text-blue-600 bg-blue-500/10'
                        : 'border-primary/30 text-primary bg-primary/10'
                    }`}
                  >
                    {isGoogleEvent ? (
                      <GoogleCalendarIcon className="w-3 h-3" />
                    ) : (
                      <Calendar className="w-3 h-3" />
                    )}
                    {isGoogleEvent ? 'Google' : 'Paulus'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Source: {isGoogleEvent ? 'Google Calendar' : 'Paulus.ai'}</p>
                  {event.googleEventId && (
                    <p className="text-xs text-muted-foreground">
                      ID: {event.googleEventId}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              {isGoogleEvent && <GoogleCalendarIcon className="w-5 h-5 shrink-0" />}
              {event.title}
            </h2>
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

          {/* Attendees */}
          {attendees.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Attendees ({attendees.length})
                  </p>
                </div>
                <div className="space-y-2">
                  {attendees.map((user) => user && (
                    <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <Avatar className="w-7 h-7">
                        <AvatarFallback className="text-[10px]">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user.role.toLowerCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Source Info */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 mb-1">
              {isGoogleEvent ? (
                <GoogleCalendarIcon className="w-4 h-4" />
              ) : (
                <Calendar className="w-4 h-4 text-primary" />
              )}
              <p className="text-xs font-medium text-foreground">
                {isGoogleEvent ? 'Synced from Google Calendar' : 'Created in Paulus.ai'}
              </p>
            </div>
            {isGoogleEvent && event.googleEventId && (
              <p className="text-[10px] text-muted-foreground font-mono">
                Event ID: {event.googleEventId}
              </p>
            )}
          </div>

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
        </div>
      </div>
    </>
  );
}
