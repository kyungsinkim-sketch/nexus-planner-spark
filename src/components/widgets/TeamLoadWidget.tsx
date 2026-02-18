/**
 * TeamLoadWidget — Shows team member workload for a project.
 * Uses actual calculation from teamLoadCalculation.ts instead of random values.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { User } from 'lucide-react';
import { calculateTeamLoad } from '@/utils/teamLoadCalculation';
import type { WidgetDataContext } from '@/types/widget';

function TeamLoadWidget({ context }: { context: WidgetDataContext }) {
  const { getProjectById, getUserById, messages, files, personalTodos, events } = useAppStore();
  const project = context.projectId ? getProjectById(context.projectId) : null;

  const loadData = useMemo(() => {
    if (!project?.teamMemberIds?.length) return [];

    const inputs = project.teamMemberIds.map(userId => {
      const chatMessages = messages.filter(
        m => m.projectId === project.id && m.userId === userId && !m.directChatUserId
      ).length;
      const fileUploads = files.filter(f => f.uploadedBy === userId).length;
      const todosCompleted = personalTodos.filter(
        t => t.projectId === project.id && t.assigneeIds?.includes(userId)
      ).length;
      const calendarEvents = events.filter(
        e => e.projectId === project.id && e.ownerId === userId
      ).length;

      return { userId, chatMessages, fileUploads, todosCompleted, calendarEvents };
    });

    return calculateTeamLoad(inputs);
  }, [project, messages, files, personalTodos, events]);

  if (!project?.teamMemberIds?.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        No team members
      </div>
    );
  }

  // Normalize scores: find max and scale to 100%
  const maxScore = Math.max(...loadData.map(d => d.loadScore), 1);

  return (
    <div className="space-y-2">
      {loadData.slice(0, 6).map((member) => {
        const user = getUserById(member.userId);
        const normalizedPercent = (member.loadScore / maxScore) * 100;
        const isOverloaded = normalizedPercent > 85;

        return (
          <div key={member.userId} className="flex items-center gap-2 p-1.5">
            <User className={`w-4 h-4 shrink-0 ${isOverloaded ? 'text-red-500' : 'text-muted-foreground'}`} />
            <span className="text-sm truncate w-16">{user?.name || member.userId}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full ml-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isOverloaded ? 'bg-red-500' : 'bg-primary/70'}`}
                style={{ width: `${Math.max(normalizedPercent, 5)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-10 text-right">{member.loadScore.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default TeamLoadWidget;
