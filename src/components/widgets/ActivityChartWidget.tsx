/**
 * ActivityChartWidget — Area chart of weekly activity (Dashboard only).
 * Dark card design with gradient accent lines. No title bar.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';
import type { WidgetDataContext } from '@/types/widget';

function ActivityChartWidget({ context }: { context: WidgetDataContext }) {
  const { events, projects, currentUser, messages } = useAppStore();
  const { t } = useTranslation();

  // Build set of project IDs the current user is a member of
  const myProjectIds = useMemo(() => {
    if (!currentUser) return new Set<string>();
    return new Set(
      projects
        .filter(p => p.teamMemberIds?.includes(currentUser.id))
        .map(p => p.id),
    );
  }, [projects, currentUser]);

  // Filter events to only those relevant to current user (same as CalendarWidget)
  const userEvents = useMemo(() => {
    if (context.type === 'project' && context.projectId) {
      return events.filter(e => e.projectId === context.projectId);
    }
    const userId = currentUser?.id;
    if (userId) {
      return events.filter(e => {
        const isOwner = e.ownerId === userId;
        const isAttendee = e.attendeeIds?.includes(userId);
        const isTeamProject = e.projectId ? myProjectIds.has(e.projectId) : false;
        return isOwner || isAttendee || isTeamProject;
      });
    }
    return events;
  }, [events, context, currentUser, myProjectIds]);

  const data = useMemo(() => {
    const days: { label: string; events: number; messages: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
      days.push({
        label,
        events: userEvents.filter((e) => e.startAt.startsWith(dateStr)).length,
        messages: messages.filter((m) => m.createdAt?.startsWith(dateStr)).length,
      });
    }
    return days;
  }, [userEvents, messages]);

  return (
    <div className="h-full widget-dark-card p-3 flex flex-col">
      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
            <defs>
              <linearGradient id="gradEvents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
              }}
            />
            <Area type="monotone" dataKey="events" stroke="#818cf8" strokeWidth={2} fill="url(#gradEvents)" dot={false} />
            <Area type="monotone" dataKey="messages" stroke="#34d399" strokeWidth={2} fill="url(#gradMessages)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default ActivityChartWidget;
