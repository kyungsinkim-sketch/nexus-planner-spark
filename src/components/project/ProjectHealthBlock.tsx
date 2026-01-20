import { Project } from '@/types/core';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Clock, Users, DollarSign } from 'lucide-react';

interface ProjectHealthBlockProps {
  project: Project;
}

const healthConfig = {
  schedule: {
    ON_TRACK: { color: 'bg-emerald-500', label: 'On Track', description: 'Project is progressing as planned' },
    AT_RISK: { color: 'bg-amber-500', label: 'At Risk', description: 'Some delays may impact the deadline' },
    DELAYED: { color: 'bg-red-500', label: 'Delayed', description: 'Project is behind schedule' },
  },
  workload: {
    BALANCED: { color: 'bg-emerald-500', label: 'Balanced', description: 'Team workload is manageable' },
    OVERLOADED: { color: 'bg-red-500', label: 'Overloaded', description: 'Team is handling too many tasks' },
  },
  budget: {
    HEALTHY: { color: 'bg-emerald-500', label: 'Healthy', description: 'Budget is on track' },
    TIGHT: { color: 'bg-amber-500', label: 'Tight', description: 'Budget is nearing the limit' },
  },
};

export function ProjectHealthBlock({ project }: ProjectHealthBlockProps) {
  const health = project.health || { schedule: 'ON_TRACK', workload: 'BALANCED', budget: 'HEALTHY' };

  const items = [
    {
      icon: Clock,
      label: 'Schedule',
      ...healthConfig.schedule[health.schedule],
    },
    {
      icon: Users,
      label: 'Workload',
      ...healthConfig.workload[health.workload],
    },
    {
      icon: DollarSign,
      label: 'Budget',
      ...healthConfig.budget[health.budget],
    },
  ];

  return (
    <Card className="p-6 shadow-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">Project Health</h3>
      <div className="grid grid-cols-3 gap-4">
        <TooltipProvider>
          {items.map((item) => (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">{item.label === 'Schedule' ? healthConfig.schedule[health.schedule].label : item.label === 'Workload' ? healthConfig.workload[health.workload].label : healthConfig.budget[health.budget].label}</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{item.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </Card>
  );
}
