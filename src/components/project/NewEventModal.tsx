import { useState, useEffect } from 'react';
import { EventType, CalendarEvent, User } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserSearchInput } from '@/components/ui/user-search-input';
import { CalendarPlus, Save, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/i18n';

interface NewEventModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  editEvent?: CalendarEvent;
}

const eventTypeOptions: { value: EventType; labelKey: TranslationKey }[] = [
  { value: 'MEETING', labelKey: 'meeting' },
  { value: 'DEADLINE', labelKey: 'deadline' },
  { value: 'DELIVERY', labelKey: 'delivery' },
  { value: 'PT', labelKey: 'pt' },
  { value: 'TASK', labelKey: 'task' },
  { value: 'R_TRAINING', labelKey: 'renatus' },
];

export function NewEventModal({
  open,
  onClose,
  projectId,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  editEvent,
}: NewEventModalProps) {
  const { addEvent, updateEvent, currentUser, users } = useAppStore();
  const { t } = useTranslation();

  const isEditMode = !!editEvent;

  const getDefaultDate = () => {
    if (defaultDate) return defaultDate;
    return new Date().toISOString().split('T')[0];
  };

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('MEETING');
  const [date, setDate] = useState(getDefaultDate());
  const [startTime, setStartTime] = useState(defaultStartTime || '09:00');
  const [endTime, setEndTime] = useState(defaultEndTime || '10:00');
  const [location, setLocation] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const selectedAttendees = users.filter(u => attendeeIds.includes(u.id));

  // Pre-fill form when editing — use local date components to avoid UTC shift
  useEffect(() => {
    if (open && editEvent) {
      setTitle(editEvent.title);
      setType(editEvent.type);
      const startDate = new Date(editEvent.startAt);
      const endDate = new Date(editEvent.endAt);
      // Use local date components (NOT toISOString which converts to UTC)
      const sy = startDate.getFullYear();
      const sm = String(startDate.getMonth() + 1).padStart(2, '0');
      const sd = String(startDate.getDate()).padStart(2, '0');
      setDate(`${sy}-${sm}-${sd}`);
      setStartTime(startDate.toTimeString().slice(0, 5));
      setEndTime(endDate.toTimeString().slice(0, 5));
      setLocation(editEvent.location || '');
      setAttendeeIds(editEvent.attendeeIds || []);
    } else if (open && !editEvent) {
      // Reset for new event
      setTitle('');
      setType('MEETING');
      setDate(getDefaultDate());
      setStartTime(defaultStartTime || '09:00');
      setEndTime(defaultEndTime || '10:00');
      setLocation('');
      setAttendeeIds([]);
    }
  }, [open, editEvent]);

  const handleSelectAttendee = (user: User) => {
    setAttendeeIds(prev => [...prev, user.id]);
  };

  const handleRemoveAttendee = (userId: string) => {
    setAttendeeIds(prev => prev.filter(id => id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!title.trim()) {
      toast.error('Please enter an event title');
      return;
    }

    // Build proper ISO strings with timezone offset so Supabase stores the correct time.
    // Naive strings like "2026-02-16T14:00:00" are interpreted as UTC by Supabase timestamptz,
    // which shifts the time by the user's timezone offset (e.g., -9h for KST).
    const startDate = new Date(`${date}T${startTime}:00`);
    const endDate = new Date(`${date}T${endTime}:00`);
    const startAt = startDate.toISOString();
    const endAt = endDate.toISOString();

    setIsSaving(true);
    try {
      if (isEditMode && editEvent) {
        // Edit mode: update existing event
        await updateEvent(editEvent.id, {
          title: title.trim(),
          type,
          startAt,
          endAt,
          location: location.trim() || undefined,
          attendeeIds: attendeeIds.length > 0 ? attendeeIds : undefined,
        });
        toast.success('Event updated', {
          description: `"${title}" has been updated.`,
        });
      } else {
        // Create mode
        const newEvent: CalendarEvent = {
          id: `event-${Date.now()}`,
          title: title.trim(),
          type,
          startAt,
          endAt,
          projectId,
          ownerId: currentUser.id,
          source: 'PAULUS',
          location: location.trim() || undefined,
          attendeeIds: attendeeIds.length > 0 ? attendeeIds : undefined,
        };

        addEvent(newEvent);
        toast.success(t('eventCreated'), {
          description: `"${title}" ${t('addedToCalendar')}`,
        });
      }

      onClose();
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error(isEditMode ? 'Failed to update event' : 'Failed to create event');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Event' : 'New Event'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update this event.' : 'Create a new event for this project.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('eventTitle')}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('enterEventTitle')}
              autoFocus
            />
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label htmlFor="type">{t('eventType')}</Label>
            <Select value={type} onValueChange={(value) => setType(value as EventType)}>
              <SelectTrigger id="type">
                <SelectValue placeholder={t('selectType')} />
              </SelectTrigger>
              <SelectContent>
                {eventTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">{t('date')}</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">{t('startTime')}</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">{t('endTime')}</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {t('location')}
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('enterLocation')}
            />
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label>Attendees</Label>
            <UserSearchInput
              users={users.filter(u => u.id !== currentUser?.id)}
              selectedUsers={selectedAttendees}
              onSelect={handleSelectAttendee}
              onRemove={handleRemoveAttendee}
              placeholder="Type a name to invite..."
              multiple
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" className="gap-2" disabled={isSaving}>
              {isEditMode ? (
                <>
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </>
              ) : (
                <>
                  <CalendarPlus className="w-4 h-4" />
                  {isSaving ? 'Creating...' : t('createEvent')}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
