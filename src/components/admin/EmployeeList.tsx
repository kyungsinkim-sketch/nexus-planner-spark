import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Trash2, Search, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useAdminEmployees } from '@/hooks/useAdmin';
import { AdminEmployee } from '@/types/admin';

interface Employee extends AdminEmployee {
  monthsWorked: string;
  yearsWorked: string;
  birthDate: string; // Not in DB yet, mock or calculate
}

export function EmployeeList() {
  const { t } = useTranslation();
  const { employees: dbEmployees, updateEmployee, deleteEmployee, isLoading } = useAdminEmployees();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  // Tenure calculation helper
  const calculateTenure = (joinDate: string) => {
    const start = new Date(joinDate);
    const now = new Date();
    const diffMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    const years = (diffMonths / 12).toFixed(2);
    return {
      months: `${diffMonths}개월차`,
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
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteEmployee(id);
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
              <SelectItem value="재직중">Active</SelectItem>
              <SelectItem value="퇴사">Inactive</SelectItem>
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
                          onValueChange={(val: any) => handleUpdate(emp.id, 'status', val)}
                        >
                          <SelectTrigger className="h-8 w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="재직중">재직중</SelectItem>
                            <SelectItem value="퇴사">퇴사</SelectItem>
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
                          {emp.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{emp.join_date}</span>
                          <span className="text-xs text-muted-foreground">{emp.monthsWorked} ({emp.yearsWorked}년)</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.department}</TableCell>
                      <TableCell>{emp.position}</TableCell>
                      <TableCell><Badge variant="outline">{emp.level}</Badge></TableCell>
                      <TableCell className="text-center">{emp.class_level}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(emp.annual_salary)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(emp.monthly_salary)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600" onClick={() => setEditingId(emp.id)}>
                            <Search className="w-4 h-4" />
                            {/* Reusing Search icon as Edit icon temporarily or need to import Edit2 */}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => handleDelete(emp.id)}>
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
    </div>
  );
}
