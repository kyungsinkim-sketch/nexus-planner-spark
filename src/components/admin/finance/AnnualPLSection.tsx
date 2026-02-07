import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatKRW } from '@/lib/format';
import { annualFinancials, type AnnualFinancial } from '@/mock/data';

// 억 단위 포맷
const formatBillions = (v: number) => `${(v / 100000000).toFixed(1)}억`;

// 경상비 카테고리 라벨
const overheadLabels: Record<string, string> = {
  managementPayroll: '경영실 인건비',
  officeRent: '사무실 임대료',
  vehicleLease: '차량 리스',
  utilities: '통신/관리비',
  insurance: '보험료',
  fees: '수수료/자문료',
  loanInterest: '대출이자',
  taxes: '세금',
  supplies: '소모품/비품',
  welfare: '복리후생비',
  salesActivity: '영업활동비',
};

// 인건비 카테고리 라벨
const payrollLabels: Record<string, string> = {
  leaders: '리더급',
  seniors: '시니어',
  juniors: '주니어',
  interns: '인턴',
  contractors: '외주 인력',
  severance: '퇴직급여',
};

// 촬영진행비 라벨
const productionCostLabels: Record<string, string> = {
  projectProduction: '프로젝트 제작비',
  eventProduction: '행사 진행비',
  overseas: '해외 출장비',
};

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const changeRate = ((current - previous) / previous) * 100;
  const isPositive = changeRate > 0;
  const isZero = Math.abs(changeRate) < 0.1;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
      isZero ? 'text-muted-foreground' : isPositive ? 'text-red-600' : 'text-emerald-600'
    }`}>
      {isZero ? <Minus className="w-3 h-3" /> : isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isZero ? '0%' : `${isPositive ? '+' : ''}${changeRate.toFixed(1)}%`}
    </span>
  );
}

interface AnnualPLSectionProps {
  year: number;
}

export function AnnualPLSection({ year }: AnnualPLSectionProps) {
  const currentData = annualFinancials.find(f => f.year === year) || annualFinancials[0];
  const compareData = annualFinancials.find(f => f.year !== year);

  // 비교 차트 데이터
  const comparisonChartData = [
    {
      name: '매출',
      '2025 실적': annualFinancials[0].revenue / 100000000,
      '2026 목표': annualFinancials[1].revenue / 100000000,
    },
    {
      name: '경상비',
      '2025 실적': annualFinancials[0].overhead.total / 100000000,
      '2026 목표': annualFinancials[1].overhead.total / 100000000,
    },
    {
      name: '인건비',
      '2025 실적': annualFinancials[0].productionPayroll.total / 100000000,
      '2026 목표': annualFinancials[1].productionPayroll.total / 100000000,
    },
    {
      name: '제작비',
      '2025 실적': annualFinancials[0].productionCost.total / 100000000,
      '2026 목표': annualFinancials[1].productionCost.total / 100000000,
    },
    {
      name: '순이익',
      '2025 실적': annualFinancials[0].netProfit / 100000000,
      '2026 목표': annualFinancials[1].netProfit / 100000000,
    },
  ];

  const totalExpense = currentData.overhead.total + currentData.productionPayroll.total + currentData.productionCost.total;
  const profitRate = ((currentData.netProfit / currentData.revenue) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <h3 className="text-lg font-semibold text-foreground">
        {currentData.year}년 {currentData.isTarget ? '목표' : '실적'} 손익계산서
      </h3>

      {/* P&L Statement */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {currentData.year}년 {currentData.isTarget ? '목표' : '실적'} 손익계산서
            </CardTitle>
            <Badge variant={currentData.isTarget ? 'outline' : 'default'}>
              {currentData.isTarget ? '목표' : '확정'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* 매출액 */}
            <div className="flex items-center justify-between py-3 border-b-2 border-primary/20">
              <span className="font-semibold text-foreground">매출액 (공급가)</span>
              <span className="text-xl font-bold text-foreground">{formatKRW(currentData.revenue)}</span>
            </div>

            {/* 경상비 Accordion */}
            <Accordion type="single" collapsible className="border-none">
              <AccordionItem value="overhead" className="border-b">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="text-red-600 font-medium">(-) 경상비</span>
                    <div className="flex items-center gap-3">
                      {compareData && (
                        <ChangeIndicator
                          current={currentData.overhead.total}
                          previous={compareData.overhead.total}
                        />
                      )}
                      <span className="font-semibold text-red-600">{formatKRW(currentData.overhead.total)}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-4">
                    {Object.entries(overheadLabels).map(([key, label]) => {
                      const value = currentData.overhead[key as keyof typeof currentData.overhead] as number;
                      return (
                        <div key={key} className="flex items-center justify-between py-1 text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono">{formatKRW(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 인건비 */}
              <AccordionItem value="payroll" className="border-b">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="text-orange-600 font-medium">(-) 인건비 (프로덕션)</span>
                    <div className="flex items-center gap-3">
                      {compareData && (
                        <ChangeIndicator
                          current={currentData.productionPayroll.total}
                          previous={compareData.productionPayroll.total}
                        />
                      )}
                      <span className="font-semibold text-orange-600">{formatKRW(currentData.productionPayroll.total)}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-4">
                    {Object.entries(payrollLabels).map(([key, label]) => {
                      const value = currentData.productionPayroll[key as keyof typeof currentData.productionPayroll] as number;
                      return (
                        <div key={key} className="flex items-center justify-between py-1 text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono">{formatKRW(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 촬영진행비 */}
              <AccordionItem value="production" className="border-b">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="text-amber-600 font-medium">(-) 촬영진행비</span>
                    <div className="flex items-center gap-3">
                      {compareData && (
                        <ChangeIndicator
                          current={currentData.productionCost.total}
                          previous={compareData.productionCost.total}
                        />
                      )}
                      <span className="font-semibold text-amber-600">{formatKRW(currentData.productionCost.total)}</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-4">
                    {Object.entries(productionCostLabels).map(([key, label]) => {
                      const value = currentData.productionCost[key as keyof typeof currentData.productionCost] as number;
                      return (
                        <div key={key} className="flex items-center justify-between py-1 text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono">{formatKRW(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* 총 비용 */}
            <div className="flex items-center justify-between py-2 border-t">
              <span className="text-muted-foreground">총 비용</span>
              <span className="font-semibold text-muted-foreground">{formatKRW(totalExpense)}</span>
            </div>

            {/* 순이익 */}
            <div className="flex items-center justify-between py-3 border-t-2 border-primary/20 bg-primary/5 rounded-lg px-3 -mx-3">
              <div>
                <span className="font-bold text-lg text-foreground">순이익</span>
                <span className="ml-2 text-sm text-muted-foreground">수익률 {profitRate}%</span>
              </div>
              <span className={`text-xl font-bold ${currentData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatKRW(currentData.netProfit)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Year Comparison Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">2025 실적 vs 2026 목표 비교</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={comparisonChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis
                tickFormatter={(v) => `${v.toFixed(0)}억`}
                className="text-xs"
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}억`, '']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="2025 실적" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="2026 목표" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cost Structure Breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4 shadow-card">
          <p className="text-sm text-muted-foreground mb-1">경상비 비중</p>
          <p className="text-2xl font-bold text-foreground">
            {((currentData.overhead.total / currentData.revenue) * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">{formatBillions(currentData.overhead.total)}</p>
        </Card>
        <Card className="p-4 shadow-card">
          <p className="text-sm text-muted-foreground mb-1">인건비 비중</p>
          <p className="text-2xl font-bold text-foreground">
            {((currentData.productionPayroll.total / currentData.revenue) * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">{formatBillions(currentData.productionPayroll.total)}</p>
        </Card>
        <Card className="p-4 shadow-card">
          <p className="text-sm text-muted-foreground mb-1">제작비 비중</p>
          <p className="text-2xl font-bold text-foreground">
            {((currentData.productionCost.total / currentData.revenue) * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground">{formatBillions(currentData.productionCost.total)}</p>
        </Card>
      </div>
    </div>
  );
}
