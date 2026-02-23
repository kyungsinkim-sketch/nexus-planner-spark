/**
 * AutoCheckInDialog — Shows when GPS doesn't match office location.
 * User selects their work type: Remote, Overseas, Filming, Field.
 */

import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as attendanceService from '@/services/attendanceService';
import type { AttendanceType } from '@/services/attendanceService';
import type { UserWorkStatus } from '@/types/core';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Home, Plane, Film, MapPin, Building2, X } from 'lucide-react';

const WORK_TYPE_OPTIONS: Array<{
  type: AttendanceType;
  workStatus: UserWorkStatus;
  icon: typeof Home;
  labelKo: string;
  labelEn: string;
  color: string;
}> = [
  { type: 'remote', workStatus: 'REMOTE', icon: Home, labelKo: '재택근무', labelEn: 'Remote', color: 'bg-green-500' },
  { type: 'overseas', workStatus: 'OVERSEAS', icon: Plane, labelKo: '해외출장', labelEn: 'Overseas', color: 'bg-purple-500' },
  { type: 'filming', workStatus: 'FILMING', icon: Film, labelKo: '촬영 현장', labelEn: 'Filming', color: 'bg-orange-500' },
  { type: 'field', workStatus: 'FIELD', icon: MapPin, labelKo: '현장 방문', labelEn: 'Field Work', color: 'bg-teal-500' },
  { type: 'office', workStatus: 'AT_WORK', icon: Building2, labelKo: '사무실 출근', labelEn: 'Office', color: 'bg-blue-500' },
];

export function AutoCheckInDialog() {
  const { language } = useTranslation();
  const { showAutoCheckInDialog, setShowAutoCheckInDialog, autoCheckInPosition, setUserWorkStatus, currentUser } = useAppStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = async (option: typeof WORK_TYPE_OPTIONS[0]) => {
    if (!currentUser) return;
    setLoading(option.type);

    try {
      setUserWorkStatus(option.workStatus);

      if (isSupabaseConfigured()) {
        await attendanceService.checkIn({
          type: option.type,
          latitude: autoCheckInPosition?.latitude,
          longitude: autoCheckInPosition?.longitude,
          note: `Manual selection: ${option.labelEn}`,
        });
      }

      const label = language === 'ko' ? option.labelKo : option.labelEn;
      toast.success(`${label} 출근 처리되었습니다`);
      setShowAutoCheckInDialog(false);
    } catch (err) {
      console.error('[AutoCheckIn] Check-in failed:', err);
      toast.error('출근 처리에 실패했습니다');
    } finally {
      setLoading(null);
    }
  };

  const handleSkip = () => {
    setShowAutoCheckInDialog(false);
  };

  return (
    <Dialog open={showAutoCheckInDialog} onOpenChange={setShowAutoCheckInDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {language === 'ko' ? '출근 유형 선택' : 'Select Work Type'}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-4">
          {language === 'ko'
            ? '현재 위치가 사무실과 다릅니다. 출근 유형을 선택해주세요.'
            : 'Your location differs from the office. Please select your work type.'}
        </p>

        <div className="grid grid-cols-1 gap-2">
          {WORK_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const label = language === 'ko' ? option.labelKo : option.labelEn;
            const isLoading = loading === option.type;

            return (
              <Button
                key={option.type}
                variant="outline"
                className="justify-start gap-3 h-12 text-left"
                disabled={loading !== null}
                onClick={() => handleSelect(option)}
              >
                <div className={`w-8 h-8 rounded-lg ${option.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="flex-1 font-medium">{label}</span>
                {isLoading && (
                  <span className="text-xs text-muted-foreground animate-pulse">...</span>
                )}
              </Button>
            );
          })}
        </div>

        <div className="flex justify-end mt-2">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            <X className="w-3.5 h-3.5 mr-1" />
            {language === 'ko' ? '건너뛰기' : 'Skip'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
