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
            일정 공유
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label>일정 제목</Label>
            <Input
              placeholder="예: 촬영 현장 답사"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>시작 날짜</Label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label>시작 시간</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>종료 날짜</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>종료 시간</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>장소 (선택)</Label>
            <Input
              placeholder="예: 성수동 스튜디오"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>설명 (선택)</Label>
            <Textarea
              placeholder="일정에 대한 설명을 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>참여자 초대</Label>
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={selectAll}>
                {selectedInvitees.length === invitableUsers.length ? '전체 해제' : '전체 선택'}
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
              <p className="text-xs text-muted-foreground">{selectedInvitees.length}명 선택됨</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !startDate || !endDate}>공유</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
