/**
 * ActivityChartWidget — Line chart of weekly activity (Dashboard only).
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { WidgetDataContext } from '@/types/widget';

function ActivityChartWidget({ context: _context }: { context: WidgetDataContext }) {
  const { events, messages } = useAppStore();

  const data = useMemo(() => {
    const days: { label: string; events: number; messages: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      days.push({
        label,
        events: events.filter((e) => e.startAt.startsWith(dateStr)).length,
        messages: messages.filter((m) => m.createdAt?.startsWith(dateStr)).length,
      });
    }
    return days;
  }, [events, messages]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey="events" stroke="hsl(234 89% 60%)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="messages" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default ActivityChartWidget;
