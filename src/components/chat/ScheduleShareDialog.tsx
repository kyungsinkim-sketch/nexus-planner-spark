import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarPlus, Check } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { ScheduleShare } from '@/types/core';

interface ScheduleShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ScheduleShare) => void;
  /** 해당 채팅방에 속한 멤버 ID 목록 (있으면 해당 멤버만 표시) */
  chatMemberIds?: string[];
}

export function ScheduleShareDialog({ open, onOpenChange, onSubmit, chatMemberIds }: ScheduleShareDialogProps) {
  const { users, currentUser } = useAppStore();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('11:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);

  // 채팅방 멤버가 있으면 그 멤버만, 없으면 전체 유저 (본인 제외)
  const invitableUsers = chatMemberIds
    ? users.filter(u => chatMemberIds.includes(u.id) && u.id !== currentUser?.id)
    : users.filter(u => u.id !== currentUser?.id);

  const toggleInvitee = (userId: string) => {
    setSelectedInvitees(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAll = () => {
    const allIds = invitableUsers.map(u => u.id);
    setSelectedInvitees(
      selectedInvitees.length === allIds.length ? [] : allIds
    );
  };

  const handleSubmit = () => {
    if (!title.trim() || !startDate || !endDate) return;
    onSubmit({
      title: title.trim(),
      startAt: `${startDate}T${startTime}:00`,
      endAt: `${endDate}T${endTime}:00`,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
      inviteeIds: selectedInvitees,
    });
    setTitle('');
    setStartDate('');
    setStartTime('10:00');
    setEndDate('');
    setEndTime('11:00');
    setLocation('');
    setDescription('');
    setSelectedInvitees([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-green-500" />
            {t('shareSchedule')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>{t('scheduleTitle')}</Label>
            <Input
              placeholder={t('scheduleExample')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('startDate')}</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label>{t('startTime')}</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t('endDate')}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('endTime')}</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('locationOptional')}</Label>
            <Input
              placeholder={t('locationExample')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('descriptionOptional')}</Label>
            <Textarea
              placeholder={t('scheduleDescriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('inviteParticipants')}</Label>
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={selectAll}>
                {selectedInvitees.length === invitableUsers.length ? t('deselectAll') : t('selectAll')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {invitableUsers.map(user => {
                const selected = selectedInvitees.includes(user.id);
                return (
                  <Button
                    key={user.id}
                    size="sm"
                    variant={selected ? 'default' : 'outline'}
                    onClick={() => toggleInvitee(user.id)}
                    className="text-xs gap-1"
                  >
                    {selected && <Check className="w-3 h-3" />}
                    {user.name}
                  </Button>
                );
              })}
            </div>
            {selectedInvitees.length > 0 && (
              <p className="text-xs text-muted-foreground">{t('selectedCount').replace('{count}', String(selectedInvitees.length))}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !startDate || !endDate}>{t('share')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
