/**
 * TeamLoadWidget — 전체 대시보드용 팀 부하 위젯
 * 모든 active 프로젝트를 통합적으로 계산
 * 가중 비율: 채팅(25%) + 파일(20%) + Todo(40%) + 캘린더(15%)
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { User } from 'lucide-react';
import { calculateTeamLoad } from '@/utils/teamLoadCalculation';
import { useTranslation } from '@/hooks/useTranslation';
import type { WidgetDataContext } from '@/types/widget';

function TeamLoadWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const { projects, getUserById, users, messages, files, personalTodos, events } = useAppStore();

  // Get all active projects (IN_PROGRESS status)
  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'IN_PROGRESS'),
    [projects]
  );

  const loadData = useMemo(() => {
    // Collect all unique team members across active projects
    const memberProjectMap = new Map<string, string[]>();
    activeProjects.forEach(project => {
      (project.teamMemberIds || []).forEach(userId => {
        const existing = memberProjectMap.get(userId) || [];
        existing.push(project.id);
        memberProjectMap.set(userId, existing);
      });
    });

    if (memberProjectMap.size === 0) return [];

    const inputs = Array.from(memberProjectMap.entries()).map(([userId, projectIds]) => {
      const chatMessages = messages.filter(
        m => projectIds.includes(m.projectId || '') && m.userId === userId && !m.directChatUserId
      ).length;
      const fileUploads = files.filter(
        f => f.uploadedBy === userId
      ).length;
      const todosCompleted = personalTodos.filter(
        t => projectIds.includes(t.projectId || '') && t.assigneeIds?.includes(userId)
      ).length;
      const calendarEvents = events.filter(
        e => projectIds.includes(e.projectId || '') && e.ownerId === userId
      ).length;

      return { userId, chatMessages, fileUploads, todosCompleted, calendarEvents };
    });

    return calculateTeamLoad(inputs);
  }, [activeProjects, messages, files, personalTodos, events]);

  if (loadData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        {t('noActiveProjects') || 'No active projects'}
      </div>
    );
  }

  // Sort by loadScore descending
  const sorted = [...loadData].sort((a, b) => b.loadScore - a.loadScore);
  const maxScore = Math.max(...sorted.map(d => d.loadScore), 1);

  return (
    <div className="space-y-1.5 overflow-y-auto">
      {sorted.map((member) => {
        const user = getUserById(member.userId);
        const normalizedPercent = (member.loadScore / maxScore) * 100;
        const isOverloaded = normalizedPercent > 85;

        return (
          <div key={member.userId} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition-colors">
            <User className={`w-4 h-4 shrink-0 ${isOverloaded ? 'text-red-500' : 'text-muted-foreground'}`} />
            <span className={`text-sm truncate w-16 ${isOverloaded ? 'text-red-500 font-medium' : ''}`}>
              {user?.name || member.userId}
            </span>
            <div className="flex-1 h-1.5 bg-muted rounded-full ml-1 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverloaded ? 'bg-red-500' : normalizedPercent > 60 ? 'bg-amber-500' : 'bg-primary/70'
                }`}
                style={{ width: `${Math.max(normalizedPercent, 5)}%` }}
              />
            </div>
            <span className={`text-[10px] w-10 text-right ${isOverloaded ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              {member.loadScore.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default TeamLoadWidget;
