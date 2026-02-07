import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useAdminSalaryGrades } from '@/hooks/useAdmin';
import { AdminSalaryGrade } from '@/types/admin';

export function SalaryTable() {
  const { t } = useTranslation();
  const { grades: dbGrades, updateGrade, isLoading } = useAdminSalaryGrades();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Local state for editing
  const [localGrades, setLocalGrades] = useState<AdminSalaryGrade[]>([]);

  // Sync DB data to local state when loaded
  useEffect(() => {
    if (dbGrades) {
      setLocalGrades(dbGrades);
    }
  }, [dbGrades]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(amount);
  };

  const parseCurrency = (value: string): number => {
    return Number(value.replace(/[^0-9]/g, '')) || 0;
  };

  const handleSave = (id: string) => {
    const grade = localGrades.find(g => g.id === id);
    if (!grade) return;

    updateGrade({
      id,
      updates: {
        annual_salary: grade.annual_salary,
        monthly_salary: grade.monthly_salary,
        hourly_wage: grade.hourly_wage,
        base_salary: grade.base_salary,
        fixed_overtime: grade.fixed_overtime,
        meal_allowance: grade.meal_allowance,
        probation_salary: grade.probation_salary,
        promotion_condition: grade.promotion_condition,
        tenure_requirement: grade.tenure_requirement,
        experience_requirement: grade.experience_requirement
      }
    });
    setEditingId(null);
  };

  const handleUpdate = (id: string, field: keyof AdminSalaryGrade, value: string | number) => {
    setLocalGrades(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'DIRECTOR': return 'bg-purple-100 text-purple-700';
      case 'LEADER': return 'bg-blue-100 text-blue-700';
      case 'SENIOR': return 'bg-emerald-100 text-emerald-700';
      case 'JUNIOR': return 'bg-amber-100 text-amber-700';
      case 'INTERN': return 'bg-gray-100 text-gray-700';
      default: return '';
    }
  };

  // Group by category for visual separation
  const groupedGrades = (localGrades || []).reduce((acc, grade) => {
    if (!acc[grade.category]) acc[grade.category] = [];
    acc[grade.category].push(grade);
    return acc;
  }, {} as Record<string, AdminSalaryGrade[]>);

  if (isLoading && localGrades.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Loading salary data...</div>;
  }

  return (
    <Card className="p-6 shadow-card overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{t('paulusSalaryTable')}</h3>
          <p className="text-sm text-muted-foreground">2025 Base Salary Regulations</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export functionality removed temporarily */}
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[10px]"></TableHead>
              <TableHead className="w-[80px]">{t('grade')}</TableHead>
              <TableHead className="w-[80px] text-center">{t('classLevel')}</TableHead>
              <TableHead className="w-[120px] text-right font-bold text-foreground">{t('annualSalary')}</TableHead>
              <TableHead className="w-[120px] text-right font-bold text-foreground">{t('monthlySalary')}</TableHead>
              <TableHead className="w-[100px] text-right text-xs">{t('hourlyWage')}</TableHead>
              <TableHead className="w-[100px] text-right text-xs">{t('baseSalary')}</TableHead>
              <TableHead className="w-[100px] text-right text-xs">{t('fixedOvertime')}</TableHead>
              <TableHead className="w-[100px] text-right text-xs">{t('mealAllowance')}</TableHead>
              <TableHead className="w-[100px] text-right text-xs">{t('probationSalary')}</TableHead>
              <TableHead className="w-[150px] text-xs">{t('promotionCondition')}</TableHead>
              <TableHead className="w-[150px] text-xs">{t('tenureRequirement')}</TableHead>
              <TableHead className="w-[150px] text-xs">{t('experienceRequirement')}</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedGrades).map(([category, items]) => (
              <React.Fragment key={category}>
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={14} className="py-2 font-semibold">
                    <Badge variant="outline" className={`${getCategoryColor(category)} border-0`}>
                      {category}
                    </Badge>
                  </TableCell>
                </TableRow>
                {items.map(grade => (
                  <React.Fragment key={grade.id}>
                    {editingId === grade.id ? (
                      <TableRow className="bg-blue-50/50">
                        <TableCell></TableCell>
                        <TableCell>
                          <Input value={grade.level || ''} onChange={(e) => handleUpdate(grade.id, 'level', e.target.value)} className="h-8 w-[60px]" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.class_level || ''} onChange={(e) => handleUpdate(grade.id, 'class_level', e.target.value)} className="h-8 w-[50px]" />
                        </TableCell>
                        <TableCell className="font-medium">
                          <Input
                            value={grade.annual_salary?.toLocaleString('ko-KR')}
                            onChange={(e) => handleUpdate(grade.id, 'annual_salary', parseCurrency(e.target.value))}
                            className="h-8 w-[100px] text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            value={grade.monthly_salary?.toLocaleString('ko-KR')}
                            onChange={(e) => handleUpdate(grade.id, 'monthly_salary', parseCurrency(e.target.value))}
                            className="h-8 w-[90px] text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.hourly_wage || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.base_salary || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.fixed_overtime || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.meal_allowance || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.probation_salary || 0)}</TableCell>
                        <TableCell>
                          <Input
                            value={grade.promotion_condition || ''}
                            onChange={(e) => handleUpdate(grade.id, 'promotion_condition', e.target.value)}
                            className="h-8 w-[100px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={grade.tenure_requirement || ''}
                            onChange={(e) => handleUpdate(grade.id, 'tenure_requirement', e.target.value)}
                            className="h-8 w-[100px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={grade.experience_requirement || ''}
                            onChange={(e) => handleUpdate(grade.id, 'experience_requirement', e.target.value)}
                            className="h-8 w-[100px]"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleSave(grade.id)}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => setEditingId(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow
                        className="hover:bg-muted/50 cursor-pointer group"
                        onClick={() => setEditingId(grade.id)}
                      >
                        <TableCell></TableCell>
                        <TableCell><Badge variant="secondary">{grade.level}</Badge></TableCell>
                        <TableCell className="text-center">{grade.class_level}</TableCell>
                        <TableCell className="font-medium text-right">{formatCurrency(grade.annual_salary || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(grade.monthly_salary || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.hourly_wage || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.base_salary || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.fixed_overtime || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.meal_allowance || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">{formatCurrency(grade.probation_salary || 0)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{grade.promotion_condition}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{grade.tenure_requirement}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{grade.experience_requirement}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
