import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { 
  Award,
  Rocket,
  Users,
  PiggyBank,
  Info,
} from 'lucide-react';
import { formatKRW } from '@/lib/format';
import { annualFinancials } from '@/mock/data';

const DISTRIBUTION_COLORS = [
  'hsl(142, 76%, 36%)',  // 성과상여금 - green
  'hsl(217, 91%, 60%)',  // 신규사업 투자 - blue
  'hsl(280, 68%, 60%)',  // 주주배당 - purple
  'hsl(45, 93%, 47%)',   // 사내유보 - amber
];

const DISTRIBUTION_ICONS = [Award, Rocket, Users, PiggyBank];

interface DistributionRatio {
  label: string;
  description: string;
  ratio: number;
  icon: typeof Award;
  color: string;
}

export function ProfitDistributionSection() {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [ratios, setRatios] = useState([20, 30, 20, 30]);

  const currentData = annualFinancials.find(f => f.year === parseInt(selectedYear)) || annualFinancials[1];
  const netProfit = currentData.netProfit;

  const distributions: DistributionRatio[] = [
    { label: '성과상여금', description: '구성원 성과에 따른 배분 (수식 추후 적용)', ratio: ratios[0], icon: Award, color: DISTRIBUTION_COLORS[0] },
    { label: '신규사업 투자', description: '솔루션 제작, 광고제 출품/참석 등', ratio: ratios[1], icon: Rocket, color: DISTRIBUTION_COLORS[1] },
    { label: '주주배당', description: '주주 배당금', ratio: ratios[2], icon: Users, color: DISTRIBUTION_COLORS[2] },
    { label: '사내유보', description: '차기 이월금', ratio: ratios[3], icon: PiggyBank, color: DISTRIBUTION_COLORS[3] },
  ];

  const chartData = distributions.map(d => ({
    name: d.label,
    value: Math.round(netProfit * d.ratio / 100),
    ratio: d.ratio,
  }));

  const handleRatioChange = (index: number, value: number[]) => {
    const newVal = value[0];
    const diff = newVal - ratios[index];
    const newRatios = [...ratios];
    newRatios[index] = newVal;

    // Adjust the last item (사내유보) to maintain 100% total
    const otherSum = newRatios.slice(0, 3).reduce((s, v) => s + v, 0);
    newRatios[3] = Math.max(0, 100 - otherSum);

    if (newRatios[3] >= 0 && otherSum <= 100) {
      setRatios(newRatios);
    }
  };

  const fy2025 = annualFinancials[0];
  const fy2026 = annualFinancials[1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">순이익 배분 시뮬레이션</h3>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2025">2025년 실적</SelectItem>
            <SelectItem value="2026">2026년 목표</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Net Profit Banner */}
      <Card className="p-6 shadow-card bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{currentData.year}년 {currentData.isTarget ? '목표' : '실적'} 순이익</p>
            <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatKRW(netProfit)}
            </p>
          </div>
          <Badge variant={currentData.isTarget ? 'outline' : 'default'} className="text-base px-4 py-1">
            {currentData.isTarget ? '목표' : '확정'}
          </Badge>
        </div>
      </Card>

      {/* Distribution Cards + Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Distribution Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {distributions.map((dist, idx) => {
            const amount = Math.round(netProfit * dist.ratio / 100);
            const Icon = dist.icon;
            return (
              <Card key={idx} className="p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${dist.color}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: dist.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{dist.label}</p>
                      <Badge variant="outline" className="text-xs">{dist.ratio}%</Badge>
                    </div>
                    <p className="text-lg font-bold text-foreground mt-1">{formatKRW(amount)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{dist.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Donut Chart */}
        <Card className="shadow-card">
          <CardHeader className="pb-0">
            <CardTitle className="text-base">배분 비율</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((_, idx) => (
                    <Cell key={idx} fill={DISTRIBUTION_COLORS[idx]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatKRW(value), '']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ratio Adjustment Sliders */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">배분 비율 조정 (What-if 분석)</CardTitle>
            <Info className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {distributions.slice(0, 3).map((dist, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{dist.label}</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{ratios[idx]}%</Badge>
                  <span className="text-sm font-mono text-muted-foreground">
                    {formatKRW(Math.round(netProfit * ratios[idx] / 100))}
                  </span>
                </div>
              </div>
              <Slider
                value={[ratios[idx]]}
                onValueChange={(v) => handleRatioChange(idx, v)}
                min={0}
                max={60}
                step={5}
                className="w-full"
              />
            </div>
          ))}
          {/* 사내유보 (auto-calculated) */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">사내유보 (자동 계산)</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{ratios[3]}%</Badge>
                <span className="text-sm font-mono text-muted-foreground">
                  {formatKRW(Math.round(netProfit * ratios[3] / 100))}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Year Comparison */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">연도별 배분 비교</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground mb-2">2025 실적 기준</p>
              <p className="text-xl font-bold text-foreground mb-3">순이익 {formatKRW(fy2025.netProfit)}</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>성과상여금 ({ratios[0]}%)</span>
                  <span className="font-mono">{formatKRW(Math.round(fy2025.netProfit * ratios[0] / 100))}</span>
                </div>
                <div className="flex justify-between">
                  <span>신규사업 투자 ({ratios[1]}%)</span>
                  <span className="font-mono">{formatKRW(Math.round(fy2025.netProfit * ratios[1] / 100))}</span>
                </div>
                <div className="flex justify-between">
                  <span>주주배당 ({ratios[2]}%)</span>
                  <span className="font-mono">{formatKRW(Math.round(fy2025.netProfit * ratios[2] / 100))}</span>
                </div>
                <div className="flex justify-between">
                  <span>사내유보 ({ratios[3]}%)</span>
                  <span className="font-mono">{formatKRW(Math.round(fy2025.netProfit * ratios[3] / 100))}</span>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium text-muted-foreground mb-2">2026 목표 기준</p>
              <p className="text-xl font-bold text-foreground mb-3">순이익 {formatKRW(fy2026.netProfit)}</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>성과상여금 ({ratios[0]}%)</span>
                  <span className="font-mono">{formatKRW(Math.round(fy2026.netProfit * ratios[0] / 100))}</span>
                </div>
                <div className="flex justify-between">
                  <span>신규사업 투자 ({ratios[1]}%)</span>
                  <span className="font-mono">{formatKRW(Math.round(fy2026.netProfit * ratios[1] / 100))}</span>
                </div>
                <div className="flex justify-between">
                  <span>주주배당 ({ratios[2]}%)</span>
                  <span className="font-mono">{formatKRW(Math.round(fy2026.netProfit * ratios[2] / 100))}</span>
                </div>
                <div className="flex justify-between">
                  <span>사내유보 ({ratios[3]}%)</span>
                  <span className="font-mono">{formatKRW(Math.round(fy2026.netProfit * ratios[3] / 100))}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
