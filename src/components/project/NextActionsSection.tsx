import { Project, CalendarEvent, FileGroup, FileCategory } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, FolderOpen } from 'lucide-react';

interface NextActionsSectionProps {
  project: Project;
  onNavigateToTab: (tab: string) => void;
}

const requiredFileCategories: FileCategory[] = ['DECK', 'FINAL'];

export function NextActionsSection({ project, onNavigateToTab }: NextActionsSectionProps) {
  const { getEventsByProject, getFileGroupsByProject, getFilesByGroup } = useAppStore();
  
  const projectEvents = getEventsByProject(project.id);
  const fileGroups = getFileGroupsByProject(project.id);
  
  // Calculate overdue tasks (events that are past due and are tasks)
  const now = new Date();
  const overdueTasks = projectEvents.filter((event) => {
    const endDate = new Date(event.endAt);
    return endDate < now && (event.type === 'TASK' || event.type === 'DEADLINE');
  });

  // Calculate upcoming deadlines (within 7 days)
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const upcomingDeadlines = projectEvents.filter((event) => {
    const eventDate = new Date(event.startAt);
    return eventDate >= now && eventDate <= sevenDaysFromNow && 
           (event.type === 'DEADLINE' || event.type === 'DELIVERY');
  });

  // Calculate missing key files
  const existingCategories = fileGroups.map((g) => g.category);
  const missingCategories = requiredFileCategories.filter((cat) => {
    const categoryGroups = fileGroups.filter((g) => g.category === cat);
    const hasFiles = categoryGroups.some((g) => getFilesByGroup(g.id).length > 0);
    return !hasFiles;
  });

  const hasActions = overdueTasks.length > 0 || upcomingDeadlines.length > 0 || missingCategories.length > 0;

  if (!hasActions) return null;

  return (
    <Card className="p-6 shadow-card">
      <h3 className="text-lg font-semibold text-foreground mb-4">Next Actions</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <button
            onClick={() => onNavigateToTab('calendar')}
            className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/15 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Overdue Tasks</p>
              <p className="text-xs text-muted-foreground">
                {overdueTasks.length} task{overdueTasks.length !== 1 ? 's' : ''} past due
              </p>
            </div>
            <Badge variant="destructive" className="shrink-0">
              {overdueTasks.length}
            </Badge>
          </button>
        )}

        {/* Upcoming Deadlines */}
        {upcomingDeadlines.length > 0 && (
          <button
            onClick={() => onNavigateToTab('calendar')}
            className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Upcoming Deadlines</p>
              <p className="text-xs text-muted-foreground">
                Within next 7 days
              </p>
            </div>
            <Badge className="shrink-0 bg-amber-500/20 text-amber-700 border-amber-500/30">
              {upcomingDeadlines.length}
            </Badge>
          </button>
        )}

        {/* Missing Key Files */}
        {missingCategories.length > 0 && (
          <button
            onClick={() => onNavigateToTab('files')}
            className="flex items-center gap-3 p-4 rounded-lg bg-muted border border-border hover:bg-muted/80 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Missing Key Files</p>
              <p className="text-xs text-muted-foreground">
                {missingCategories.join(', ')}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {missingCategories.length}
            </Badge>
          </button>
        )}
      </div>
    </Card>
  );
}
