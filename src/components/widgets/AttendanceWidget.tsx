/**
 * AttendanceWidget — Simple attendance / work status indicator.
 */

import { useAppStore } from '@/stores/appStore';
import { Clock, Building2 } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

const statusLabels: Record<string, string> = {
  AT_WORK: '사무실',
  REMOTE: '재택근무',
  OVERSEAS: '해외출장',
  FILMING: '촬영중',
  FIELD: '현장',
  LUNCH: '점심식사',
  TRAINING: '운동중',
  NOT_AT_WORK: '퇴근',
};

function AttendanceWidget({ context: _context }: { context: WidgetDataContext }) {
  const { currentUser, userWorkStatus } = useAppStore();

  return (
    <div className="flex items-center justify-center h-full gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{currentUser?.name}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {statusLabels[userWorkStatus] || userWorkStatus}
          </p>
        </div>
      </div>
    </div>
  );
}

export default AttendanceWidget;
