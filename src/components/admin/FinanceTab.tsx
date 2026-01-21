import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  BarChart3,
  FileText
} from 'lucide-react';

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

      {/* Placeholder Content */}
      <Card className="p-12 text-center shadow-card">
        <DollarSign className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="text-lg font-semibold text-foreground mb-2">재무 관리 모듈</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          매출/지출 분석, 프로젝트별 수익성 분석, 현금흐름 관리, 예산 대비 실적 추적 등 
          재무 관련 기능이 이 섹션에서 제공될 예정입니다.
        </p>
        <div className="flex items-center justify-center gap-2 mt-6">
          <Badge variant="secondary">Coming Soon</Badge>
        </div>
      </Card>
    </div>
  );
}
