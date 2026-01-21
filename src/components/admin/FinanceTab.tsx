import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  BarChart3,
  FileCheck,
  Calendar,
  FileText
} from 'lucide-react';
import { ContractStatusSection } from './finance/ContractStatusSection';
import { ExpenseScheduleSection } from './finance/ExpenseScheduleSection';
import { ExpenseDetailSection } from './finance/ExpenseDetailSection';

export function FinanceTab() {
  const stats = [
    { label: '월 매출', value: '₩480,000,000', change: '+12.5%', trend: 'up', icon: TrendingUp, color: 'text-emerald-500', bgColor: 'bg-emerald-100' },
    { label: '월 지출', value: '₩320,000,000', change: '+8.2%', trend: 'up', icon: TrendingDown, color: 'text-orange-500', bgColor: 'bg-orange-100' },
    { label: '순이익', value: '₩160,000,000', change: '+18.3%', trend: 'up', icon: PiggyBank, color: 'text-blue-500', bgColor: 'bg-blue-100' },
    { label: '수익률', value: '33.3%', change: '+2.1%p', trend: 'up', icon: BarChart3, color: 'text-violet-500', bgColor: 'bg-violet-100' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                <p className={`text-xs ${stat.trend === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {stat.change} vs 전월
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Finance Sub-tabs */}
      <Tabs defaultValue="contract" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="contract" className="gap-2">
            <FileCheck className="w-4 h-4" />
            계약현황
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="w-4 h-4" />
            지출 예정
          </TabsTrigger>
          <TabsTrigger value="detail" className="gap-2">
            <FileText className="w-4 h-4" />
            지출 세부
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
      </Tabs>
    </div>
  );
}
