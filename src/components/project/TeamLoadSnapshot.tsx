import { useMemo } from 'react';
import { Project, User } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { calculateTeamLoad, WEIGHTS } from '@/utils/teamLoadCalculation';
import { MessageSquare, FileUp, CheckSquare, CalendarDays } from 'lucide-react';

interface TeamLoadSnapshotProps {
  project: Project;
}

export function TeamLoadSnapshot({ project }: TeamLoadSnapshotProps) {
  const { getUserById, messages, files, events, personalTodos } = useAppStore();

  const teamMemberIds = project.teamMemberIds || [];
  if (teamMemberIds.length === 0) return null;

  // Calculate real data per user for THIS project only
  const loadData = useMemo(() => {
    const inputs = teamMemberIds.map(userId => {
      // Chat messages in this project
      const chatMessages = messages.filter(
        m => m.projectId === project.id && m.userId === userId
      ).length;
      // Files uploaded by user (project-scoped if fileGroupId matches)
      const fileUploads = files.filter(
        f => f.uploadedBy === userId
      ).length;
      // Todos assigned to user IN this project (both pending and completed count as load)
      const todosAssigned = personalTodos.filter(
        t => t.projectId === project.id && t.assigneeIds?.includes(userId)
      ).length;
      // Calendar events owned by user IN this project
      const calendarEventsCount = events.filter(
        e => e.projectId === project.id && e.ownerId === userId
      ).length;

      return { userId, chatMessages, fileUploads, todosCompleted: todosAssigned, calendarEvents: calendarEventsCount };
    });

    return calculateTeamLoad(inputs);
  }, [teamMemberIds, project.id, messages, files, events, personalTodos]);

  const maxScore = Math.max(...loadData.map(d => d.loadScore), 1);

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-foreground">Team Load Snapshot</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> 채팅 {WEIGHTS.chat * 100}%</span>
        <span className="flex items-center gap-1"><FileUp className="w-3 h-3" /> 파일 {WEIGHTS.file * 100}%</span>
        <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3" /> 할일 {WEIGHTS.todo * 100}%</span>
        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> 일정 {WEIGHTS.calendar * 100}%</span>
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
                      <p>Chat: {member.chatMessages} | File: {member.fileUploads}</p>
                      <p>Todo: {member.todosCompleted} | Calendar: {member.calendarEvents}</p>
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
