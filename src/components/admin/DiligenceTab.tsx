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
              <SelectValue placeholder="월 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-12">2025년 12월</SelectItem>
              <SelectItem value="2025-11">2025년 11월</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[160px]">
              <Users className="w-4 h-4 mr-2" />
              <SelectValue placeholder="부서 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 부서</SelectItem>
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
            해외촬영
          </div>
          <p className="text-2xl font-bold">18일</p>
          <p className="text-xs text-muted-foreground mt-1">월간 합계</p>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2 font-medium text-emerald-600">
            <Video className="w-4 h-4" />
            현장촬영
          </div>
          <p className="text-2xl font-bold">35일</p>
          <p className="text-xs text-muted-foreground mt-1">월간 합계</p>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2 font-medium text-violet-600">
            <Clock className="w-4 h-4" />
            평균 야근
          </div>
          <p className="text-2xl font-bold">42h</p>
          <p className="text-xs text-muted-foreground mt-1">인당 평균</p>
        </Card>
        <Card className="p-4 shadow-card">
          <div className="flex items-center gap-2 mb-2 font-medium text-orange-600">
            <Info className="w-4 h-4" />
            특이 사항
          </div>
          <p className="text-2xl font-bold">3건</p>
          <p className="text-xs text-muted-foreground mt-1">지각/조퇴 합계</p>
        </Card>
      </div>

      {/* Main Data View */}
      <Card className="shadow-card">
        <CardHeader className="p-4 pb-0 border-b-0">
          <CardTitle className="text-lg">근태 분석 리포트</CardTitle>
          <p className="text-sm text-muted-foreground">기록을 클릭하면 상세 위치 정보를 확인할 수 있습니다.</p>
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
                      <p className="text-xs text-muted-foreground">{stat.department} · {stat.workDays}일 출근</p>
                    </div>
                    {(stat.overseasDays > 0 || stat.shootingDays > 0) && (
                      <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                        <MapIcon className="w-3 h-3" /> 위치기록
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase">근무/야근</span>
                      <p className="text-sm font-medium">{stat.totalHours}h / {stat.overtimeHours}h</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase">해외/현장</span>
                      <p className="text-sm font-medium">{stat.overseasDays}일 / {stat.shootingDays}일</p>
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
                    <TableHead>이름</TableHead>
                    <TableHead>부서</TableHead>
                    <TableHead className="text-center">총 시간</TableHead>
                    <TableHead className="text-center">야근</TableHead>
                    <TableHead className="text-center">해외/현장</TableHead>
                    <TableHead className="text-center">위치정보</TableHead>
                    <TableHead>에너지</TableHead>
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
                          {stat.overseasDays > 0 && <Badge variant="outline" className="bg-blue-50">해외 {stat.overseasDays}</Badge>}
                          {stat.shootingDays > 0 && <Badge variant="outline" className="bg-emerald-50">촬영 {stat.shootingDays}</Badge>}
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
            연장·야간·휴일 근무 수당 산정
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            선택근로제 2주 단위 기준 | 기본 80시간 초과 시 연장근로 적용
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead className="text-center">총 근무</TableHead>
                  <TableHead className="text-center">연장근로</TableHead>
                  <TableHead className="text-center">야간근로</TableHead>
                  <TableHead className="text-center">야간+연장</TableHead>
                  <TableHead className="text-center">휴일근무</TableHead>
                  <TableHead className="text-center">대체휴무</TableHead>
                  <TableHead className="text-right">연장수당</TableHead>
                  <TableHead className="text-right">야간수당</TableHead>
                  <TableHead className="text-right">휴일수당</TableHead>
                  <TableHead className="text-right font-bold">추가수당 합계</TableHead>
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
                        {payroll.substituteFullDays > 0 && <Badge variant="secondary">{payroll.substituteFullDays}일</Badge>}
                        {payroll.substituteHalfDays > 0 && <Badge variant="secondary" className="ml-1">반차 {payroll.substituteHalfDays}</Badge>}
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
            <p className="text-xs font-medium text-muted-foreground">산정 기준 안내</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
              <span>· 연장근로 (2주 80h 초과): 시급 × 1.5배</span>
              <span>· 야간근로 (22:00~06:00): 시급 × 0.5배 추가</span>
              <span>· 연장+야간 중첩: 시급 × 2.0배 (1.5 + 0.5)</span>
              <span>· 주휴일/공휴일 (대체휴무 미제공): 시급 × 1.5배</span>
              <span>· 대체휴무 제공 시: 4h→반차, 8h→1일 (가산 미적용)</span>
              <span>· 휴게시간/PT시간 제외</span>
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

