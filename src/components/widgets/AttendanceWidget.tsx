/**
 * AttendanceWidget — Shows all currently working team members.
 * Horizontal flex-wrap layout with avatars, names, and status dots.
 * Click on user opens a Popover with check-in time + accumulated work hours.
 */

import { useEffect, useState, useCallback } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getTeamTodayAttendance } from '@/services/attendanceService';
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

/** Dot color for status (bg- variant) */
const STATUS_DOT_COLOR: Record<string, string> = {
  AT_WORK:  'bg-green-500',
  REMOTE:   'bg-blue-500',
  OVERSEAS: 'bg-purple-500',
  FILMING:  'bg-orange-500',
  FIELD:    'bg-teal-500',
  LUNCH:    'bg-amber-500',
  TRAINING: 'bg-pink-500',
};

function AttendanceWidget({ context: _context }: { context: WidgetDataContext }) {
  const { currentUser, userWorkStatus, users } = useAppStore();
  const { language } = useTranslation();

  // Real attendance data from Supabase
  const [attendanceMap, setAttendanceMap] = useState<Map<string, {
    check_in_at: string;
    check_out_at: string | null;
    working_minutes: number;
    status: string;
  }>>(new Map());

  // Current time ticker for real-time elapsed calculation (updates every 60s)
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const loadAttendance = useCallback(() => {
    if (!isSupabaseConfigured()) return;

    getTeamTodayAttendance()
      .then((records) => {
        const map = new Map<string, {
          check_in_at: string;
          check_out_at: string | null;
          working_minutes: number;
          status: string;
        }>();
        for (const rec of records) {
          if (rec.check_in_at) {
            map.set(rec.user_id, {
              check_in_at: rec.check_in_at,
              check_out_at: rec.check_out_at || null,
              working_minutes: rec.working_minutes || 0,
              status: rec.status || 'working',
            });
          }
        }
        setAttendanceMap(map);
      })
      .catch((err) => {
        console.error('[AttendanceWidget] Failed to load team attendance:', err);
      });
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Build list of working users -- merge current user's live status
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
    <div className="flex flex-wrap gap-2 p-2 overflow-y-auto h-full">
      {workingUsers.map(user => {
        const cfg = STATUS_CONFIG[user.liveStatus] || STATUS_CONFIG.AT_WORK;
        const Icon = cfg.icon;
        const isMe = user.id === currentUser?.id;
        const dotColor = STATUS_DOT_COLOR[user.liveStatus] || 'bg-green-500';
        const attendance = attendanceMap.get(user.id);

        // Format check-in time
        let checkInTime = '--:--';
        if (attendance?.check_in_at) {
          try {
            const d = new Date(attendance.check_in_at);
            checkInTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          } catch {
            checkInTime = '--:--';
          }
        }

        // Calculate working minutes: real-time elapsed if still working, DB value if checked out
        let totalMinutes = 0;
        if (attendance) {
          if (attendance.check_out_at && attendance.working_minutes > 0) {
            // Already checked out → use DB computed value
            totalMinutes = attendance.working_minutes;
          } else if (attendance.check_in_at && !attendance.check_out_at) {
            // Still working → calculate elapsed from check-in to now
            const checkInMs = new Date(attendance.check_in_at).getTime();
            totalMinutes = Math.max(0, Math.floor((now - checkInMs) / 60000));
          }
        }
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        return (
          <Popover key={user.id}>
            <PopoverTrigger asChild>
              <button
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors ${
                  isMe ? 'bg-primary/10' : 'hover:bg-muted/30'
                }`}
              >
                <div className="relative">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      isMe ? 'bg-primary' : 'bg-muted-foreground/40'
                    }`}>
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div className={`w-3 h-3 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-background ${dotColor}`} />
                </div>
                <span className="text-[10px] truncate max-w-[48px]">{user.name}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3 space-y-2">
              <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {language === 'ko' ? cfg.label : cfg.labelEn}
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>{language === 'ko' ? '출근' : 'Check-in'}: {checkInTime}</p>
                <p>
                  {language === 'ko' ? '누적 근무' : 'Total'}: {hours}{language === 'ko' ? '시간' : 'h'} {minutes}{language === 'ko' ? '분' : 'm'}
                </p>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

export default AttendanceWidget;
