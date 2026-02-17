/**
 * HealthWidget — Shows project health (schedule, workload, budget).
 * Dark gradient card, no title bar.
 */

import { useAppStore } from '@/stores/appStore';
import { Activity, Clock, Users, DollarSign } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

const statusConfig: Record<string, { label: string; color: string }> = {
  ON_TRACK: { label: 'On Track', color: 'text-emerald-400' },
  BALANCED: { label: 'Balanced', color: 'text-emerald-400' },
  HEALTHY: { label: 'Healthy', color: 'text-emerald-400' },
  AT_RISK: { label: 'At Risk', color: 'text-amber-400' },
  TIGHT: { label: 'Tight', color: 'text-amber-400' },
  OVERLOADED: { label: 'Overloaded', color: 'text-red-400' },
  DELAYED: { label: 'Delayed', color: 'text-red-400' },
};

function HealthWidget({ context }: { context: WidgetDataContext }) {
  const { getProjectById } = useAppStore();
  const project = context.projectId ? getProjectById(context.projectId) : null;

  if (!project?.health) {
    return (
      <div className="flex items-center justify-center h-full widget-dark-card health-gradient-bg text-white/40 text-sm">
        <Activity className="w-5 h-5 mr-2" /> No health data
      </div>
    );
  }

  const { schedule, workload, budget } = project.health;

  const items = [
    { label: 'Schedule', value: schedule, icon: Clock },
    { label: 'Workload', value: workload, icon: Users },
    { label: 'Budget', value: budget, icon: DollarSign },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 h-full items-center px-4 widget-dark-card health-gradient-bg">
      {items.map((item) => {
        const Icon = item.icon;
        const cfg = statusConfig[item.value] || { label: item.value, color: 'text-white/60' };
        return (
          <div key={item.label} className="text-center">
            <Icon className={`w-6 h-6 mx-auto mb-1.5 ${cfg.color}`} />
            <p className={`text-xs font-semibold ${cfg.color}`}>
              {cfg.label}
            </p>
            <p className="text-[10px] text-white/50 mt-0.5">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export default HealthWidget;
