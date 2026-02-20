/**
 * TeamLoadWidget — 전체 대시보드용 팀 부하 위젯
 * 모든 active 프로젝트를 통합적으로 계산
 * 가중 비율: 채팅(25%) + 파일(20%) + Todo(40%) + 캘린더(15%)
 * 횡 바 그래프로 표시
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { calculateTeamLoad, WEIGHTS } from '@/utils/teamLoadCalculation';
import { useTranslation } from '@/hooks/useTranslation';
import type { WidgetDataContext } from '@/types/widget';

const CATEGORY_COLORS = {
  chat:     { bg: 'bg-blue-500',   light: 'bg-blue-500/20' },
  file:     { bg: 'bg-emerald-500', light: 'bg-emerald-500/20' },
  todo:     { bg: 'bg-amber-500',  light: 'bg-amber-500/20' },
  calendar: { bg: 'bg-purple-500', light: 'bg-purple-500/20' },
};

function TeamLoadWidget({ context }: { context: WidgetDataContext }) {
  const { t, language } = useTranslation();
  const { projects, getUserById, users, messages, files, personalTodos, events } = useAppStore();

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'IN_PROGRESS'),
    [projects]
  );

  const loadData = useMemo(() => {
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
        td => projectIds.includes(td.projectId || '') && td.assigneeIds?.includes(userId)
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

  const sorted = [...loadData].sort((a, b) => b.loadScore - a.loadScore);
  const maxScore = Math.max(...sorted.map(d => d.loadScore), 1);

  // Category labels
  const catLabels = language === 'ko'
    ? { chat: '채팅', file: '파일', todo: '할일', calendar: '일정' }
    : { chat: 'Chat', file: 'Files', todo: 'Todo', calendar: 'Calendar' };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Legend */}
      <div className="flex items-center gap-3 px-2 pb-1.5 flex-wrap">
        {(Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).map(key => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-sm ${CATEGORY_COLORS[key].bg}`} />
            <span className="text-[9px] text-muted-foreground">
              {catLabels[key]} {Math.round(WEIGHTS[key] * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* Bars */}
      <div className="flex-1 overflow-y-auto space-y-2 px-1">
        {sorted.map((member) => {
          const user = getUserById(member.userId);
          const normalizedPercent = (member.loadScore / maxScore) * 100;
          const isOverloaded = normalizedPercent > 85;

          // Per-category ratios for stacked bar
          const total = member.chatMessages + member.fileUploads + member.todosCompleted + member.calendarEvents;
          const segments = total > 0 ? {
            chat:     (member.chatMessages / total) * 100,
            file:     (member.fileUploads / total) * 100,
            todo:     (member.todosCompleted / total) * 100,
            calendar: (member.calendarEvents / total) * 100,
          } : { chat: 25, file: 25, todo: 25, calendar: 25 };

          return (
            <div key={member.userId} className="space-y-0.5">
              {/* Name + score row */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0 ${
                      isOverloaded ? 'bg-red-500' : 'bg-muted-foreground/40'
                    }`}>
                      {(user?.name || '?').charAt(0)}
                    </div>
                  )}
                  <span className={`text-xs truncate ${isOverloaded ? 'text-red-500 font-semibold' : ''}`}>
                    {user?.name || member.userId}
                  </span>
                </div>
                <span className={`text-[10px] tabular-nums ${isOverloaded ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                  {member.loadScore.toFixed(1)}%
                </span>
              </div>

              {/* Stacked horizontal bar */}
              <div className="h-3 bg-muted/40 rounded-full overflow-hidden flex mx-1"
                   style={{ width: `${Math.max(normalizedPercent, 8)}%` }}>
                {(Object.keys(segments) as Array<keyof typeof segments>).map(key => (
                  segments[key] > 0 ? (
                    <div
                      key={key}
                      className={`h-full ${CATEGORY_COLORS[key].bg} opacity-80 first:rounded-l-full last:rounded-r-full`}
                      style={{ width: `${segments[key]}%` }}
                      title={`${catLabels[key]}: ${segments[key].toFixed(0)}%`}
                    />
                  ) : null
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TeamLoadWidget;
