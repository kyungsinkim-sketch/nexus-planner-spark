/**
 * AttendanceWidget — Shows all currently working team members.
 * Displays everyone whose status is NOT 'NOT_AT_WORK'.
 */

import { useAppStore } from '@/stores/appStore';
import {
  Building2,
  Home,
  Plane,
  Video,
  MapPin,
  UtensilsCrossed,
  Dumbbell,
  Clock,
} from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';
import type { UserWorkStatus } from '@/types/core';
import { useTranslation } from '@/hooks/useTranslation';

const STATUS_CONFIG: Record<string, { icon: typeof Building2; color: string; label: string; labelEn: string }> = {
  AT_WORK:   { icon: Building2,        color: 'text-green-500',  label: '사무실',   labelEn: 'Office' },
  REMOTE:    { icon: Home,             color: 'text-blue-500',   label: '재택근무', labelEn: 'Remote' },
  OVERSEAS:  { icon: Plane,            color: 'text-purple-500', label: '해외출장', labelEn: 'Overseas' },
  FILMING:   { icon: Video,            color: 'text-orange-500', label: '촬영중',   labelEn: 'Filming' },
  FIELD:     { icon: MapPin,           color: 'text-teal-500',   label: '현장',     labelEn: 'Field' },
  LUNCH:     { icon: UtensilsCrossed,  color: 'text-amber-500',  label: '점심식사', labelEn: 'Lunch' },
  TRAINING:  { icon: Dumbbell,         color: 'text-pink-500',   label: '운동중',   labelEn: 'Training' },
};

function AttendanceWidget({ context: _context }: { context: WidgetDataContext }) {
  const { currentUser, userWorkStatus, users } = useAppStore();
  const { language } = useTranslation();

  // Build list of working users — merge current user's live status
  const workingUsers = (users || [])
    .map(u => {
      const status: UserWorkStatus =
        u.id === currentUser?.id ? userWorkStatus : (u.workStatus || 'NOT_AT_WORK');
      return { ...u, liveStatus: status };
    })
    .filter(u => u.liveStatus !== 'NOT_AT_WORK');

  if (workingUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 gap-1">
        <Clock className="w-5 h-5" />
        <span className="text-xs">{language === 'ko' ? '현재 근무 중인 인원이 없습니다' : 'No one is working right now'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 overflow-y-auto h-full p-1">
      {workingUsers.map(user => {
        const cfg = STATUS_CONFIG[user.liveStatus] || STATUS_CONFIG.AT_WORK;
        const Icon = cfg.icon;
        const isMe = user.id === currentUser?.id;

        return (
          <div
            key={user.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
              isMe ? 'bg-primary/10' : 'hover:bg-muted/30'
            }`}
          >
            {/* Avatar or icon */}
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            ) : (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${
                isMe ? 'bg-primary' : 'bg-muted-foreground/40'
              }`}>
                {user.name.charAt(0)}
              </div>
            )}

            {/* Name */}
            <span className={`text-sm truncate flex-1 ${isMe ? 'font-semibold' : ''}`}>
              {user.name}
            </span>

            {/* Status badge */}
            <div className={`flex items-center gap-1 ${cfg.color}`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium whitespace-nowrap">
                {language === 'ko' ? cfg.label : cfg.labelEn}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AttendanceWidget;
