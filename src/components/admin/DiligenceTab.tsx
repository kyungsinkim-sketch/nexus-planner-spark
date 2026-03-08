import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Moon,
  Calendar,
  Plane,
  Video,
  MapPin,
  Map as MapIcon,
  ChevronRight,
  Info,
  Users,
  Loader2,
} from 'lucide-react';
import { AttendanceDetailDialog } from './AttendanceDetailDialog';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  getTeamMonthlyStats,
  type TeamMonthlyStats,
  type AttendanceRecord,
} from '@/services/attendanceService';
import { useTranslation } from '@/hooks/useTranslation';
import {
  calculatePayroll,
  formatMinutesToHM,
  formatKRW,
} from '@/utils/laborCalculation';

export function DiligenceTab() {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [teamStats, setTeamStats] = useState<TeamMonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const [yearStr, monthStr] = selectedMonth.split('-');
        const data = await getTeamMonthlyStats(parseInt(yearStr), parseInt(monthStr));
        setTeamStats(data);
      } catch (e) {
        console.error('Failed to fetch team stats:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [selectedMonth]);

  const filteredStats = teamStats.filter(stat =>
    selectedDepartment === 'all' || stat.department === selectedDepartment
  );

  const departments = [...new Set(teamStats.map(s => s.department).filter(Boolean))];

  // Summary stats
  const totalOverseasDays = filteredStats.reduce((sum, s) => sum + s.overseasDays, 0);
  const totalFilmingDays = filteredStats.reduce((sum, s) => sum + s.filmingDays, 0);
  const avgOvertimeMinutes = filteredStats.length > 0
    ? Math.round(filteredStats.reduce((sum, s) => sum + s.overtimeMinutes, 0) / filteredStats.length)
    : 0;
  const totalLateCount = filteredStats.reduce((sum, s) => sum + s.lateCount, 0);

  // Payroll calculation from real data
  function computePayrollFromReal(stat: TeamMonthlyStats) {
    const overtimeMinutes = stat.overtimeMinutes;
    const regularMinutes = stat.totalMinutes - overtimeMinutes;
    // Estimate night minutes: check-outs after 22:00 KST
    let nightMinutes = 0;
    for (const r of stat.records) {
      if (r.check_out_at) {
        const co = new Date(r.check_out_at);
        const kstH = (co.getUTCHours() + 9) % 24;
        if (kstH >= 22 || kstH < 6) {
          // Estimate night work as minutes after 22:00
          const checkOut = co.getTime();
          const dayEnd = new Date(co);
          dayEnd.setUTCHours(13, 0, 0, 0); // 22:00 KST = 13:00 UTC
          if (checkOut > dayEnd.getTime()) {
            nightMinutes += Math.round((checkOut - dayEnd.getTime()) / 60000);
          }
        }
      }
    }
    const nightOvertimeMinutes = Math.min(nightMinutes, overtimeMinutes);
    const pureNightMinutes = nightMinutes - nightOvertimeMinutes;

    const biweekly = {
      periodStart: '',
      periodEnd: '',
      totalWorkMinutes: stat.totalMinutes,
      regularMinutes,
      overtimeMinutes,
      nightMinutes: pureNightMinutes,
      nightOvertimeMinutes,
      holidayMinutes: 0,
      holidaySubstitutedMinutes: 0,
      substituteHalfDays: 0,
      substituteFullDays: 0,
    };

    // Default hourly wage (will be improved with salary grade lookup)
    const hourlyWage = 20000;
    return calculatePayroll(biweekly, hourlyWage);
  }

  const handleRowClick = (stat: TeamMonthlyStats) => {
    if (stat.records.length > 0) {
      const record = stat.records.find(r => r.check_in_latitude) || stat.records[0];
      setSelectedRecord(record);
      setIsDetailOpen(true);
    }
  };

  // Month options: current + 5 previous months
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
      opts.push({ value: val, label });
    }
    return opts;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {departments.length > 0 && (
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
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="p-4 shadow-card">
              <div className="flex items-center gap-2 mb-2 font-medium text-blue-600">
                <Plane className="w-4 h-4" />
                {t('diligenceOverseasFilming')}
              </div>
              <p className="text-2xl font-bold">{totalOverseasDays}{t('diligenceDaySuffix')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('diligenceMonthlyTotal')}</p>
            </Card>
            <Card className="p-4 shadow-card">
              <div className="flex items-center gap-2 mb-2 font-medium text-emerald-600">
                <Video className="w-4 h-4" />
                {t('diligenceOnSiteFilming')}
              </div>
              <p className="text-2xl font-bold">{totalFilmingDays}{t('diligenceDaySuffix')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('diligenceMonthlyTotal')}</p>
            </Card>
            <Card className="p-4 shadow-card">
              <div className="flex items-center gap-2 mb-2 font-medium text-violet-600">
                <Clock className="w-4 h-4" />
                {t('diligenceAvgOvertime')}
              </div>
              <p className="text-2xl font-bold">{formatMinutesToHM(avgOvertimeMinutes)}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('diligencePerPersonAvg')}</p>
            </Card>
            <Card className="p-4 shadow-card">
              <div className="flex items-center gap-2 mb-2 font-medium text-orange-600">
                <Info className="w-4 h-4" />
                {t('diligenceNotableIssues')}
              </div>
              <p className="text-2xl font-bold">{totalLateCount}{t('diligenceCaseSuffix')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('diligenceLateEarlyTotal')}</p>
            </Card>
          </div>

          {/* Main Data View */}
          <Card className="shadow-card">
            <CardHeader className="p-4 pb-0 border-b-0">
              <CardTitle className="text-lg">{t('diligenceAnalysisReport')}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {filteredStats.length}명 · {t('diligenceClickForDetail')}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {filteredStats.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  {t('noData')}
                </div>
              ) : isMobile ? (
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
                          <p className="text-xs text-muted-foreground">
                            {stat.department || '-'} · {stat.workDays}{t('diligenceDaysAttended')}
                          </p>
                        </div>
                        {(stat.overseasDays > 0 || stat.filmingDays > 0) && (
                          <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                            <MapIcon className="w-3 h-3" /> {t('diligenceLocationRecord')}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase">{t('diligenceWorkOvertime')}</span>
                          <p className="text-sm font-medium">
                            {formatMinutesToHM(stat.totalMinutes)} / {formatMinutesToHM(stat.overtimeMinutes)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase">{t('diligenceOverseasField')}</span>
                          <p className="text-sm font-medium">
                            {stat.overseasDays}{t('diligenceDaySuffix')} / {stat.filmingDays}{t('diligenceDaySuffix')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(100, (stat.overtimeMinutes / (60 * 60)) * 100)}
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
                        <TableHead className="text-center">{t('diligenceLate')}</TableHead>
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
                          <TableCell className="text-muted-foreground text-xs">{stat.department || '-'}</TableCell>
                          <TableCell className="text-center">{formatMinutesToHM(stat.totalMinutes)}</TableCell>
                          <TableCell className="text-center font-semibold text-violet-600">
                            {formatMinutesToHM(stat.overtimeMinutes)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {stat.overseasDays > 0 && (
                                <Badge variant="outline" className="bg-blue-50">{t('diligenceOverseas')} {stat.overseasDays}</Badge>
                              )}
                              {stat.filmingDays > 0 && (
                                <Badge variant="outline" className="bg-emerald-50">{t('diligenceFilming')} {stat.filmingDays}</Badge>
                              )}
                              {stat.overseasDays === 0 && stat.filmingDays === 0 && '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {stat.lateCount > 0 ? (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700">{stat.lateCount}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="w-[120px]">
                            <Progress
                              value={Math.min(100, (stat.overtimeMinutes / (60 * 60)) * 100)}
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

          {/* Payroll Calculation */}
          <Card className="shadow-card">
            <CardHeader className="p-4 pb-0 border-b-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <Moon className="w-5 h-5 text-violet-500" />
                {t('diligencePayrollTitle')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t('diligencePayrollDesc')}</p>
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
                      <TableHead className="text-right">{t('diligenceOvertimePay')}</TableHead>
                      <TableHead className="text-right">{t('diligenceNightPay')}</TableHead>
                      <TableHead className="text-right font-bold">{t('diligenceTotalAdditionalPay')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStats.map((stat) => {
                      const payroll = computePayrollFromReal(stat);
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
                          <TableCell className="text-right text-orange-700 font-medium">
                            {payroll.overtimePay > 0 ? formatKRW(payroll.overtimePay) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-violet-700 font-medium">
                            {(payroll.nightPay + payroll.nightOvertimePay) > 0
                              ? formatKRW(payroll.nightPay + payroll.nightOvertimePay)
                              : '-'}
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

              <div className="p-4 border-t bg-muted/30 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t('diligenceCalcGuidelines')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>{t('diligenceCalcOvertime')}</span>
                  <span>{t('diligenceCalcNight')}</span>
                  <span>{t('diligenceCalcNightOvertime')}</span>
                  <span>{t('diligenceCalcHoliday')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AttendanceDetailDialog
        record={selectedRecord}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
