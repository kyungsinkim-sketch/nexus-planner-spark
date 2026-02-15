import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AutoFitText } from '@/components/ui/auto-fit-text';
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
import { useTranslation } from '@/hooks/useTranslation';

// 억 단위 포맷
const formatBillions = (v: number) => `${(v / 100000000).toFixed(1)}억`;

// Overhead category keys for label lookup
const overheadKeys: Record<string, string> = {
  managementPayroll: 'overheadManagementPayroll',
  officeRent: 'overheadOfficeRent',
  vehicleLease: 'overheadVehicleLease',
  utilities: 'overheadUtilities',
  insurance: 'overheadInsurance',
  fees: 'overheadFees',
  loanInterest: 'overheadLoanInterest',
  taxes: 'overheadTaxes',
  supplies: 'overheadSupplies',
  welfare: 'overheadWelfare',
  salesActivity: 'overheadSalesActivity',
};

// Payroll category keys for label lookup
const payrollKeys: Record<string, string> = {
  leaders: 'payrollLeaders',
  seniors: 'payrollSeniors',
  juniors: 'payrollJuniors',
  interns: 'payrollInterns',
  contractors: 'payrollContractors',
  severance: 'payrollSeverance',
};

// Production cost keys for label lookup
const productionCostKeys: Record<string, string> = {
  projectProduction: 'prodCostProject',
  eventProduction: 'prodCostEvent',
  overseas: 'prodCostOverseas',
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
  const { t } = useTranslation();
  const currentData = annualFinancials.find(f => f.year === year) || annualFinancials[0];
  const compareData = annualFinancials.find(f => f.year !== year);

  const actual2025Key = t('plActual2025');
  const target2026Key = t('plTarget2026');

  // 비교 차트 데이터
  const comparisonChartData = [
    {
      name: t('plRevenueLabel'),
      [actual2025Key]: annualFinancials[0].revenue / 100000000,
      [target2026Key]: annualFinancials[1].revenue / 100000000,
    },
    ...(annualFinancials[0].investment > 0 ? [{
      name: t('plInvestmentLabel'),
      [actual2025Key]: annualFinancials[0].investment / 100000000,
      [target2026Key]: annualFinancials[1].investment / 100000000,
    }] : []),
    {
      name: t('overheadCost'),
      [actual2025Key]: annualFinancials[0].overhead.total / 100000000,
      [target2026Key]: annualFinancials[1].overhead.total / 100000000,
    },
    {
      name: t('laborCost'),
      [actual2025Key]: annualFinancials[0].productionPayroll.total / 100000000,
      [target2026Key]: annualFinancials[1].productionPayroll.total / 100000000,
    },
    {
      name: t('plProductionCostLabel'),
      [actual2025Key]: annualFinancials[0].productionCost.total / 100000000,
      [target2026Key]: annualFinancials[1].productionCost.total / 100000000,
    },
    {
      name: t('netProfit'),
      [actual2025Key]: annualFinancials[0].netProfit / 100000000,
      [target2026Key]: annualFinancials[1].netProfit / 100000000,
    },
  ];

  const totalExpense = currentData.overhead.total + currentData.productionPayroll.total + currentData.productionCost.total;
  const totalIncome = currentData.revenue + currentData.investment;
  const profitRate = ((currentData.netProfit / totalIncome) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Section Title */}
      <h3 className="text-lg font-semibold text-foreground">
        {currentData.year}{t('yearSuffix')} {currentData.isTarget ? t('target') : t('actual')} {t('plIncomeStatement')}
      </h3>

      {/* P&L Statement */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {currentData.year}{t('yearSuffix')} {currentData.isTarget ? t('target') : t('actual')} {t('plIncomeStatement')}
            </CardTitle>
            <Badge variant={currentData.isTarget ? 'outline' : 'default'}>
              {currentData.isTarget ? t('target') : t('plConfirmed')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* 매출액 */}
            <div className="flex items-center justify-between py-2 sm:py-3 border-b-2 border-primary/20 gap-2">
              <span className="font-semibold text-foreground text-sm sm:text-base shrink-0">{t('plRevenueSupply')}</span>
              <AutoFitText className="text-base sm:text-xl font-bold text-foreground font-mono tabular-nums">{formatKRW(currentData.revenue)}</AutoFitText>
            </div>

            {/* 투자금 */}
            {currentData.investment > 0 && (
              <div className="flex items-center justify-between py-2 sm:py-3 border-b border-emerald-200 gap-2">
                <span className="font-medium text-emerald-600 text-sm sm:text-base shrink-0">{t('plInvestmentAdd')}</span>
                <AutoFitText className="text-sm sm:text-lg font-semibold text-emerald-600 font-mono tabular-nums">{formatKRW(currentData.investment)}</AutoFitText>
              </div>
            )}

            {/* 경상비 Accordion */}
            <Accordion type="single" collapsible className="border-none">
              <AccordionItem value="overhead" className="border-b">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-2 sm:pr-4 gap-2">
                    <span className="text-red-600 font-medium text-sm sm:text-base shrink-0">{t('plOverheadSubtract')}</span>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {compareData && (
                        <ChangeIndicator
                          current={currentData.overhead.total}
                          previous={compareData.overhead.total}
                        />
                      )}
                      <AutoFitText className="font-semibold text-red-600 font-mono tabular-nums text-xs sm:text-sm">{formatKRW(currentData.overhead.total)}</AutoFitText>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-4">
                    {Object.entries(overheadKeys).map(([key, tKey]) => {
                      const value = currentData.overhead[key as keyof typeof currentData.overhead] as number;
                      return (
                        <div key={key} className="flex items-center justify-between py-1 text-xs sm:text-sm">
                          <span className="text-muted-foreground">{t(tKey as any)}</span>
                          <span className="font-mono tabular-nums">{formatKRW(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 인건비 */}
              <AccordionItem value="payroll" className="border-b">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-2 sm:pr-4 gap-2">
                    <span className="text-orange-600 font-medium text-sm sm:text-base shrink-0">{t('plPayrollSubtract')}</span>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {compareData && (
                        <ChangeIndicator
                          current={currentData.productionPayroll.total}
                          previous={compareData.productionPayroll.total}
                        />
                      )}
                      <AutoFitText className="font-semibold text-orange-600 font-mono tabular-nums text-xs sm:text-sm">{formatKRW(currentData.productionPayroll.total)}</AutoFitText>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-4">
                    {Object.entries(payrollKeys).map(([key, tKey]) => {
                      const value = currentData.productionPayroll[key as keyof typeof currentData.productionPayroll] as number;
                      return (
                        <div key={key} className="flex items-center justify-between py-1 text-xs sm:text-sm">
                          <span className="text-muted-foreground">{t(tKey as any)}</span>
                          <span className="font-mono tabular-nums">{formatKRW(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 촬영진행비 */}
              <AccordionItem value="production" className="border-b">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-2 sm:pr-4 gap-2">
                    <span className="text-amber-600 font-medium text-sm sm:text-base shrink-0">{t('plProductionCostSubtract')}</span>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {compareData && (
                        <ChangeIndicator
                          current={currentData.productionCost.total}
                          previous={compareData.productionCost.total}
                        />
                      )}
                      <AutoFitText className="font-semibold text-amber-600 font-mono tabular-nums text-xs sm:text-sm">{formatKRW(currentData.productionCost.total)}</AutoFitText>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-4">
                    {Object.entries(productionCostKeys).map(([key, tKey]) => {
                      const value = currentData.productionCost[key as keyof typeof currentData.productionCost] as number;
                      return (
                        <div key={key} className="flex items-center justify-between py-1 text-xs sm:text-sm">
                          <span className="text-muted-foreground">{t(tKey as any)}</span>
                          <span className="font-mono tabular-nums">{formatKRW(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* 총 비용 */}
            <div className="flex items-center justify-between py-2 border-t gap-2">
              <span className="text-muted-foreground text-sm shrink-0">{t('plTotalExpense')}</span>
              <AutoFitText className="font-semibold text-muted-foreground font-mono tabular-nums text-sm">{formatKRW(totalExpense)}</AutoFitText>
            </div>

            {/* 순이익 */}
            <div className="flex items-center justify-between py-2 sm:py-3 border-t-2 border-primary/20 bg-primary/5 rounded-lg px-2 sm:px-3 -mx-2 sm:-mx-3 gap-2">
              <div className="shrink-0">
                <span className="font-bold text-sm sm:text-lg text-foreground">{t('netProfit')}</span>
                <span className="ml-1 sm:ml-2 text-[10px] sm:text-sm text-muted-foreground">{t('plProfitRateLabel')} {profitRate}%</span>
              </div>
              <AutoFitText className={`text-base sm:text-xl font-bold font-mono tabular-nums ${currentData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatKRW(currentData.netProfit)}
              </AutoFitText>
            </div>

            {/* Ark.works 비용 */}
            {currentData.arkworksExpense > 0 && (
              <div className="flex items-center justify-between py-2 sm:py-3 border-t border-dashed border-blue-300 bg-blue-50/50 rounded-lg px-2 sm:px-3 -mx-2 sm:-mx-3 mt-2 gap-2">
                <div className="shrink-0">
                  <span className="font-medium text-sm text-blue-700">{t('plArkworksExpense')}</span>
                  <span className="ml-2 text-[10px] sm:text-xs text-blue-500">{t('plArkworksNote')}</span>
                </div>
                <AutoFitText className="text-sm sm:text-base font-semibold text-blue-700 font-mono tabular-nums">
                  {formatKRW(currentData.arkworksExpense)}
                </AutoFitText>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Year Comparison Chart */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">{t('plYearComparison')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
              <Bar dataKey={actual2025Key} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey={target2026Key} fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cost Structure Breakdown */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-[10px] sm:text-sm text-muted-foreground mb-1 truncate">{t('plOverheadRatio')}</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-foreground">
            {((currentData.overhead.total / currentData.revenue) * 100).toFixed(1)}%
          </AutoFitText>
          <AutoFitText className="text-[10px] sm:text-xs text-muted-foreground">{formatBillions(currentData.overhead.total)}</AutoFitText>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-[10px] sm:text-sm text-muted-foreground mb-1 truncate">{t('plPayrollRatio')}</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-foreground">
            {((currentData.productionPayroll.total / currentData.revenue) * 100).toFixed(1)}%
          </AutoFitText>
          <AutoFitText className="text-[10px] sm:text-xs text-muted-foreground">{formatBillions(currentData.productionPayroll.total)}</AutoFitText>
        </Card>
        <Card className="p-3 sm:p-4 shadow-card overflow-hidden">
          <p className="text-[10px] sm:text-sm text-muted-foreground mb-1 truncate">{t('plProductionCostRatio')}</p>
          <AutoFitText className="text-lg sm:text-2xl font-bold text-foreground">
            {((currentData.productionCost.total / currentData.revenue) * 100).toFixed(1)}%
          </AutoFitText>
          <AutoFitText className="text-[10px] sm:text-xs text-muted-foreground">{formatBillions(currentData.productionCost.total)}</AutoFitText>
        </Card>
      </div>
    </div>
  );
}
