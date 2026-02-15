import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Sun,
  Moon,
  Calendar,
  Plane,
  Video,
  MapPin,
  Map as MapIcon,
  Search,
  ChevronRight,
  Info,
  Users,
} from 'lucide-react';
import { AttendanceDetailDialog } from './AttendanceDetailDialog';
import { useIsMobile } from '@/hooks/useIsMobile';
import { getTeamTodayAttendance, type AttendanceRecord } from '@/services/attendanceService';
import { useTranslation } from '@/hooks/useTranslation';
import {
  calculateBiweekly,
  calculatePayroll,
  formatMinutesToHM,
  formatKRW,
  type DailyWorkRecord,
  type PayrollCalculation,
} from '@/utils/laborCalculation';

interface DiligenceStats {
  userId: string;
  name: string;
  department: string;
  workDays: number;
  totalHours: number;
  overtimeHours: number;
  nightHours: number;
  weekendDays: number;
  overseasDays: number;
  shootingDays: number;
  lateCount: number;
  earlyLeaveCount: number;
  hourlyWage: number;
  holidayWorkedHours: number;
  substituteLeaveGranted: boolean;
}

const mockDiligenceStats: DiligenceStats[] = [
  { userId: '1', name: '김경신', department: 'Management', workDays: 22, totalHours: 198, overtimeHours: 38, nightHours: 12, weekendDays: 2, overseasDays: 3, shootingDays: 0, lateCount: 0, earlyLeaveCount: 0, hourlyWage: 25000, holidayWorkedHours: 16, substituteLeaveGranted: false },
  { userId: '2', name: '사판 카디르', department: 'Creative Solution', workDays: 21, totalHours: 189, overtimeHours: 29, nightHours: 8, weekendDays: 1, overseasDays: 0, shootingDays: 2, lateCount: 1, earlyLeaveCount: 0, hourlyWage: 20000, holidayWorkedHours: 8, substituteLeaveGranted: true },
  { userId: '3', name: '장요한', department: 'Production', workDays: 22, totalHours: 220, overtimeHours: 60, nightHours: 24, weekendDays: 4, overseasDays: 5, shootingDays: 8, lateCount: 0, earlyLeaveCount: 0, hourlyWage: 22000, holidayWorkedHours: 32, substituteLeaveGranted: false },
  { userId: '4', name: '박민규', department: 'Production', workDays: 21, totalHours: 210, overtimeHours: 50, nightHours: 18, weekendDays: 3, overseasDays: 5, shootingDays: 10, lateCount: 0, earlyLeaveCount: 1, hourlyWage: 22000, holidayWorkedHours: 24, substituteLeaveGranted: false },
  { userId: '5', name: '임혁', department: 'Production', workDays: 22, totalHours: 225, overtimeHours: 65, nightHours: 30, weekendDays: 4, overseasDays: 3, shootingDays: 12, lateCount: 0, earlyLeaveCount: 0, hourlyWage: 18000, holidayWorkedHours: 32, substituteLeaveGranted: false },
];

// 2주 단위 급여 산정 (mock 데이터 기반 간소화 계산)
function computePayrollFromStats(stat: DiligenceStats): PayrollCalculation {
  const biweeklyTotalMinutes = stat.totalHours * 60;
  const STANDARD = 80 * 60;
  const overtimeMinutes = Math.max(0, biweeklyTotalMinutes - STANDARD);
  const regularMinutes = biweeklyTotalMinutes - overtimeMinutes;
  const nightMinutes = stat.nightHours * 60;
  const nightOvertimeMinutes = overtimeMinutes > 0 ? Math.min(nightMinutes, overtimeMinutes) : 0;
  const pureNightMinutes = nightMinutes - nightOvertimeMinutes;
  const holidayMinutes = stat.substituteLeaveGranted ? 0 : stat.holidayWorkedHours * 60;
  const holidaySubstitutedMinutes = stat.substituteLeaveGranted ? stat.holidayWorkedHours * 60 : 0;

  const biweekly = {
    periodStart: '',
    periodEnd: '',
    totalWorkMinutes: biweeklyTotalMinutes,
    regularMinutes,
    overtimeMinutes,
    nightMinutes: pureNightMinutes,
    nightOvertimeMinutes,
    holidayMinutes,
    holidaySubstitutedMinutes,
    substituteHalfDays: stat.substituteLeaveGranted ? Math.floor(stat.holidayWorkedHours / 4) : 0,
    substituteFullDays: stat.substituteLeaveGranted ? Math.floor(stat.holidayWorkedHours / 8) : 0,
  };

  return calculatePayroll(biweekly, stat.hourlyWage);
}

export function DiligenceTab() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState('2025-12');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);

  // Fetch real data for today
  useEffect(() => {
    async function fetchAttendance() {
      try {
        const data = await getTeamTodayAttendance();
        setTodayAttendance(data);
      } catch (e) {
        console.error('Failed to fetch attendance:', e);
      }
    }
    fetchAttendance();
  }, []);

  const filteredStats = mockDiligenceStats.filter(stat =>
    selectedDepartment === 'all' || stat.department === selectedDepartment
  );

  const departments = [...new Set(mockDiligenceStats.map(s => s.department))];

  const handleRowClick = (stat: DiligenceStats) => {
    // In real app, we would fetch the actual attendance list for this user and month
    // For now, we simulate map viewing for those with overseas/shooting days
    if (stat.overseasDays > 0 || stat.shootingDays > 0) {
      setSelectedRecord({
        id: stat.userId,
        user_id: stat.userId,
        work_date: selectedMonth + '-15',
        check_in_at: '2025-12-15T09:00:00Z',
        check_in_type: stat.overseasDays > 0 ? 'overseas' : 'filming',
        check_in_latitude: 37.5665,
        check_in_longitude: 126.9780,
        check_in_address: stat.overseasDays > 0 ? 'Paris, France (해외출장지)' : '서울 성수동 촬영현장',
        check_in_note: '프로젝트 A 촬영 현장 확인',
        check_out_at: '2025-12-15T22:00:00Z',
        check_out_latitude: 37.5665,
        check_out_longitude: 126.9780,
        check_out_address: null,
        check_out_note: null,
        working_minutes: 780,
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setIsDetailOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t('diligenceSelectMonth')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-12">{t('diligenceMonth202512')}</SelectItem>
              <SelectItem value="2025-11">{t('diligenceMonth202511')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[160px]">
              <Users className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t('diligenceSelectDepartment')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('diligenceAllDepartments')}</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2 font-medium text-blue-600">
            <Plane className="w-4 h-4" />
            {t('diligenceOverseasFilming')}
          </div>
          <p className="text-2xl font-bold">18{t('diligenceDaySuffix')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('diligenceMonthlyTotal')}</p>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2 font-medium text-emerald-600">
            <Video className="w-4 h-4" />
            {t('diligenceOnSiteFilming')}
          </div>
          <p className="text-2xl font-bold">35{t('diligenceDaySuffix')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('diligenceMonthlyTotal')}</p>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2 font-medium text-violet-600">
            <Clock className="w-4 h-4" />
            {t('diligenceAvgOvertime')}
          </div>
          <p className="text-2xl font-bold">42h</p>
          <p className="text-xs text-muted-foreground mt-1">{t('diligencePerPersonAvg')}</p>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2 font-medium text-orange-600">
            <Info className="w-4 h-4" />
            {t('diligenceNotableIssues')}
          </div>
          <p className="text-2xl font-bold">3{t('diligenceCaseSuffix')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('diligenceLateEarlyTotal')}</p>
        </Card>
      </div>

      {/* Main Data View */}
      <Card className="shadow-card">
        <CardHeader className="p-4 pb-0 border-b-0">
          <CardTitle className="text-lg">{t('diligenceAnalysisReport')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('diligenceClickForDetail')}</p>
        </CardHeader>
        <CardContent className="p-0">
          {isMobile ? (
            <div className="divide-y">
              {filteredStats.map((stat) => (
                <div
                  key={stat.userId}
                  className="p-4 active:bg-muted/50 transition-colors"
                  onClick={() => handleRowClick(stat)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-foreground">{stat.name}</h4>
                      <p className="text-xs text-muted-foreground">{stat.department} · {stat.workDays}{t('diligenceDaysAttended')}</p>
                    </div>
                    {(stat.overseasDays > 0 || stat.shootingDays > 0) && (
                      <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                        <MapIcon className="w-3 h-3" /> {t('diligenceLocationRecord')}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase">{t('diligenceWorkOvertime')}</span>
                      <p className="text-sm font-medium">{stat.totalHours}h / {stat.overtimeHours}h</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase">{t('diligenceOverseasField')}</span>
                      <p className="text-sm font-medium">{stat.overseasDays}{t('diligenceDaySuffix')} / {stat.shootingDays}{t('diligenceDaySuffix')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Progress
                      value={Math.min(100, (stat.overtimeHours / 60) * 100)}
                      className="h-1.5 flex-1"
                    />
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('department')}</TableHead>
                    <TableHead className="text-center">{t('diligenceTotalHours')}</TableHead>
                    <TableHead className="text-center">{t('diligenceOvertime')}</TableHead>
                    <TableHead className="text-center">{t('diligenceOverseasField')}</TableHead>
                    <TableHead className="text-center">{t('diligenceLocationInfo')}</TableHead>
                    <TableHead>{t('diligenceEnergy')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStats.map((stat) => (
                    <TableRow
                      key={stat.userId}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => handleRowClick(stat)}
                    >
                      <TableCell className="font-medium">{stat.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{stat.department}</TableCell>
                      <TableCell className="text-center">{stat.totalHours}h</TableCell>
                      <TableCell className="text-center font-semibold text-violet-600">{stat.overtimeHours}h</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {stat.overseasDays > 0 && <Badge variant="outline" className="bg-blue-50">{t('diligenceOverseas')} {stat.overseasDays}</Badge>}
                          {stat.shootingDays > 0 && <Badge variant="outline" className="bg-emerald-50">{t('diligenceFilming')} {stat.shootingDays}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {(stat.overseasDays > 0 || stat.shootingDays > 0) ? (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-primary">
                            <MapPin className="h-4 w-4" />
                          </Button>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="w-[120px]">
                        <Progress
                          value={Math.min(100, (stat.overtimeHours / 60) * 100)}
                          className="h-2 w-full"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payroll Calculation Section */}
      <Card className="shadow-card">
        <CardHeader className="p-4 pb-0 border-b-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Moon className="w-5 h-5 text-violet-500" />
            {t('diligencePayrollTitle')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('diligencePayrollDesc')}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead className="text-center">{t('diligenceTotalWork')}</TableHead>
                  <TableHead className="text-center">{t('diligenceOvertimeWork')}</TableHead>
                  <TableHead className="text-center">{t('diligenceNightWork')}</TableHead>
                  <TableHead className="text-center">{t('diligenceNightOvertime')}</TableHead>
                  <TableHead className="text-center">{t('diligenceHolidayWork')}</TableHead>
                  <TableHead className="text-center">{t('diligenceSubstituteLeave')}</TableHead>
                  <TableHead className="text-right">{t('diligenceOvertimePay')}</TableHead>
                  <TableHead className="text-right">{t('diligenceNightPay')}</TableHead>
                  <TableHead className="text-right">{t('diligenceHolidayPay')}</TableHead>
                  <TableHead className="text-right font-bold">{t('diligenceTotalAdditionalPay')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStats.map((stat) => {
                  const payroll = computePayrollFromStats(stat);
                  return (
                    <TableRow key={stat.userId}>
                      <TableCell className="font-medium">{stat.name}</TableCell>
                      <TableCell className="text-center">{formatMinutesToHM(payroll.totalWorkMinutes)}</TableCell>
                      <TableCell className="text-center">
                        {payroll.overtimeMinutes > 0 ? (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700">
                            {formatMinutesToHM(payroll.overtimeMinutes)}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {payroll.nightMinutes > 0 ? (
                          <Badge variant="outline" className="bg-violet-50 text-violet-700">
                            {formatMinutesToHM(payroll.nightMinutes)}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {payroll.nightOvertimeMinutes > 0 ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            {formatMinutesToHM(payroll.nightOvertimeMinutes)}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {payroll.holidayMinutes > 0 ? formatMinutesToHM(payroll.holidayMinutes) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {payroll.substituteFullDays > 0 && <Badge variant="secondary">{payroll.substituteFullDays}{t('diligenceDaySuffix')}</Badge>}
                        {payroll.substituteHalfDays > 0 && <Badge variant="secondary" className="ml-1">{t('diligenceHalfDay')} {payroll.substituteHalfDays}</Badge>}
                        {payroll.substituteFullDays === 0 && payroll.substituteHalfDays === 0 && '-'}
                      </TableCell>
                      <TableCell className="text-right text-orange-700 font-medium">
                        {payroll.overtimePay > 0 ? formatKRW(payroll.overtimePay) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-violet-700 font-medium">
                        {(payroll.nightPay + payroll.nightOvertimePay) > 0
                          ? formatKRW(payroll.nightPay + payroll.nightOvertimePay)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-blue-700 font-medium">
                        {payroll.holidayPay > 0 ? formatKRW(payroll.holidayPay) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {formatKRW(payroll.totalAdditionalPay)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Legend */}
          <div className="p-4 border-t bg-muted/30 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t('diligenceCalcGuidelines')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
              <span>{t('diligenceCalcOvertime')}</span>
              <span>{t('diligenceCalcNight')}</span>
              <span>{t('diligenceCalcNightOvertime')}</span>
              <span>{t('diligenceCalcHoliday')}</span>
              <span>{t('diligenceCalcSubstitute')}</span>
              <span>{t('diligenceCalcBreakExclude')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AttendanceDetailDialog
        record={selectedRecord}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}

