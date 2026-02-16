/**
 * HealthWidget — Shows project health (schedule, workload, budget).
 */

import { useAppStore } from '@/stores/appStore';
import { Activity, Clock, Users, DollarSign } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

const statusColors: Record<string, string> = {
  ON_TRACK: 'text-green-500',
  BALANCED: 'text-green-500',
  HEALTHY: 'text-green-500',
  AT_RISK: 'text-yellow-500',
  TIGHT: 'text-yellow-500',
  OVERLOADED: 'text-red-500',
  DELAYED: 'text-red-500',
};

function HealthWidget({ context }: { context: WidgetDataContext }) {
  const { getProjectById } = useAppStore();
  const project = context.projectId ? getProjectById(context.projectId) : null;

  if (!project?.health) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
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
    <div className="grid grid-cols-3 gap-3 h-full items-center px-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="text-center">
            <Icon className={`w-5 h-5 mx-auto mb-1 ${statusColors[item.value] || 'text-muted-foreground'}`} />
            <p className={`text-xs font-semibold ${statusColors[item.value] || 'text-muted-foreground'}`}>
              {item.value.replace('_', ' ')}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export default HealthWidget;
