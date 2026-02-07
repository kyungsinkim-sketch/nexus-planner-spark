import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { financeSummary } from '@/mock/data';
import { formatKRW } from '@/lib/format';

// 억 단위 포맷
const formatBillions = (v: number) => `${(v / 100000000).toFixed(1)}억`;

export function FinanceTab() {
  const stats = [
    { 
      label: '연 매출 (공급가)', 
      value: formatBillions(financeSummary.totalRevenue), 
      sub: formatKRW(financeSummary.totalRevenue),
      icon: TrendingUp, 
      color: 'text-emerald-500', 
      bgColor: 'bg-emerald-100' 
    },
    { 
      label: '경상비', 
      value: formatBillions(financeSummary.overhead), 
      sub: `매출 대비 ${((financeSummary.overhead / financeSummary.totalRevenue) * 100).toFixed(1)}%`,
      icon: Building2, 
      color: 'text-red-500', 
      bgColor: 'bg-red-100' 
    },
    { 
      label: '인건비', 
      value: formatBillions(financeSummary.productionPayroll), 
      sub: `매출 대비 ${((financeSummary.productionPayroll / financeSummary.totalRevenue) * 100).toFixed(1)}%`,
      icon: Users, 
      color: 'text-orange-500', 
      bgColor: 'bg-orange-100' 
    },
    { 
      label: '촬영진행비', 
      value: formatBillions(financeSummary.productionCost), 
      sub: `매출 대비 ${((financeSummary.productionCost / financeSummary.totalRevenue) * 100).toFixed(1)}%`,
      icon: Film, 
      color: 'text-amber-500', 
      bgColor: 'bg-amber-100' 
    },
    { 
      label: '순이익', 
      value: formatBillions(financeSummary.netProfit), 
      sub: formatKRW(financeSummary.netProfit),
      icon: PiggyBank, 
      color: 'text-blue-500', 
      bgColor: 'bg-blue-100' 
    },
    { 
      label: '수익률', 
      value: `${financeSummary.profitRate}%`, 
      sub: `${financeSummary.totalProjects}개 프로젝트`,
      icon: BarChart3, 
      color: 'text-violet-500', 
      bgColor: 'bg-violet-100' 
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Stats - 6 cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground truncate">{stat.sub}</p>
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
          <ContractStatusSection />
        </TabsContent>
        
        <TabsContent value="schedule">
          <ExpenseScheduleSection />
        </TabsContent>
        
        <TabsContent value="detail">
          <ExpenseDetailSection />
        </TabsContent>

        <TabsContent value="pl">
          <AnnualPLSection />
        </TabsContent>

        <TabsContent value="distribution">
          <ProfitDistributionSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
