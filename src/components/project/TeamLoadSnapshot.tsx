import { useMemo } from 'react';
import { Project } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { calculateTeamLoad, WEIGHTS } from '@/utils/teamLoadCalculation';
import { CheckSquare, CalendarDays, LayoutList } from 'lucide-react';
import { startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';

interface TeamLoadSnapshotProps {
  project: Project;
}

export function TeamLoadSnapshot({ project }: TeamLoadSnapshotProps) {
  const { getUserById, events, personalTodos, boardTasks } = useAppStore();

  const teamMemberIds = project.teamMemberIds || [];

  const weekRange = useMemo(() => {
    const now = new Date();
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }, []);

  const isInWeek = (dateStr?: string) => {
    if (!dateStr) return false;
    try { return isWithinInterval(parseISO(dateStr), weekRange); } catch { return false; }
  };

  const loadData = useMemo(() => {
    if (teamMemberIds.length === 0) return [];
    const inputs = teamMemberIds.map(userId => {
      const todosAssigned = personalTodos.filter(
        t => t.projectId === project.id && t.assigneeIds?.includes(userId) &&
        (isInWeek(t.createdAt) || isInWeek(t.dueDate))
      ).length;

      const calendarEvents = events.filter(
        e => e.projectId === project.id &&
        (e.ownerId === userId || e.attendeeIds?.includes(userId)) &&
        isInWeek(e.startAt)
      ).length;

      const boardTaskCount = boardTasks.filter(bt =>
        bt.projectId === project.id &&
        bt.ownerId === userId &&
        bt.startDate && bt.endDate &&
        bt.status !== 'done' && (
          isInWeek(bt.startDate) || isInWeek(bt.endDate) ||
          (() => { try { const s = parseISO(bt.startDate!); const e = parseISO(bt.endDate!); return s <= weekRange.start && e >= weekRange.end; } catch { return false; } })()
        )
      ).length;

      return { userId, todosAssigned, calendarEvents, boardTasks: boardTaskCount };
    });

    return calculateTeamLoad(inputs);
  }, [teamMemberIds, project.id, events, personalTodos, boardTasks, weekRange]);

  const maxScore = Math.max(...loadData.map(d => d.loadScore), 1);

  if (teamMemberIds.length === 0) return null;

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-foreground">Team Load Snapshot</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" /> 할일 {WEIGHTS.todo * 100}%</span>
        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> 일정 {WEIGHTS.calendar * 100}%</span>
        <span className="flex items-center gap-1"><LayoutList className="w-3 h-3" /> 보드 {WEIGHTS.board * 100}%</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TooltipProvider>
          {loadData.map((member) => {
            const user = getUserById(member.userId);
            if (!user) return null;
            const normalizedScore = maxScore > 0 ? (member.loadScore / maxScore) * 100 : 0;
            const isOverloaded = normalizedScore > 85;

            return (
              <div key={member.userId} className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative mb-2">
                      <Avatar className="w-12 h-12 border-2 border-background">
                        <AvatarFallback className={`text-sm font-medium ${
                          isOverloaded
                            ? 'bg-destructive/20 text-destructive'
                            : 'bg-primary/20 text-primary'
                        }`}>
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background ${
                        isOverloaded ? 'bg-destructive' : 'bg-emerald-500'
                      }`} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1 text-xs">
                      <p className="font-medium">{user.name}</p>
                      <p>할일: {member.todosAssigned} | 일정: {member.calendarEvents} | 보드: {member.boardTasks}</p>
                      <p className="font-medium">Load: {member.loadScore.toFixed(1)}%</p>
                    </div>
                  </TooltipContent>
                </Tooltip>

                <p className="text-sm font-medium text-foreground mb-1 truncate w-full">
                  {user.name}
                </p>

                <div className="w-full">
                  <Progress
                    value={normalizedScore}
                    className={`h-2 ${isOverloaded ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {member.loadScore.toFixed(1)}%
                  </p>
                </div>
              </div>
            );
          })}
        </TooltipProvider>
      </div>
    </Card>
  );
}
