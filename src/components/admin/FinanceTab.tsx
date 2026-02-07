import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { AutoFitText } from '@/components/ui/auto-fit-text';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  PiggyBank,
  BarChart3,
  FileCheck,
  Calendar,
  FileText,
  LineChart,
  Coins,
  Building2,
  Users,
  Film,
} from 'lucide-react';
import { ContractStatusSection } from './finance/ContractStatusSection';
import { ExpenseScheduleSection } from './finance/ExpenseScheduleSection';
import { ExpenseDetailSection } from './finance/ExpenseDetailSection';
import { AnnualPLSection } from './finance/AnnualPLSection';
import { ProfitDistributionSection } from './finance/ProfitDistributionSection';
import { annualFinancials } from '@/mock/data';
import { formatKRW } from '@/lib/format';

// 억 단위 포맷
const formatBillions = (v: number) => `${(v / 100000000).toFixed(1)}억`;

// Available years from data
const availableYears = annualFinancials.map(f => f.year);

export function FinanceTab() {
  const [selectedYear, setSelectedYear] = useState(availableYears[0].toString());
  
  const yearNum = parseInt(selectedYear);
  const currentData = annualFinancials.find(f => f.year === yearNum) || annualFinancials[0];
  
  const totalExpense = currentData.overhead.total + currentData.productionPayroll.total + currentData.productionCost.total;
  const netProfit = currentData.revenue - totalExpense;
  const profitRate = ((netProfit / currentData.revenue) * 100).toFixed(1);

  const stats = [
    { 
      label: '연 매출 (공급가)', 
      value: formatBillions(currentData.revenue), 
      sub: formatKRW(currentData.revenue),
      icon: TrendingUp, 
      color: 'text-emerald-500', 
      bgColor: 'bg-emerald-100' 
    },
    { 
      label: '경상비', 
      value: formatBillions(currentData.overhead.total), 
      sub: `매출 대비 ${((currentData.overhead.total / currentData.revenue) * 100).toFixed(1)}%`,
      icon: Building2, 
      color: 'text-red-500', 
      bgColor: 'bg-red-100' 
    },
    { 
      label: '인건비', 
      value: formatBillions(currentData.productionPayroll.total), 
      sub: `매출 대비 ${((currentData.productionPayroll.total / currentData.revenue) * 100).toFixed(1)}%`,
      icon: Users, 
      color: 'text-orange-500', 
      bgColor: 'bg-orange-100' 
    },
    { 
      label: '촬영진행비', 
      value: formatBillions(currentData.productionCost.total), 
      sub: `매출 대비 ${((currentData.productionCost.total / currentData.revenue) * 100).toFixed(1)}%`,
      icon: Film, 
      color: 'text-amber-500', 
      bgColor: 'bg-amber-100' 
    },
    { 
      label: '순이익', 
      value: formatBillions(netProfit), 
      sub: formatKRW(netProfit),
      icon: PiggyBank, 
      color: 'text-blue-500', 
      bgColor: 'bg-blue-100' 
    },
    { 
      label: '수익률', 
      value: `${profitRate}%`, 
      sub: currentData.isTarget ? '목표' : '실적 확정',
      icon: BarChart3, 
      color: 'text-violet-500', 
      bgColor: 'bg-violet-100' 
    },
  ];

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <div className="flex items-center gap-3">
        {availableYears.map((year) => {
          const fy = annualFinancials.find(f => f.year === year)!;
          const isActive = selectedYear === year.toString();
          return (
            <button
              key={year}
              onClick={() => setSelectedYear(year.toString())}
              className={`
                relative flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 transition-all font-medium
                ${isActive 
                  ? 'border-primary bg-primary/5 text-primary shadow-sm' 
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }
              `}
            >
              <span className="text-base font-bold">{year}년</span>
              <Badge 
                variant={fy.isTarget ? 'outline' : 'default'}
                className={`text-xs ${isActive ? '' : 'opacity-70'}`}
              >
                {fy.isTarget ? '목표' : '실적'}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Summary Stats - 6 cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-3 sm:p-4 shadow-card overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${stat.bgColor} flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</p>
                <AutoFitText className="text-sm sm:text-lg font-bold text-foreground">{stat.value}</AutoFitText>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Finance Sub-tabs - 5 tabs */}
      <Tabs defaultValue="contract" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="contract" className="gap-1.5 text-xs sm:text-sm">
            <FileCheck className="w-4 h-4" />
            <span className="hidden sm:inline">계약현황</span>
            <span className="sm:hidden">계약</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5 text-xs sm:text-sm">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">지출 예정</span>
            <span className="sm:hidden">예정</span>
          </TabsTrigger>
          <TabsTrigger value="detail" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">지출 세부</span>
            <span className="sm:hidden">세부</span>
          </TabsTrigger>
          <TabsTrigger value="pl" className="gap-1.5 text-xs sm:text-sm">
            <LineChart className="w-4 h-4" />
            <span className="hidden sm:inline">연간 P&L</span>
            <span className="sm:hidden">P&L</span>
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-1.5 text-xs sm:text-sm">
            <Coins className="w-4 h-4" />
            <span className="hidden sm:inline">이익배분</span>
            <span className="sm:hidden">배분</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contract">
          <ContractStatusSection year={yearNum} />
        </TabsContent>
        
        <TabsContent value="schedule">
          <ExpenseScheduleSection year={yearNum} />
        </TabsContent>
        
        <TabsContent value="detail">
          <ExpenseDetailSection year={yearNum} />
        </TabsContent>

        <TabsContent value="pl">
          <AnnualPLSection year={yearNum} />
        </TabsContent>

        <TabsContent value="distribution">
          <ProfitDistributionSection year={yearNum} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
