/**
 * ProgressChartWidget — Bar chart of project progress (Dashboard only).
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
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        No active projects
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
        <Tooltip />
        <Bar dataKey="progress" fill="hsl(234 89% 60%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default ProgressChartWidget;
