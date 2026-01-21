import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Trash2, Plus, Search, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  id: string;
  employeeNo: number;
  status: '재직중' | '퇴사';
  joinDate: string;
  name: string;
  monthsWorked: string;
  yearsWorked: string;
  birthDate: string;
  department: string;
  category: string;
  position: string;
  level: string;
  classLevel: string;
  annualSalary: number;
  monthlySalary: number;
  contact: string;
  email: string;
}

const mockEmployees: Employee[] = [
  { id: '1', employeeNo: 1, status: '재직중', joinDate: '2016/02/17', name: '김경신', monthsWorked: '119개월차', yearsWorked: '9.92', birthDate: '850617', department: 'Management', category: 'C-lev', position: 'Chief Executive Officer', level: 'D1', classLevel: '-', annualSalary: 111137280, monthlySalary: 9261440, contact: '01093090391', email: '' },
  { id: '2', employeeNo: 2, status: '재직중', joinDate: '2016/07/18', name: '사판 카디르', monthsWorked: '114개월차', yearsWorked: '9.50', birthDate: '921121', department: 'Creative Solution', category: 'Leader', position: 'Creative Director', level: 'L2', classLevel: 'A', annualSalary: 70985000, monthlySalary: 5915420, contact: '01029910391', email: '' },
  { id: '3', employeeNo: 3, status: '재직중', joinDate: '2018/06/01', name: '장요한', monthsWorked: '91개월차', yearsWorked: '7.58', birthDate: '900318', department: 'Production', category: 'Leader', position: 'Director', level: 'L1', classLevel: 'E', annualSalary: 69900000, monthlySalary: 5825000, contact: '01067760318', email: '' },
  { id: '4', employeeNo: 4, status: '재직중', joinDate: '2021/06/01', name: '박민규', monthsWorked: '55개월차', yearsWorked: '4.58', birthDate: '910610', department: 'Production', category: 'Senior', position: 'Producer', level: 'L1', classLevel: 'B', annualSalary: 62475000, monthlySalary: 5206250, contact: '01025542863', email: '' },
  { id: '5', employeeNo: 5, status: '재직중', joinDate: '2021/12/01', name: '임혁', monthsWorked: '49개월차', yearsWorked: '4.08', birthDate: '950821', department: 'Production', category: 'Senior', position: 'Director', level: 'S1', classLevel: 'C', annualSalary: 46972750, monthlySalary: 3914400, contact: '01091249262', email: '' },
  { id: '6', employeeNo: 6, status: '재직중', joinDate: '2022/01/05', name: '이정헌', monthsWorked: '48개월차', yearsWorked: '4.00', birthDate: '950125', department: 'Production', category: 'Junior', position: '3D Designer', level: 'P1', classLevel: 'D', annualSalary: 38675000, monthlySalary: 3222920, contact: '01050230483', email: '' },
  { id: '7', employeeNo: 7, status: '재직중', joinDate: '2022/04/01', name: '홍원준', monthsWorked: '45개월차', yearsWorked: '3.75', birthDate: '861206', department: 'Production', category: 'Leader', position: 'Executive Producer', level: 'L1', classLevel: 'C', annualSalary: 66010000, monthlySalary: 5500840, contact: '01034341916', email: '' },
  { id: '8', employeeNo: 8, status: '재직중', joinDate: '2022/07/11', name: '백송희', monthsWorked: '42개월차', yearsWorked: '3.50', birthDate: '941123', department: 'Production', category: 'Senior', position: 'Line Producer', level: 'S1', classLevel: 'C', annualSalary: 44950000, monthlySalary: 3745840, contact: '01080786808', email: '' },
  { id: '9', employeeNo: 9, status: '재직중', joinDate: '2022/09/01', name: '정승채', monthsWorked: '40개월차', yearsWorked: '3.33', birthDate: '880126', department: 'Production', category: 'Senior', position: 'Managing Director', level: 'S2', classLevel: 'C', annualSalary: 54950000, monthlySalary: 4579170, contact: '01073213025', email: '' },
  { id: '10', employeeNo: 10, status: '재직중', joinDate: '2024/01/29', name: '한상현', monthsWorked: '23개월차', yearsWorked: '1.92', birthDate: '920521', department: 'Production', category: 'Senior', position: 'Editing Director', level: 'S1', classLevel: 'D', annualSalary: 47871750, monthlySalary: 3989320, contact: '01077941013', email: '' },
  { id: '11', employeeNo: 11, status: '재직중', joinDate: '2024/06/01', name: '김현진', monthsWorked: '19개월차', yearsWorked: '1.58', birthDate: '960319', department: 'Production', category: 'Junior', position: 'Assistant Director', level: 'P', classLevel: 'E', annualSalary: 34900000, monthlySalary: 2908340, contact: '01053252452', email: '' },
  { id: '12', employeeNo: 12, status: '재직중', joinDate: '2024/08/01', name: '안지민', monthsWorked: '17개월차', yearsWorked: '1.42', birthDate: '970922', department: 'Creative Solution', category: 'Senior', position: 'Senior Art Director', level: 'S1', classLevel: 'A', annualSalary: 40000000, monthlySalary: 3333340, contact: '01055132209', email: '' },
  { id: '13', employeeNo: 13, status: '재직중', joinDate: '2024/10/07', name: '티아고 소우자', monthsWorked: '15개월차', yearsWorked: '1.25', birthDate: '921006', department: 'Production', category: 'Mid', position: 'Senior 3D Designer', level: 'S2', classLevel: 'D', annualSalary: 57420000, monthlySalary: 4785000, contact: '01066296632', email: '' },
  { id: '14', employeeNo: 14, status: '재직중', joinDate: '2024/11/25', name: '표인하', monthsWorked: '13개월차', yearsWorked: '1.08', birthDate: '890410', department: 'Management', category: 'Junior', position: 'Finance Manager', level: 'S1', classLevel: 'A', annualSalary: 42400000, monthlySalary: 3533340, contact: '01038008842', email: 'ooodj@naver.com' },
  { id: '15', employeeNo: 15, status: '재직중', joinDate: '2025/01/02', name: '이지수', monthsWorked: '12개월차', yearsWorked: '1.00', birthDate: '990614', department: 'Creative Solution', category: 'Junior', position: 'Art Director', level: 'P', classLevel: 'A', annualSalary: 31997880, monthlySalary: 2666490, contact: '01067570491', email: '' },
  { id: '16', employeeNo: 16, status: '재직중', joinDate: '2025/02/03', name: '이지우', monthsWorked: '11개월차', yearsWorked: '0.92', birthDate: '971222', department: 'Production', category: 'Junior', position: 'Assistant Director', level: 'P', classLevel: 'C', annualSalary: 31997880, monthlySalary: 2666490, contact: '01091279626', email: '' },
  { id: '17', employeeNo: 17, status: '재직중', joinDate: '2025/03/04', name: '고민혁', monthsWorked: '10개월차', yearsWorked: '0.83', birthDate: '970101', department: 'Management', category: 'Junior', position: 'General Affairs Manager', level: 'P', classLevel: 'E', annualSalary: 34000000, monthlySalary: 2833340, contact: '01043593087', email: 'rhalsgurdl@naver.com' },
  { id: '18', employeeNo: 18, status: '재직중', joinDate: '2025/05/19', name: '이봄이', monthsWorked: '8개월차', yearsWorked: '0.67', birthDate: '910420', department: 'Creative Solution', category: 'Senior', position: 'Creative Manager', level: 'S1', classLevel: 'B', annualSalary: 42700000, monthlySalary: 3558340, contact: '01073562905', email: 'bomeelee2@naver.com' },
  { id: '19', employeeNo: 19, status: '재직중', joinDate: '2025/05/26', name: '정재영', monthsWorked: '7개월차', yearsWorked: '0.58', birthDate: '010325', department: 'Creative Solution', category: 'Junior', position: 'Art Director', level: 'P', classLevel: 'A', annualSalary: 31997880, monthlySalary: 2666490, contact: '01071359633', email: 'minhojenny@naver.com' },
  { id: '20', employeeNo: 20, status: '재직중', joinDate: '2025/06/02', name: '권설', monthsWorked: '7개월차', yearsWorked: '0.58', birthDate: '960116', department: 'Production', category: 'Junior', position: '3D Designer', level: 'P1', classLevel: 'A', annualSalary: 35600000, monthlySalary: 2966670, contact: '01040894869', email: 'ksul0116@gmail.com' },
  { id: '21', employeeNo: 21, status: '재직중', joinDate: '2025/10/13', name: '정형화', monthsWorked: '3개월차', yearsWorked: '0.25', birthDate: '910406', department: 'Production', category: 'Junior', position: 'Line Producer', level: 'P1', classLevel: 'C', annualSalary: 38000000, monthlySalary: 3166670, contact: '01077666833', email: 'junghh91@gmail.com' },
  { id: '22', employeeNo: 22, status: '재직중', joinDate: '2025/12/18', name: '김기배', monthsWorked: '1개월차', yearsWorked: '0.08', birthDate: '950921', department: 'Production', category: 'Senior', position: '2D Designer', level: 'S1', classLevel: 'D', annualSalary: 47800000, monthlySalary: 3983340, contact: '01074502857', email: 'wrose1202@gmail.com' },
];

export function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(amount);
  };

  const parseCurrency = (value: string): number => {
    return Number(value.replace(/[^0-9]/g, '')) || 0;
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          emp.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;
    const matchesDepartment = filterDepartment === 'all' || emp.department === filterDepartment;
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const departments = [...new Set(employees.map(e => e.department))];

  const handleSave = (id: string) => {
    setEditingId(null);
    toast.success('임직원 정보가 수정되었습니다.');
  };

  const handleUpdate = (id: string, field: keyof Employee, value: string | number) => {
    setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, [field]: value } : emp));
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="이름, 부서, 직책 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="재직상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="재직중">재직중</SelectItem>
              <SelectItem value="퇴사">퇴사</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="부서" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 부서</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            내보내기
          </Button>
        </div>
      </Card>

      {/* Employee Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">사번</TableHead>
                <TableHead className="w-[70px]">상태</TableHead>
                <TableHead className="w-[100px]">입사일</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>부서</TableHead>
                <TableHead>구분</TableHead>
                <TableHead>직책</TableHead>
                <TableHead className="w-[60px]">직급</TableHead>
                <TableHead className="w-[60px]">호봉</TableHead>
                <TableHead className="text-right w-[120px]">연봉</TableHead>
                <TableHead className="text-right w-[110px]">월급여</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => (
                editingId === emp.id ? (
                  <TableRow key={emp.id} className="bg-blue-50/50">
                    <TableCell>{emp.employeeNo}</TableCell>
                    <TableCell>
                      <Select value={emp.status} onValueChange={(v) => handleUpdate(emp.id, 'status', v as '재직중' | '퇴사')}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="재직중">재직중</SelectItem>
                          <SelectItem value="퇴사">퇴사</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input value={emp.joinDate} onChange={(e) => handleUpdate(emp.id, 'joinDate', e.target.value)} className="h-8 w-[100px]" />
                    </TableCell>
                    <TableCell>
                      <Input value={emp.name} onChange={(e) => handleUpdate(emp.id, 'name', e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input value={emp.department} onChange={(e) => handleUpdate(emp.id, 'department', e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input value={emp.category} onChange={(e) => handleUpdate(emp.id, 'category', e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input value={emp.position} onChange={(e) => handleUpdate(emp.id, 'position', e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input value={emp.level} onChange={(e) => handleUpdate(emp.id, 'level', e.target.value)} className="h-8 w-[60px]" />
                    </TableCell>
                    <TableCell>
                      <Input value={emp.classLevel} onChange={(e) => handleUpdate(emp.id, 'classLevel', e.target.value)} className="h-8 w-[60px]" />
                    </TableCell>
                    <TableCell>
                      <Input value={emp.annualSalary.toLocaleString('ko-KR')} onChange={(e) => handleUpdate(emp.id, 'annualSalary', parseCurrency(e.target.value))} className="h-8 text-right" />
                    </TableCell>
                    <TableCell>
                      <Input value={emp.monthlySalary.toLocaleString('ko-KR')} onChange={(e) => handleUpdate(emp.id, 'monthlySalary', parseCurrency(e.target.value))} className="h-8 text-right" />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSave(emp.id)}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow 
                    key={emp.id} 
                    className="hover:bg-muted/10 cursor-pointer"
                    onClick={() => setEditingId(emp.id)}
                  >
                    <TableCell className="text-muted-foreground">{emp.employeeNo}</TableCell>
                    <TableCell>
                      <Badge variant={emp.status === '재직중' ? 'default' : 'secondary'} className="text-xs">
                        {emp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.joinDate}</TableCell>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>{emp.category}</TableCell>
                    <TableCell>{emp.position}</TableCell>
                    <TableCell><Badge variant="outline">{emp.level}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{emp.classLevel}</TableCell>
                    <TableCell className="text-right">{formatCurrency(emp.annualSalary)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(emp.monthlySalary)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="p-4 border-t bg-muted/30">
          <p className="text-sm text-muted-foreground">
            총 {filteredEmployees.length}명 (재직중: {filteredEmployees.filter(e => e.status === '재직중').length}명)
          </p>
        </div>
      </Card>
    </div>
  );
}
