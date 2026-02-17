/**
 * ProgressChartWidget — Bar chart of project progress (Dashboard only).
 * Dark gradient card, no title bar.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { WidgetDataContext } from '@/types/widget';

function ProgressChartWidget({ context: _context }: { context: WidgetDataContext }) {
  const { projects } = useAppStore();

  const data = useMemo(
    () =>
      projects
        .filter((p) => p.status === 'ACTIVE')
        .slice(0, 8)
        .map((p) => ({
          name: p.title.length > 12 ? p.title.slice(0, 12) + '...' : p.title,
          progress: p.progress || 0,
        })),
    [projects],
  );

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full widget-dark-card text-white/40 text-sm">
        No active projects
      </div>
    );
  }

  return (
    <div className="h-full widget-dark-card progress-gradient-bg p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 4 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value}%`, 'Progress']}
          />
          <Bar dataKey="progress" fill="hsl(234 89% 65%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ProgressChartWidget;
