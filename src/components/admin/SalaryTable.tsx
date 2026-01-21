import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, Download } from 'lucide-react';
import { toast } from 'sonner';

interface SalaryGrade {
  id: string;
  category: string; // DIRECTOR, LEADER, SENIOR, JUNIOR, INTERN
  level: string;
  classLevel: string;
  annualSalary: number;
  monthlySalary: number;
  hourlyWage: number;
  baseSalary: number;
  fixedOvertime: number;
  mealAllowance: number;
  probationSalary: number;
  promotionCondition: string;
  tenureRequirement: string;
  experienceRequirement: string;
}

const mockSalaryGrades: SalaryGrade[] = [
  { id: '1', category: 'DIRECTOR', level: 'D1', classLevel: '-', annualSalary: 80000000, monthlySalary: 6666670, hourlyWage: 27057, baseSalary: 5654951, fixedOvertime: 811715, mealAllowance: 200000, probationSalary: 6000000, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '2', category: 'LEADER', level: 'L2', classLevel: 'E', annualSalary: 79900000, monthlySalary: 6658340, hourlyWage: 27022, baseSalary: 5647664, fixedOvertime: 810669, mealAllowance: 200000, probationSalary: 6012500, promotionCondition: '승직가능', tenureRequirement: '기본 1년 (상시가능)', experienceRequirement: '7년 이상 10년 미만' },
  { id: '3', category: 'LEADER', level: 'L2', classLevel: 'D', annualSalary: 77425000, monthlySalary: 6452090, hourlyWage: 26159, baseSalary: 5467303, fixedOvertime: 784780, mealAllowance: 200000, probationSalary: 5826875, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '4', category: 'LEADER', level: 'L2', classLevel: 'C', annualSalary: 74950000, monthlySalary: 6245840, hourlyWage: 25296, baseSalary: 5286942, fixedOvertime: 758891, mealAllowance: 200000, probationSalary: 5641250, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '5', category: 'LEADER', level: 'L2', classLevel: 'B', annualSalary: 72475000, monthlySalary: 6039590, hourlyWage: 24433, baseSalary: 5106581, fixedOvertime: 733002, mealAllowance: 200000, probationSalary: 5455625, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '6', category: 'LEADER', level: 'L2', classLevel: 'A', annualSalary: 70000000, monthlySalary: 5833340, hourlyWage: 23570, baseSalary: 4926220, fixedOvertime: 707113, mealAllowance: 200000, probationSalary: 5270000, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '7', category: 'LEADER', level: 'L1', classLevel: 'E', annualSalary: 69900000, monthlySalary: 5825000, hourlyWage: 23536, baseSalary: 4918933, fixedOvertime: 706067, mealAllowance: 200000, probationSalary: 5262500, promotionCondition: '승직가능', tenureRequirement: '1년마다 연봉협상', experienceRequirement: '5년 이상 7년 미만' },
  { id: '8', category: 'LEADER', level: 'L1', classLevel: 'D', annualSalary: 67425000, monthlySalary: 5618750, hourlyWage: 22673, baseSalary: 4738572, fixedOvertime: 680178, mealAllowance: 200000, probationSalary: 5076875, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '9', category: 'LEADER', level: 'L1', classLevel: 'C', annualSalary: 64950000, monthlySalary: 5412500, hourlyWage: 21810, baseSalary: 4558211, fixedOvertime: 654289, mealAllowance: 200000, probationSalary: 4891250, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '10', category: 'LEADER', level: 'L1', classLevel: 'B', annualSalary: 62475000, monthlySalary: 5206250, hourlyWage: 20947, baseSalary: 4377850, fixedOvertime: 628400, mealAllowance: 200000, probationSalary: 4705625, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '11', category: 'LEADER', level: 'L1', classLevel: 'A', annualSalary: 60000000, monthlySalary: 5000000, hourlyWage: 20084, baseSalary: 4197490, fixedOvertime: 602510, mealAllowance: 200000, probationSalary: 4520000, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '12', category: 'SENIOR', level: 'S2', classLevel: 'E', annualSalary: 59900000, monthlySalary: 4991670, hourlyWage: 20049, baseSalary: 4190202, fixedOvertime: 601464, mealAllowance: 200000, probationSalary: 4512500, promotionCondition: 'P4-A~C로 가능', tenureRequirement: '1년마다 연봉협상', experienceRequirement: '4년 이상 5년 미만' },
  { id: '13', category: 'SENIOR', level: 'S2', classLevel: 'D', annualSalary: 57425000, monthlySalary: 4785420, hourlyWage: 19186, baseSalary: 4009841, fixedOvertime: 575575, mealAllowance: 200000, probationSalary: 4326875, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '14', category: 'SENIOR', level: 'S2', classLevel: 'C', annualSalary: 54950000, monthlySalary: 4579170, hourlyWage: 18323, baseSalary: 3829480, fixedOvertime: 549686, mealAllowance: 200000, probationSalary: 4141250, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '15', category: 'SENIOR', level: 'S2', classLevel: 'B', annualSalary: 52475000, monthlySalary: 4372920, hourlyWage: 17460, baseSalary: 3649120, fixedOvertime: 523797, mealAllowance: 200000, probationSalary: 3955625, promotionCondition: '승직불가', tenureRequirement: '', experienceRequirement: '3년 이상 4년 미만' },
  { id: '16', category: 'SENIOR', level: 'S2', classLevel: 'A', annualSalary: 50000000, monthlySalary: 4166670, hourlyWage: 16597, baseSalary: 3468759, fixedOvertime: 497908, mealAllowance: 200000, probationSalary: 3770000, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '17', category: 'SENIOR', level: 'S1', classLevel: 'E', annualSalary: 49900000, monthlySalary: 4158340, hourlyWage: 16562, baseSalary: 3461471, fixedOvertime: 496862, mealAllowance: 200000, probationSalary: 3762500, promotionCondition: '', tenureRequirement: '1년마다 연봉협상', experienceRequirement: '' },
  { id: '18', category: 'SENIOR', level: 'S1', classLevel: 'D', annualSalary: 47425000, monthlySalary: 3952090, hourlyWage: 15699, baseSalary: 3281111, fixedOvertime: 470973, mealAllowance: 200000, probationSalary: 3576875, promotionCondition: 'P3-A~C로 가능', tenureRequirement: '', experienceRequirement: '' },
  { id: '19', category: 'SENIOR', level: 'S1', classLevel: 'C', annualSalary: 44950000, monthlySalary: 3745840, hourlyWage: 14836, baseSalary: 3100750, fixedOvertime: 445084, mealAllowance: 200000, probationSalary: 3391250, promotionCondition: '', tenureRequirement: '1년마다 연봉협상', experienceRequirement: '2년 이상 3년 미만' },
  { id: '20', category: 'SENIOR', level: 'S1', classLevel: 'B', annualSalary: 42475000, monthlySalary: 3539590, hourlyWage: 13973, baseSalary: 2920389, fixedOvertime: 419195, mealAllowance: 200000, probationSalary: 3205625, promotionCondition: '승직불가', tenureRequirement: '', experienceRequirement: '' },
  { id: '21', category: 'SENIOR', level: 'S1', classLevel: 'A', annualSalary: 40000000, monthlySalary: 3333340, hourlyWage: 13110, baseSalary: 2740028, fixedOvertime: 393305, mealAllowance: 200000, probationSalary: 3020000, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '22', category: 'JUNIOR', level: 'P1', classLevel: 'E', annualSalary: 39900000, monthlySalary: 3325000, hourlyWage: 13075, baseSalary: 2732741, fixedOvertime: 392259, mealAllowance: 200000, probationSalary: 3012500, promotionCondition: 'P2-A~C로 가능', tenureRequirement: '상시적으로 연봉통보 (또는 1년주기)', experienceRequirement: '1년 이상 2년 미만' },
  { id: '23', category: 'JUNIOR', level: 'P1', classLevel: 'D', annualSalary: 38675000, monthlySalary: 3222920, hourlyWage: 12648, baseSalary: 2643471, fixedOvertime: 379446, mealAllowance: 200000, probationSalary: 2920625, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '24', category: 'JUNIOR', level: 'P1', classLevel: 'C', annualSalary: 37450000, monthlySalary: 3120840, hourlyWage: 12221, baseSalary: 2554202, fixedOvertime: 366632, mealAllowance: 200000, probationSalary: 2828750, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '25', category: 'JUNIOR', level: 'P1', classLevel: 'B', annualSalary: 36225000, monthlySalary: 3018750, hourlyWage: 11794, baseSalary: 2464932, fixedOvertime: 353818, mealAllowance: 200000, probationSalary: 2736875, promotionCondition: '승직불가', tenureRequirement: '', experienceRequirement: '' },
  { id: '26', category: 'JUNIOR', level: 'P1', classLevel: 'A', annualSalary: 35000000, monthlySalary: 2916670, hourlyWage: 11367, baseSalary: 2375662, fixedOvertime: 341004, mealAllowance: 200000, probationSalary: 2645000, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '27', category: 'JUNIOR', level: 'P', classLevel: 'E', annualSalary: 34900000, monthlySalary: 2908340, hourlyWage: 11332, baseSalary: 2368375, fixedOvertime: 339958, mealAllowance: 200000, probationSalary: 2637500, promotionCondition: 'P1-A~C로 가능', tenureRequirement: '상시적으로 연봉통보 (또는 1년주기)', experienceRequirement: '1년 미만' },
  { id: '28', category: 'JUNIOR', level: 'P', classLevel: 'D', annualSalary: 34104000, monthlySalary: 2842000, hourlyWage: 11054, baseSalary: 2310368, fixedOvertime: 331632, mealAllowance: 200000, probationSalary: 2577800, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '29', category: 'JUNIOR', level: 'P', classLevel: 'C', annualSalary: 33308000, monthlySalary: 2775670, hourlyWage: 10777, baseSalary: 2252361, fixedOvertime: 323305, mealAllowance: 200000, probationSalary: 2518100, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '30', category: 'JUNIOR', level: 'P', classLevel: 'B', annualSalary: 32512000, monthlySalary: 2709340, hourlyWage: 10499, baseSalary: 2194354, fixedOvertime: 314979, mealAllowance: 200000, probationSalary: 2458400, promotionCondition: '승직불가', tenureRequirement: '', experienceRequirement: '' },
  { id: '31', category: 'JUNIOR', level: 'P', classLevel: 'A', annualSalary: 31716000, monthlySalary: 2643000, hourlyWage: 10222, baseSalary: 2136347, fixedOvertime: 306653, mealAllowance: 200000, probationSalary: 2398700, promotionCondition: '', tenureRequirement: '', experienceRequirement: '' },
  { id: '32', category: 'INTERN', level: '', classLevel: '', annualSalary: 22080000, monthlySalary: 1840000, hourlyWage: 10000, baseSalary: 1680000, fixedOvertime: 0, mealAllowance: 160000, probationSalary: 0, promotionCondition: 'P-A,B로 가능', tenureRequirement: '3개월', experienceRequirement: '' },
];

export function SalaryTable() {
  const [grades, setGrades] = useState<SalaryGrade[]>(mockSalaryGrades);
  const [editingId, setEditingId] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', minimumFractionDigits: 0 }).format(amount);
  };

  const parseCurrency = (value: string): number => {
    return Number(value.replace(/[^0-9]/g, '')) || 0;
  };

  const handleSave = (id: string) => {
    setEditingId(null);
    toast.success('연봉 규정이 수정되었습니다.');
  };

  const handleUpdate = (id: string, field: keyof SalaryGrade, value: string | number) => {
    setGrades(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
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
  const groupedGrades = grades.reduce((acc, grade) => {
    if (!acc[grade.category]) acc[grade.category] = [];
    acc[grade.category].push(grade);
    return acc;
  }, {} as Record<string, SalaryGrade[]>);

  return (
    <div className="space-y-4">
      <Card className="p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">2025 파울러스 연봉규정표</h3>
            <p className="text-sm text-muted-foreground">ver. 2025.01.08 • 각 행을 클릭하여 수정</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            내보내기
          </Button>
        </div>
      </Card>

      <Card className="shadow-card overflow-hidden">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">구분</TableHead>
                <TableHead className="w-[60px]">직급</TableHead>
                <TableHead className="w-[50px]">호봉</TableHead>
                <TableHead className="text-right w-[110px]">연봉</TableHead>
                <TableHead className="text-right w-[100px]">월급여</TableHead>
                <TableHead className="text-right w-[80px]">시급</TableHead>
                <TableHead className="text-right w-[100px]">기본급</TableHead>
                <TableHead className="text-right w-[100px]">고정연장</TableHead>
                <TableHead className="text-right w-[70px]">식대</TableHead>
                <TableHead className="text-right w-[100px]">수습 90%</TableHead>
                <TableHead className="w-[100px]">승직구간</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedGrades).map(([category, categoryGrades]) => (
                <>
                  <TableRow key={`header-${category}`} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={12} className="py-2">
                      <Badge className={getCategoryColor(category)}>{category}</Badge>
                    </TableCell>
                  </TableRow>
                  {categoryGrades.map((grade) => (
                    editingId === grade.id ? (
                      <TableRow key={grade.id} className="bg-blue-50/50">
                        <TableCell></TableCell>
                        <TableCell>
                          <Input value={grade.level} onChange={(e) => handleUpdate(grade.id, 'level', e.target.value)} className="h-8 w-[60px]" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.classLevel} onChange={(e) => handleUpdate(grade.id, 'classLevel', e.target.value)} className="h-8 w-[50px]" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.annualSalary.toLocaleString('ko-KR')} onChange={(e) => handleUpdate(grade.id, 'annualSalary', parseCurrency(e.target.value))} className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.monthlySalary.toLocaleString('ko-KR')} onChange={(e) => handleUpdate(grade.id, 'monthlySalary', parseCurrency(e.target.value))} className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.hourlyWage.toLocaleString('ko-KR')} onChange={(e) => handleUpdate(grade.id, 'hourlyWage', parseCurrency(e.target.value))} className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.baseSalary.toLocaleString('ko-KR')} onChange={(e) => handleUpdate(grade.id, 'baseSalary', parseCurrency(e.target.value))} className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.fixedOvertime.toLocaleString('ko-KR')} onChange={(e) => handleUpdate(grade.id, 'fixedOvertime', parseCurrency(e.target.value))} className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.mealAllowance.toLocaleString('ko-KR')} onChange={(e) => handleUpdate(grade.id, 'mealAllowance', parseCurrency(e.target.value))} className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.probationSalary.toLocaleString('ko-KR')} onChange={(e) => handleUpdate(grade.id, 'probationSalary', parseCurrency(e.target.value))} className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input value={grade.promotionCondition} onChange={(e) => handleUpdate(grade.id, 'promotionCondition', e.target.value)} className="h-8" placeholder="-" />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => handleSave(grade.id)}>
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
                        key={grade.id} 
                        className="hover:bg-muted/10 cursor-pointer"
                        onClick={() => setEditingId(grade.id)}
                      >
                        <TableCell></TableCell>
                        <TableCell><Badge variant="outline">{grade.level || '-'}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{grade.classLevel || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(grade.annualSalary)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(grade.monthlySalary)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(grade.hourlyWage)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(grade.baseSalary)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(grade.fixedOvertime)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(grade.mealAllowance)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(grade.probationSalary)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{grade.promotionCondition || '-'}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    )
                  ))}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
