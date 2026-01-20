import { Project } from '@/types/core';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Flag, Calendar } from 'lucide-react';

interface ProgressSectionProps {
  project: Project;
}

export function ProgressSection({ project }: ProgressSectionProps) {
  // Calculate timeline progress
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const today = new Date();
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const timeProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  // Task completion
  const tasksCompleted = project.tasksCompleted || 0;
  const tasksTotal = project.tasksTotal || 0;
  const taskProgress = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;

  // Milestone completion
  const milestones = project.milestones || [];
  const completedMilestones = milestones.filter(m => m.completed).length;
  const milestoneProgress = milestones.length > 0 ? (completedMilestones / milestones.length) * 100 : 0;

  const progressItems = [
    {
      icon: CheckCircle2,
      label: 'Task Completion',
      value: tasksTotal > 0 ? `${tasksCompleted} / ${tasksTotal}` : 'No tasks',
      progress: taskProgress,
      color: 'bg-primary',
    },
    {
      icon: Flag,
      label: 'Milestone Completion',
      value: milestones.length > 0 ? `${completedMilestones} / ${milestones.length}` : 'No milestones',
      progress: milestoneProgress,
      color: 'bg-violet-500',
    },
    {
      icon: Calendar,
      label: 'Timeline Progress',
      value: `${Math.round(timeProgress)}%`,
      progress: timeProgress,
      color: 'bg-emerald-500',
    },
  ];

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Project Progress</h3>
          <p className="text-sm text-muted-foreground mt-1">Track completion status</p>
        </div>
        <span className="text-3xl font-bold text-primary">{project.progress || 0}%</span>
      </div>

      <div className="space-y-5">
        {progressItems.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{item.label}</span>
              </div>
              <span className="font-medium text-foreground">{item.value}</span>
            </div>
            <Progress 
              value={item.progress} 
              className={`h-2 [&>div]:${item.color}`}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
