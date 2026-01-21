import { useState } from 'react';
import { EventType, CalendarEvent } from '@/types/core';
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
import { CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';

interface NewEventModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

const eventTypeOptions: { value: EventType; label: string }[] = [
  { value: 'MEETING', label: 'Meeting' },
  { value: 'DEADLINE', label: 'Deadline' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'PT', label: 'Presentation/PT' },
  { value: 'TASK', label: 'Task' },
  { value: 'R_TRAINING', label: 'R-Training' },
];

export function NewEventModal({ 
  open, 
  onClose, 
  projectId,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
}: NewEventModalProps) {
  const { addEvent, currentUser } = useAppStore();
  
  const getDefaultDate = () => {
    if (defaultDate) return defaultDate;
    return new Date().toISOString().split('T')[0];
  };

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('MEETING');
  const [date, setDate] = useState(getDefaultDate());
  const [startTime, setStartTime] = useState(defaultStartTime || '09:00');
  const [endTime, setEndTime] = useState(defaultEndTime || '10:00');

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
    };

    addEvent(newEvent);
    toast.success('Event created', {
      description: `"${title}" added to calendar`,
    });

    // Reset form
    setTitle('');
    setType('MEETING');
    setDate(getDefaultDate());
    setStartTime('09:00');
    setEndTime('10:00');
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
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title"
              autoFocus
            />
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Event Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as EventType)}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
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
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2">
              <CalendarPlus className="w-4 h-4" />
              Create Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
