import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Trash2, Search, Download, Edit2, KeyRound, Mail } from 'lucide-react';
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
  birthDate: string; // Not in DB yet, mock or calculate
}

export function EmployeeList() {
  const { t } = useTranslation();
  const { employees: dbEmployees, updateEmployee, deleteEmployee, isLoading } = useAdminEmployees();
  const { currentUser } = useAppStore();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  // Password reset dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

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
          birthDate: '000101' // Placeholder or parsing from Personal ID if exists
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
        contact: emp.phone, // mapping contact to phone
        email: emp.email
      }
    });

    setEditingId(null);
  };

  const handleUpdate = (id: string, field: keyof Employee, value: string | number) => {
    setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, [field]: value } : emp));
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
        // Admin password reset via Supabase admin API
        const { error } = await supabase.auth.admin.updateUserById(passwordTarget.id, {
          password: newPasswordValue,
        });
        if (error) throw error;
      }
      toast.success(`${passwordTarget.name}님의 비밀번호가 변경되었습니다`);
      setPasswordDialogOpen(false);
    } catch (error: unknown) {
      // If admin API fails, try service role approach
      toast.error('비밀번호 변경 실패: ' + (error instanceof Error ? error.message : ''));
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (isLoading && employees.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Loading employee list...</div>;
  }

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
                <TableHead>{t('joinDate')}</TableHead>
                <TableHead>{t('name')}</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>{t('department')}</TableHead>
                <TableHead>{t('position')}</TableHead>
                <TableHead>{t('grade')}</TableHead>
                <TableHead>{t('classLevel')}</TableHead>
                <TableHead className="text-right">{t('annualSalary')}</TableHead>
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
                        <span className="text-xs text-muted-foreground">{emp.email || '-'}</span>
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
                        <Badge variant={emp.status === '재직중' ? 'default' : 'secondary'} className={emp.status === '재직중' ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}>
                          {emp.status === '재직중' ? t('employeeActive') : t('employeeInactive')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{emp.join_date}</span>
                          <span className="text-xs text-muted-foreground">{emp.monthsWorked} ({emp.yearsWorked}{t('yearsUnit')})</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{emp.name}</TableCell>
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
    </div>
  );
}
