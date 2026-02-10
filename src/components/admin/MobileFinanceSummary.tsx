/**
 * MobileFinanceSummary
 * 모바일용 간소화된 Finance 요약 뷰
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    TrendingUp,
    TrendingDown,
    PiggyBank,
    ChevronRight,
    Building2,
    Users,
    Film,
    ArrowUpRight,
    ArrowDownRight,
} from 'lucide-react';
import { annualFinancials } from '@/mock/data';
import { useTranslation } from '@/hooks/useTranslation';

// 억 단위 포맷
const formatBillions = (v: number) => `${(v / 100000000).toFixed(1)}억`;

interface MobileFinanceSummaryProps {
    onViewDetails?: () => void;
}

export function MobileFinanceSummary({ onViewDetails }: MobileFinanceSummaryProps) {
    const { t, language } = useTranslation();
    const [selectedYear, setSelectedYear] = useState(annualFinancials[0].year);

    const currentData = annualFinancials.find(f => f.year === selectedYear) || annualFinancials[0];
    const prevData = annualFinancials.find(f => f.year === selectedYear - 1);

    const totalExpense = currentData.overhead.total + currentData.productionPayroll.total + currentData.productionCost.total;
    const netProfit = currentData.netProfit;
    const totalIncome = currentData.revenue + currentData.investment;
    const profitRate = ((netProfit / totalIncome) * 100).toFixed(1);

    // YoY comparison
    const prevRevenue = prevData?.revenue || 0;
    const revenueChange = prevRevenue > 0 ? ((currentData.revenue - prevRevenue) / prevRevenue * 100).toFixed(1) : null;

    const expenseCategories = [
        {
            label: '경상비',
            value: currentData.overhead.total,
            icon: Building2,
            color: 'text-red-500',
            bgColor: 'bg-red-50',
        },
        {
            label: '인건비',
            value: currentData.productionPayroll.total,
            icon: Users,
            color: 'text-orange-500',
            bgColor: 'bg-orange-50',
        },
        {
            label: '촬영진행비',
            value: currentData.productionCost.total,
            icon: Film,
            color: 'text-amber-500',
            bgColor: 'bg-amber-50',
        },
    ];

    return (
        <div className="space-y-4">
            {/* Year Toggle */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {annualFinancials.map((f) => (
                    <Button
                        key={f.year}
                        variant={selectedYear === f.year ? 'default' : 'outline'}
                        size="sm"
                        className="shrink-0"
                        onClick={() => setSelectedYear(f.year)}
                    >
                        {f.year}년
                        <Badge
                            variant={f.isTarget ? 'outline' : 'secondary'}
                            className="ml-1.5 text-[10px] px-1.5 py-0"
                        >
                            {f.isTarget ? '목표' : '실적'}
                        </Badge>
                    </Button>
                ))}
            </div>

            {/* Main Summary Card */}
            <Card className="overflow-hidden">
                <CardHeader className="pb-2 bg-gradient-to-r from-emerald-500/10 to-emerald-600/5">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {selectedYear}년 {currentData.isTarget ? '목표' : '실적'}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    {/* Revenue */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">연 매출</p>
                                <p className="text-2xl font-bold text-foreground">{formatBillions(currentData.revenue)}</p>
                            </div>
                        </div>
                        {revenueChange && (
                            <div className={`flex items-center gap-1 text-sm ${parseFloat(revenueChange) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {parseFloat(revenueChange) >= 0 ? (
                                    <ArrowUpRight className="w-4 h-4" />
                                ) : (
                                    <ArrowDownRight className="w-4 h-4" />
                                )}
                                <span className="font-medium">{revenueChange}%</span>
                            </div>
                        )}
                    </div>

                    {/* Profit */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <PiggyBank className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">순이익</p>
                                <p className="text-2xl font-bold text-foreground">{formatBillions(netProfit)}</p>
                            </div>
                        </div>
                        <Badge variant="secondary" className="text-sm">
                            수익률 {profitRate}%
                        </Badge>
                    </div>

                    {/* Expense Breakdown */}
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">지출 내역</p>

                        {/* Expense Bar */}
                        <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                            {expenseCategories.map((cat, idx) => {
                                const percentage = (cat.value / totalExpense) * 100;
                                const colors = ['bg-red-400', 'bg-orange-400', 'bg-amber-400'];
                                return (
                                    <div
                                        key={idx}
                                        className={`${colors[idx]} first:rounded-l-full last:rounded-r-full`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                );
                            })}
                        </div>

                        {/* Expense Items */}
                        <div className="grid grid-cols-3 gap-2">
                            {expenseCategories.map((cat) => (
                                <div key={cat.label} className={`p-2 rounded-lg ${cat.bgColor}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                                        <span className="text-[10px] text-muted-foreground truncate">{cat.label}</span>
                                    </div>
                                    <p className="text-sm font-bold text-foreground">{formatBillions(cat.value)}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {((cat.value / totalExpense) * 100).toFixed(0)}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* View Details Button */}
            {onViewDetails && (
                <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={onViewDetails}
                >
                    상세 재무 정보 보기
                    <ChevronRight className="w-4 h-4" />
                </Button>
            )}
        </div>
    );
}

export default MobileFinanceSummary;
