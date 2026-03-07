/**
 * CallStartDialog — 통화 시작 팝업.
 *
 * Options:
 * - 지금 통화: 즉시 LiveKit 통화 연결
 * - 예약 통화: 캘린더 이벤트 생성 (call 링크 포함)
 *
 * 참가자 선택 (복수 선택, 기본값: 전체 선택)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Phone,
  Video,
  CalendarPlus,
  Loader2,
  Users,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { createCall } from '@/services/callService';
import type { User } from '@/types/core';
import { isBrainAIUser, isAIPersonaUser } from '@/types/core';

type CallMode = 'now' | 'schedule';
type CallMediaType = 'voice' | 'video';

interface CallStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected participants (for 1:1 direct chat) */
  targetUserIds?: string[];
  /** Project context */
  projectId?: string;
  /** Available members to choose from */
  availableMembers?: User[];
  /** Media type */
  mediaType?: CallMediaType;
}

export function CallStartDialog({
  open,
  onOpenChange,
  targetUserIds,
  projectId,
  availableMembers,
  mediaType = 'voice',
}: CallStartDialogProps) {
  const currentUser = useAppStore(s => s.currentUser);
  const users = useAppStore(s => s.users);
  const addEvent = useAppStore(s => s.addEvent);

  const [mode, setMode] = useState<CallMode | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [callTitle, setCallTitle] = useState('');

  // Available users (exclude self, AI users)
  const selectableUsers = useMemo(() => {
    if (availableMembers) {
      return availableMembers.filter(u =>
        u.id !== currentUser?.id && !isBrainAIUser(u.id) && !isAIPersonaUser(u.id)
      );
    }
    if (targetUserIds) {
      return users.filter(u => targetUserIds.includes(u.id));
    }
    return users.filter(u =>
      u.id !== currentUser?.id && !isBrainAIUser(u.id) && !isAIPersonaUser(u.id)
    );
  }, [availableMembers, targetUserIds, users, currentUser]);

  // Initialize: select all users by default when opening
  const resetState = useCallback(() => {
    setMode(null);
    // For direct chat with targetUserIds, use them directly even if not in selectableUsers
    const initialIds = selectableUsers.length > 0
      ? selectableUsers.map(u => u.id)
      : (targetUserIds || []);
    setSelectedUserIds(initialIds);
    setScheduleDate('');
    setScheduleTime('');
    setCallTitle('');
    setLoading(false);
  }, [selectableUsers]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      resetState();
    }
  }, [open, resetState]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleAll = () => {
    if (selectedUserIds.length === selectableUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(selectableUsers.map(u => u.id));
    }
  };

  // ─── Start Call Now ────────────────────────────────

  const handleCallNow = useCallback(async () => {
    if (selectedUserIds.length === 0) return;
    setLoading(true);

    try {
      // Support 1:1 and group calls
      const targetNames = selectedUserIds.map(id => selectableUsers.find(u => u.id === id)?.name).filter(Boolean);
      const title = callTitle || (selectedUserIds.length === 1
        ? `${mediaType === 'video' ? '화상' : '음성'} 통화`
        : `${mediaType === 'video' ? '화상' : '음성'} 통화 — ${targetNames.join(', ')}`);

      await createCall(selectedUserIds.length === 1 ? selectedUserIds[0] : selectedUserIds, projectId, title, mediaType === 'video');
      onOpenChange(false);
    } catch (err: any) {
      console.error('[CallStartDialog] Call failed:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedUserIds, selectableUsers, projectId, callTitle, mediaType, onOpenChange]);

  // ─── Schedule Call ─────────────────────────────────

  const handleScheduleCall = useCallback(async () => {
    if (selectedUserIds.length === 0 || !scheduleDate || !scheduleTime) return;
    setLoading(true);

    try {
      const startTime = new Date(`${scheduleDate}T${scheduleTime}`);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30min default

      const participantNames = selectedUserIds
        .map(id => selectableUsers.find(u => u.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      const title = callTitle || `${mediaType === 'video' ? '화상' : '음성'} 통화 — ${participantNames}`;

      // Create calendar event with call link placeholder
      await addEvent({
        title,
        description: `📞 In-App ${mediaType === 'video' ? 'Video' : 'Voice'} Call\n참여자: ${participantNames}\n\n통화 링크는 시작 시 자동 생성됩니다.`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        projectId: projectId || undefined,
        attendeeIds: selectedUserIds,
        type: 'call',
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error('[CallStartDialog] Schedule failed:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedUserIds, selectableUsers, scheduleDate, scheduleTime, callTitle, projectId, mediaType, addEvent, onOpenChange]);

  const isDirectChat = targetUserIds && targetUserIds.length === 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mediaType === 'video' ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
            {mediaType === 'video' ? '화상 통화' : '음성 통화'}
          </DialogTitle>
          <DialogDescription className="sr-only">Start a call</DialogDescription>
        </DialogHeader>

        {/* Step 1: Choose mode */}
        {!mode && (
          <div className="grid grid-cols-2 gap-3 py-4">
            <button
              onClick={() => setMode('now')}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border hover:border-green-500/50 hover:bg-green-500/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-green-500/10 group-hover:bg-green-500/20 flex items-center justify-center transition-colors">
                <Phone className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">지금 통화</p>
                <p className="text-xs text-muted-foreground mt-0.5">바로 연결</p>
              </div>
            </button>

            <button
              onClick={() => setMode('schedule')}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                <CalendarPlus className="w-6 h-6 text-blue-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">예약 통화</p>
                <p className="text-xs text-muted-foreground mt-0.5">일정에 추가</p>
              </div>
            </button>
          </div>
        )}

        {/* Step 2: Select participants + details */}
        {mode && (
          <div className="space-y-4 py-2">
            {/* Call title (optional) */}
            <div>
              <Label className="text-xs text-muted-foreground">통화 제목 (선택)</Label>
              <Input
                value={callTitle}
                onChange={e => setCallTitle(e.target.value)}
                placeholder="예: 프로젝트 킥오프 미팅"
                className="mt-1"
              />
            </div>

            {/* Schedule fields */}
            {mode === 'schedule' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">날짜</Label>
                  <Input
                    type="date"
                    value={scheduleDate}
                    onChange={e => setScheduleDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">시간</Label>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Participant selector (skip for 1:1 direct) */}
            {!isDirectChat && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    참여자 ({selectedUserIds.length}/{selectableUsers.length})
                  </Label>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedUserIds.length === selectableUsers.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                  {selectableUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedUserIds.includes(user.id)}
                        onCheckedChange={() => toggleUser(user.id)}
                      />
                      <Avatar className="w-6 h-6">
                        {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                        <AvatarFallback className="text-[10px] bg-primary/10">
                          {user.name?.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{user.name}</span>
                      {user.department && (
                        <span className="text-xs text-muted-foreground ml-auto">{user.department}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {mode && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMode(null)} disabled={loading}>
              뒤로
            </Button>
            {mode === 'now' ? (
              <Button
                onClick={handleCallNow}
                disabled={selectedUserIds.length === 0 || loading}
                className="bg-green-600 hover:bg-green-500"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Phone className="w-4 h-4 mr-2" />
                )}
                통화 시작
              </Button>
            ) : (
              <Button
                onClick={handleScheduleCall}
                disabled={selectedUserIds.length === 0 || !scheduleDate || !scheduleTime || loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CalendarPlus className="w-4 h-4 mr-2" />
                )}
                일정 추가
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
