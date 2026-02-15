import { useState } from 'react';
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
import { CalendarPlus } from 'lucide-react';
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
}: NewEventModalProps) {
  const { addEvent, currentUser, users } = useAppStore();
  const { t } = useTranslation();

  const getDefaultDate = () => {
    if (defaultDate) return defaultDate;
    return new Date().toISOString().split('T')[0];
  };

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('MEETING');
  const [date, setDate] = useState(getDefaultDate());
  const [startTime, setStartTime] = useState(defaultStartTime || '09:00');
  const [endTime, setEndTime] = useState(defaultEndTime || '10:00');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);

  const selectedAttendees = users.filter(u => attendeeIds.includes(u.id));

  const handleSelectAttendee = (user: User) => {
    setAttendeeIds(prev => [...prev, user.id]);
  };

  const handleRemoveAttendee = (userId: string) => {
    setAttendeeIds(prev => prev.filter(id => id !== userId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter an event title');
      return;
    }

    const startAt = `${date}T${startTime}:00`;
    const endAt = `${date}T${endTime}:00`;

    const newEvent: CalendarEvent = {
      id: `event-${Date.now()}`,
      title: title.trim(),
      type,
      startAt,
      endAt,
      projectId,
      ownerId: currentUser.id,
      source: 'PAULUS',
      attendeeIds: attendeeIds.length > 0 ? attendeeIds : undefined,
    };

    addEvent(newEvent);
    toast.success(t('eventCreated'), {
      description: `"${title}" ${t('addedToCalendar')}`,
    });

    // Reset form
    setTitle('');
    setType('MEETING');
    setDate(getDefaultDate());
    setStartTime('09:00');
    setEndTime('10:00');
    setAttendeeIds([]);
    onClose();
  };

  // Update form when modal opens with new defaults
  useState(() => {
    if (open) {
      setDate(getDefaultDate());
      if (defaultStartTime) setStartTime(defaultStartTime);
      if (defaultEndTime) setEndTime(defaultEndTime);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
          <DialogDescription>
            Create a new event for this project.
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
            <Button type="submit" className="gap-2">
              <CalendarPlus className="w-4 h-4" />
              {t('createEvent')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
