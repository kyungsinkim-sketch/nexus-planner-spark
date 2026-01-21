import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Clock, 
  Sun, 
  Moon, 
  Calendar, 
  Plane, 
  Video,
  TrendingUp,
  Users
} from 'lucide-react';
import { useState } from 'react';

interface DiligenceStats {
  userId: string;
  name: string;
  department: string;
  workDays: number;
  totalHours: number;
  overtimeHours: number;
  weekendDays: number;
  overseasDays: number;
  shootingDays: number;
  lateCount: number;
  earlyLeaveCount: number;
}

const mockDiligenceStats: DiligenceStats[] = [
  { userId: '1', name: '김경신', department: 'Management', workDays: 22, totalHours: 198, overtimeHours: 38, weekendDays: 2, overseasDays: 3, shootingDays: 0, lateCount: 0, earlyLeaveCount: 0 },
  { userId: '2', name: '사판 카디르', department: 'Creative Solution', workDays: 21, totalHours: 189, overtimeHours: 29, weekendDays: 1, overseasDays: 0, shootingDays: 2, lateCount: 1, earlyLeaveCount: 0 },
  { userId: '3', name: '장요한', department: 'Production', workDays: 22, totalHours: 220, overtimeHours: 60, weekendDays: 4, overseasDays: 5, shootingDays: 8, lateCount: 0, earlyLeaveCount: 0 },
  { userId: '4', name: '박민규', department: 'Production', workDays: 21, totalHours: 210, overtimeHours: 50, weekendDays: 3, overseasDays: 5, shootingDays: 10, lateCount: 0, earlyLeaveCount: 1 },
  { userId: '5', name: '임혁', department: 'Production', workDays: 22, totalHours: 225, overtimeHours: 65, weekendDays: 4, overseasDays: 3, shootingDays: 12, lateCount: 0, earlyLeaveCount: 0 },
  { userId: '6', name: '이정헌', department: 'Production', workDays: 20, totalHours: 180, overtimeHours: 20, weekendDays: 0, overseasDays: 0, shootingDays: 0, lateCount: 2, earlyLeaveCount: 1 },
  { userId: '7', name: '홍원준', department: 'Production', workDays: 22, totalHours: 198, overtimeHours: 38, weekendDays: 2, overseasDays: 2, shootingDays: 5, lateCount: 0, earlyLeaveCount: 0 },
  { userId: '8', name: '백송희', department: 'Production', workDays: 21, totalHours: 200, overtimeHours: 41, weekendDays: 2, overseasDays: 5, shootingDays: 8, lateCount: 0, earlyLeaveCount: 0 },
  { userId: '9', name: '정승채', department: 'Production', workDays: 22, totalHours: 195, overtimeHours: 35, weekendDays: 1, overseasDays: 0, shootingDays: 0, lateCount: 0, earlyLeaveCount: 0 },
  { userId: '10', name: '한상현', department: 'Production', workDays: 22, totalHours: 190, overtimeHours: 30, weekendDays: 2, overseasDays: 0, shootingDays: 0, lateCount: 1, earlyLeaveCount: 0 },
  { userId: '11', name: '김현진', department: 'Production', workDays: 21, totalHours: 210, overtimeHours: 51, weekendDays: 3, overseasDays: 3, shootingDays: 10, lateCount: 0, earlyLeaveCount: 0 },
  { userId: '12', name: '안지민', department: 'Creative Solution', workDays: 22, totalHours: 185, overtimeHours: 25, weekendDays: 1, overseasDays: 0, shootingDays: 2, lateCount: 0, earlyLeaveCount: 0 },
];

export function DiligenceTab() {
  const [selectedMonth, setSelectedMonth] = useState('2025-12');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const filteredStats = mockDiligenceStats.filter(stat => 
    selectedDepartment === 'all' || stat.department === selectedDepartment
  );

  // Summary calculations
  const totalWorkDays = filteredStats.reduce((sum, s) => sum + s.workDays, 0);
  const totalOvertimeHours = filteredStats.reduce((sum, s) => sum + s.overtimeHours, 0);
  const totalWeekendDays = filteredStats.reduce((sum, s) => sum + s.weekendDays, 0);
  const totalOverseasDays = filteredStats.reduce((sum, s) => sum + s.overseasDays, 0);
  const totalShootingDays = filteredStats.reduce((sum, s) => sum + s.shootingDays, 0);
  const avgOvertimeHours = filteredStats.length > 0 ? (totalOvertimeHours / filteredStats.length).toFixed(1) : 0;

  const departments = [...new Set(mockDiligenceStats.map(s => s.department))];

  const stats = [
    { label: '평균 야근시간', value: `${avgOvertimeHours}h`, icon: Moon, color: 'text-violet-500', bgColor: 'bg-violet-100' },
    { label: '총 주말근무', value: `${totalWeekendDays}일`, icon: Calendar, color: 'text-orange-500', bgColor: 'bg-orange-100' },
    { label: '총 해외촬영', value: `${totalOverseasDays}일`, icon: Plane, color: 'text-blue-500', bgColor: 'bg-blue-100' },
    { label: '총 촬영일수', value: `${totalShootingDays}일`, icon: Video, color: 'text-emerald-500', bgColor: 'bg-emerald-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4 shadow-card">
        <div className="flex items-center gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="월 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-12">2025년 12월</SelectItem>
              <SelectItem value="2025-11">2025년 11월</SelectItem>
              <SelectItem value="2025-10">2025년 10월</SelectItem>
              <SelectItem value="2025-09">2025년 09월</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[180px]">
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
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Diligence Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-foreground">개인별 근태 현황</h3>
          <p className="text-sm text-muted-foreground">{selectedMonth} 기준 근무 통계</p>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>부서</TableHead>
                <TableHead className="text-center w-[80px]">출근일수</TableHead>
                <TableHead className="text-center w-[90px]">총 근무시간</TableHead>
                <TableHead className="text-center w-[80px]">야근시간</TableHead>
                <TableHead className="text-center w-[80px]">주말근무</TableHead>
                <TableHead className="text-center w-[80px]">해외촬영</TableHead>
                <TableHead className="text-center w-[80px]">촬영일수</TableHead>
                <TableHead className="text-center w-[60px]">지각</TableHead>
                <TableHead className="text-center w-[60px]">조퇴</TableHead>
                <TableHead className="w-[120px]">근무강도</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStats.map((stat) => {
                // Calculate work intensity (based on overtime and special work)
                const intensity = Math.min(100, ((stat.overtimeHours / 60) * 40) + ((stat.weekendDays / 4) * 20) + ((stat.shootingDays / 12) * 30) + ((stat.overseasDays / 5) * 10));
                const intensityColor = intensity > 80 ? 'bg-red-500' : intensity > 60 ? 'bg-orange-500' : intensity > 40 ? 'bg-yellow-500' : 'bg-emerald-500';
                
                return (
                  <TableRow key={stat.userId}>
                    <TableCell className="font-medium">{stat.name}</TableCell>
                    <TableCell className="text-muted-foreground">{stat.department}</TableCell>
                    <TableCell className="text-center">{stat.workDays}일</TableCell>
                    <TableCell className="text-center">{stat.totalHours}h</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={stat.overtimeHours > 50 ? 'destructive' : stat.overtimeHours > 30 ? 'secondary' : 'outline'}>
                        {stat.overtimeHours}h
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.weekendDays > 0 ? (
                        <Badge variant="secondary">{stat.weekendDays}일</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.overseasDays > 0 ? (
                        <Badge className="bg-blue-100 text-blue-700">{stat.overseasDays}일</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.shootingDays > 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-700">{stat.shootingDays}일</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.lateCount > 0 ? (
                        <span className="text-orange-600">{stat.lateCount}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {stat.earlyLeaveCount > 0 ? (
                        <span className="text-orange-600">{stat.earlyLeaveCount}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={intensity} className={`h-2 flex-1 [&>div]:${intensityColor}`} />
                        <span className="text-xs text-muted-foreground w-[30px]">{Math.round(intensity)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
