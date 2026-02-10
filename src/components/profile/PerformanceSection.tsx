import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Trophy, Target, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export function PerformanceSection() {
  const { currentUser, getPerformanceByUser } = useAppStore();
  const performanceData = currentUser ? getPerformanceByUser(currentUser.id) : [];
  
  // Get latest performance
  const latestPerformance = performanceData.sort(
    (a, b) => new Date(b.calculatedAt).getTime() - new Date(a.calculatedAt).getTime()
  )[0];

  // Prepare chart data
  const chartData = performanceData
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((p) => ({
      period: p.period,
      score: p.totalScore,
    }));

  // Calculate trend
  const prevScore = chartData.length > 1 ? chartData[chartData.length - 2]?.score : null;
  const currentScore = latestPerformance?.totalScore || 0;
  const trend = prevScore ? currentScore - prevScore : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Performance Snapshot</h2>
        <p className="text-sm text-muted-foreground">Your productivity metrics and trends</p>
      </div>

      {/* Score Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Total Score */}
        <Card className="p-6 shadow-card text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Total Score</span>
          </div>
          <p className="text-5xl font-bold text-foreground">{currentScore}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            {trend > 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-emerald-500">+{trend} from last month</span>
              </>
            ) : trend < 0 ? (
              <>
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="text-sm text-destructive">{trend} from last month</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No change</span>
            )}
          </div>
        </Card>

        {/* Rank */}
        <Card className="p-6 shadow-card text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="w-5 h-5 text-violet-500" />
            <span className="text-sm font-medium text-muted-foreground">Team Rank</span>
          </div>
          <p className="text-5xl font-bold text-foreground">#{latestPerformance?.rank || '-'}</p>
          <Badge variant="secondary" className="mt-2">
            Top Performer
          </Badge>
        </Card>

        {/* Breakdown */}
        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Star className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium text-muted-foreground">Score Breakdown</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Financial (70%)</span>
              <span className="font-semibold text-foreground">{latestPerformance?.financialScore || 0}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${((latestPerformance?.financialScore || 0) / 70) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Peer Review (30%)</span>
              <span className="font-semibold text-foreground">{latestPerformance?.peerScore || 0}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-violet-500 h-2 rounded-full transition-all"
                style={{ width: `${((latestPerformance?.peerScore || 0) / 30) * 100}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card className="p-6 shadow-card">
        <h3 className="font-medium text-foreground mb-4">3-Month Trend</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}