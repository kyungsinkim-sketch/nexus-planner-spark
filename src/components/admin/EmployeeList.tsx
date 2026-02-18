import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Trash2, Search, Download, Edit2, KeyRound, Mail, UserPlus, ArrowUpDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useAdminEmployees } from '@/hooks/useAdmin';
import { AdminEmployee } from '@/types/admin';
import { useAppStore } from '@/stores/appStore';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface Employee extends AdminEmployee {
  monthsWorked: string;
  yearsWorked: string;
  birthDate: string;
  englishName: string;
}

// Derive English name from email: "kyungsin.kim@paulus.pro" → "Kim, Kyungsin"
function deriveEnglishName(email?: string): string {
  if (!email) return '-';
  const localPart = email.split('@')[0];
  // Handle formats: "firstname.lastname", "firstname", "something@naver.com" etc
  const parts = localPart.split('.');
  if (parts.length >= 2) {
    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const lastName = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1).toLowerCase();
    return `${lastName}, ${firstName}`;
  }
  // Single name
  return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
}

type SortField = 'join_date' | 'position' | 'level' | 'class_level' | 'annual_salary';

export function EmployeeList() {
  const { t } = useTranslation();
  const { employees: dbEmployees, updateEmployee, deleteEmployee, addEmployee, isLoading } = useAdminEmployees();
  const { currentUser } = useAppStore();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('join_date');
  const [sortAsc, setSortAsc] = useState(true);

  // Password reset dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Add employee dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmpData, setNewEmpData] = useState({
    name: '', email: '', department: '', position: '',
    level: 'P', class_level: 'A', join_date: '', status: '재직중' as string,
    annual_salary: 0, monthly_salary: 0,
  });

  // Tenure calculation helper
  const calculateTenure = (joinDate: string) => {
    const start = new Date(joinDate);
    const now = new Date();
    const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    const years = (diffMonths / 12).toFixed(2);
    return {
      months: `${diffMonths}${t('monthsUnit')}`,
      years: years
    };
  };

  // Sync DB data to local state
  useEffect(() => {
    if (dbEmployees) {
      const mapped: Employee[] = dbEmployees.map(emp => {
        const tenure = calculateTenure(emp.join_date);
        return {
          ...emp,
          monthsWorked: tenure.months,
          yearsWorked: tenure.years,
          birthDate: '000101',
          englishName: deriveEnglishName(emp.email),
        };
      });
      setEmployees(mapped);
    }
  }, [dbEmployees]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(amount);
  };

  const parseCurrency = (value: string): number => {
    return Number(value.replace(/[^0-9]/g, '')) || 0;
  };

  const filteredEmployees = employees
    .filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.englishName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || emp.status === filterStatus;
      const matchesDepartment = filterDepartment === 'all' || emp.department === filterDepartment;
      return matchesSearch && matchesStatus && matchesDepartment;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'join_date':
          cmp = new Date(a.join_date).getTime() - new Date(b.join_date).getTime();
          break;
        case 'position':
          cmp = a.position.localeCompare(b.position);
          break;
        case 'level':
          cmp = a.level.localeCompare(b.level);
          break;
        case 'class_level':
          cmp = a.class_level.localeCompare(b.class_level);
          break;
        case 'annual_salary':
          cmp = a.annual_salary - b.annual_salary;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

  const departments = [...new Set(employees.map(e => e.department))];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleSave = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;

    updateEmployee({
      id,
      updates: {
        name: emp.name,
        department: emp.department,
        position: emp.position,
        level: emp.level,
        class_level: emp.class_level,
        annual_salary: emp.annual_salary,
        monthly_salary: emp.monthly_salary,
        status: emp.status,
        contact: emp.phone,
        email: emp.email
      }
    });

    setEditingId(null);
  };

  const handleUpdate = (id: string, field: keyof Employee, value: string | number) => {
    setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, [field]: value } : emp));
  };

  const handleStatusChange = (id: string, newStatus: string) => {
    setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, status: newStatus } : emp));
    updateEmployee({ id, updates: { status: newStatus } });
    toast.success(`상태가 '${newStatus}'(으)로 변경되었습니다`);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('confirmDelete'))) {
      deleteEmployee(id);
    }
  };

  const openPasswordDialog = (emp: Employee) => {
    setPasswordTarget({ id: emp.id, name: emp.name, email: emp.email });
    setNewPasswordValue('');
    setConfirmPasswordValue('');
    setPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!passwordTarget) return;
    if (newPasswordValue.length < 6) {
      toast.error('비밀번호는 최소 6자 이상이어야 합니다');
      return;
    }
    if (newPasswordValue !== confirmPasswordValue) {
      toast.error('비밀번호가 일치하지 않습니다');
      return;
    }

    setIsResettingPassword(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.admin.updateUserById(passwordTarget.id, {
          password: newPasswordValue,
        });
        if (error) throw error;
      }
      toast.success(`${passwordTarget.name}님의 비밀번호가 변경되었습니다`);
      setPasswordDialogOpen(false);
    } catch (error: unknown) {
      toast.error('비밀번호 변경 실패: ' + (error instanceof Error ? error.message : ''));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleAddEmployee = () => {
    if (!newEmpData.name || !newEmpData.join_date) {
      toast.error('이름과 입사일은 필수입니다');
      return;
    }
    const newId = `emp-${Date.now()}`;
    const newNo = employees.length + 1;
    addEmployee?.({
      id: newId,
      employee_no: newNo,
      name: newEmpData.name,
      email: newEmpData.email || `${newEmpData.name.toLowerCase().replace(/\s+/g, '.')}@paulus.pro`,
      status: newEmpData.status,
      join_date: newEmpData.join_date,
      department: newEmpData.department || 'Production',
      position: newEmpData.position || 'Junior',
      category: 'Junior',
      level: newEmpData.level,
      class_level: newEmpData.class_level,
      annual_salary: newEmpData.annual_salary,
      monthly_salary: newEmpData.monthly_salary || Math.round(newEmpData.annual_salary / 12),
    });
    toast.success(`${newEmpData.name}님이 추가되었습니다`);
    setAddDialogOpen(false);
    setNewEmpData({
      name: '', email: '', department: '', position: '',
      level: 'P', class_level: 'A', join_date: '', status: '재직중',
      annual_salary: 0, monthly_salary: 0,
    });
  };

  if (isLoading && employees.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Loading employee list...</div>;
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground/50'}`} />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="재직중">{t('employeeActive')}</SelectItem>
              <SelectItem value="휴직중">휴직중</SelectItem>
              <SelectItem value="퇴사">{t('employeeInactive')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button size="sm" className="gap-2" onClick={() => setAddDialogOpen(true)}>
              <UserPlus className="w-4 h-4" />
              신규 입사자 추가
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            {t('export')}
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[60px] text-center">No.</TableHead>
                <TableHead className="w-[80px] text-center">{t('status')}</TableHead>
                <TableHead><SortButton field="join_date" label={t('joinDate')} /></TableHead>
                <TableHead>{t('name')}</TableHead>
                <TableHead>영문이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>{t('department')}</TableHead>
                <TableHead><SortButton field="position" label={t('position')} /></TableHead>
                <TableHead><SortButton field="level" label={t('grade')} /></TableHead>
                <TableHead><SortButton field="class_level" label={t('classLevel')} /></TableHead>
                <TableHead className="text-right"><SortButton field="annual_salary" label={t('annualSalary')} /></TableHead>
                <TableHead className="text-right">{t('monthlySalary')}</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((emp) => (
                <React.Fragment key={emp.id}>
                  {editingId === emp.id ? (
                    <TableRow className="bg-blue-50/50">
                      <TableCell className="text-center">{emp.employee_no}</TableCell>
                      <TableCell>
                        <Select
                          value={emp.status}
                          onValueChange={(val: string) => handleUpdate(emp.id, 'status', val)}
                        >
                          <SelectTrigger className="h-8 w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="재직중">{t('employeeActive')}</SelectItem>
                            <SelectItem value="휴직중">휴직중</SelectItem>
                            <SelectItem value="퇴사">{t('employeeInactive')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{emp.join_date}</TableCell>
                      <TableCell>
                        <Input
                          value={emp.name}
                          onChange={(e) => handleUpdate(emp.id, 'name', e.target.value)}
                          className="h-8 w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{emp.englishName}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={emp.email || ''}
                          onChange={(e) => handleUpdate(emp.id, 'email', e.target.value)}
                          className="h-8 w-[160px]"
                          placeholder="email@paulus.pro"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={emp.department}
                          onChange={(e) => handleUpdate(emp.id, 'department', e.target.value)}
                          className="h-8 w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={emp.position}
                          onChange={(e) => handleUpdate(emp.id, 'position', e.target.value)}
                          className="h-8 w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={emp.level}
                          onChange={(e) => handleUpdate(emp.id, 'level', e.target.value)}
                          className="h-8 w-[60px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={emp.class_level}
                          onChange={(e) => handleUpdate(emp.id, 'class_level', e.target.value)}
                          className="h-8 w-[50px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={emp.annual_salary.toLocaleString('ko-KR')}
                          onChange={(e) => handleUpdate(emp.id, 'annual_salary', parseCurrency(e.target.value))}
                          className="h-8 text-right w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={emp.monthly_salary.toLocaleString('ko-KR')}
                          onChange={(e) => handleUpdate(emp.id, 'monthly_salary', parseCurrency(e.target.value))}
                          className="h-8 text-right w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleSave(emp.id)}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setEditingId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow className="group hover:bg-muted/50">
                      <TableCell className="text-center text-muted-foreground">{emp.employee_no}</TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={emp.status}
                          onValueChange={(val) => handleStatusChange(emp.id, val)}
                        >
                          <SelectTrigger className="h-7 w-[80px] border-0 bg-transparent p-0 justify-center">
                            <Badge
                              variant={emp.status === '재직중' ? 'default' : 'secondary'}
                              className={`whitespace-nowrap cursor-pointer ${
                                emp.status === '재직중' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                                emp.status === '휴직중' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                                'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {emp.status}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="재직중">{t('employeeActive')}</SelectItem>
                            <SelectItem value="휴직중">휴직중</SelectItem>
                            <SelectItem value="퇴사">{t('employeeInactive')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{emp.join_date}</span>
                          <span className="text-xs text-muted-foreground">{emp.monthsWorked} ({emp.yearsWorked}{t('yearsUnit')})</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{emp.englishName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {emp.email || '-'}
                        </span>
                      </TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.position}</TableCell>
                      <TableCell><Badge variant="outline">{emp.level}</Badge></TableCell>
                      <TableCell className="text-center">{emp.class_level}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(emp.annual_salary)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(emp.monthly_salary)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => setEditingId(emp.id)} title="수정">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600" onClick={() => openPasswordDialog(emp)} title="비밀번호 변경">
                              <KeyRound className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => handleDelete(emp.id)} title="삭제">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Password Reset Dialog (Admin only) */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              비밀번호 변경
            </DialogTitle>
            <DialogDescription>
              {passwordTarget?.name}님의 비밀번호를 변경합니다
              {passwordTarget?.email && (
                <span className="block text-xs mt-1">{passwordTarget.email}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>새 비밀번호</Label>
              <Input
                type="password"
                placeholder="6자 이상 입력"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>비밀번호 확인</Label>
              <Input
                type="password"
                placeholder="비밀번호 재입력"
                value={confirmPasswordValue}
                onChange={(e) => setConfirmPasswordValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleResetPassword} disabled={isResettingPassword || !newPasswordValue}>
              {isResettingPassword ? '변경 중...' : '비밀번호 변경'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Employee Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              신규 입사자 등록
            </DialogTitle>
            <DialogDescription>
              새로운 임직원 정보를 입력해주세요
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 grid-cols-2">
            <div className="space-y-1.5">
              <Label>이름 *</Label>
              <Input
                placeholder="홍길동"
                value={newEmpData.name}
                onChange={(e) => setNewEmpData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>이메일</Label>
              <Input
                placeholder="gildong.hong@paulus.pro"
                value={newEmpData.email}
                onChange={(e) => setNewEmpData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>입사일 *</Label>
              <Input
                type="date"
                value={newEmpData.join_date}
                onChange={(e) => setNewEmpData(prev => ({ ...prev, join_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>부서</Label>
              <Select value={newEmpData.department || 'Production'} onValueChange={(v) => setNewEmpData(prev => ({ ...prev, department: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>직책</Label>
              <Input
                placeholder="Assistant Director"
                value={newEmpData.position}
                onChange={(e) => setNewEmpData(prev => ({ ...prev, position: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>등급</Label>
              <Select value={newEmpData.level} onValueChange={(v) => setNewEmpData(prev => ({ ...prev, level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="D1">D1 (Director)</SelectItem>
                  <SelectItem value="L2">L2 (Leader)</SelectItem>
                  <SelectItem value="L1">L1 (Leader)</SelectItem>
                  <SelectItem value="S2">S2 (Senior)</SelectItem>
                  <SelectItem value="S1">S1 (Senior)</SelectItem>
                  <SelectItem value="P1">P1 (Junior)</SelectItem>
                  <SelectItem value="P">P (Junior)</SelectItem>
                  <SelectItem value="Intern">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>연봉</Label>
              <Input
                type="number"
                placeholder="35000000"
                value={newEmpData.annual_salary || ''}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setNewEmpData(prev => ({ ...prev, annual_salary: val, monthly_salary: Math.round(val / 12) }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>월급 (자동계산)</Label>
              <Input
                type="number"
                value={newEmpData.monthly_salary || ''}
                onChange={(e) => setNewEmpData(prev => ({ ...prev, monthly_salary: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>취소</Button>
            <Button onClick={handleAddEmployee}>등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
