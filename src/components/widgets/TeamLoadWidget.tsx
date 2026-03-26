/**
 * TeamLoadWidget — 전체 대시보드용 팀 부하 위젯
 *
 * 가중 비율 (2026-03-09):
 * - Todo 할당: 30%
 * - 캘린더 이벤트: 30%
 * - 보드 업무(Gantt): 40%
 *
 * 이번 주(월~일) 기준으로 계산
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { calculateTeamLoad, WEIGHTS } from '@/utils/teamLoadCalculation';
import { useTranslation } from '@/hooks/useTranslation';
import { startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import type { WidgetDataContext } from '@/types/widget';

const CATEGORY_COLORS = {
  todo:     { bg: 'bg-amber-500',  light: 'bg-amber-500/20' },
  calendar: { bg: 'bg-purple-500', light: 'bg-purple-500/20' },
  board:    { bg: 'bg-blue-500',   light: 'bg-blue-500/20' },
};

function TeamLoadWidget({ context }: { context: WidgetDataContext }) {
  const { t, language } = useTranslation();
  const { projects, getUserById, users, personalTodos, events, boardTasks } = useAppStore();

  // This week range (Mon-Sun)
  const weekRange = useMemo(() => {
    const now = new Date();
    return {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    };
  }, []);

  const isInWeek = (dateStr?: string) => {
    if (!dateStr) return false;
    try {
      return isWithinInterval(parseISO(dateStr), weekRange);
    } catch { return false; }
  };

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === 'ACTIVE' || p.status === 'IN_PROGRESS' as any),
    [projects]
  );

  const loadData = useMemo(() => {
    // Collect all team members across active projects
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
      const projectIdSet = new Set(projectIds);

      // Todos assigned this week
      const todosAssigned = personalTodos.filter(td =>
        td.assigneeIds?.includes(userId) &&
        projectIdSet.has(td.projectId || '') &&
        (isInWeek(td.createdAt) || isInWeek(td.dueDate))
      ).length;

      // Calendar events this week
      const calendarEvents = events.filter(e =>
        (e.ownerId === userId || e.attendeeIds?.includes(userId)) &&
        isInWeek(e.startAt)
      ).length;

      // Board tasks with dates (Gantt items) overlapping this week
      // Include tasks where user is owner OR reviewer
      const boardTaskCount = boardTasks.filter(bt =>
        (bt.ownerId === userId || bt.reviewerIds?.includes(userId)) &&
        bt.startDate && bt.endDate &&
        bt.status !== 'done' && (
          isInWeek(bt.startDate) || isInWeek(bt.endDate) ||
          // Task spans the entire week
          ((() => {
            try {
              const s = parseISO(bt.startDate!);
              const e = parseISO(bt.endDate!);
              return s <= weekRange.start && e >= weekRange.end;
            } catch { return false; }
          })())
        )
      ).length;

      return { userId, todosAssigned, calendarEvents, boardTasks: boardTaskCount };
    });

    return calculateTeamLoad(inputs);
  }, [activeProjects, personalTodos, events, boardTasks, weekRange]);

  if (loadData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        {t('noActiveProjects') || 'No active projects'}
      </div>
    );
  }

  const sorted = [...loadData].sort((a, b) => b.loadScore - a.loadScore);
  const maxScore = Math.max(...sorted.map(d => d.loadScore), 1);

  const catLabels = language === 'ko'
    ? { todo: '할일', calendar: '일정', board: '보드 업무' }
    : { todo: 'Todos', calendar: 'Events', board: 'Board Tasks' };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Legend */}
      <div className="flex items-center gap-3 px-2 pb-1.5 flex-wrap">
        {(Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).map(key => (
          <div key={key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-sm ${CATEGORY_COLORS[key].bg}`} />
            <span className="text-xs font-medium text-muted-foreground">
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

          const total = member.todosAssigned + member.calendarEvents + member.boardTasks;
          const segments = total > 0 ? {
            todo:     (member.todosAssigned / total) * 100,
            calendar: (member.calendarEvents / total) * 100,
            board:    (member.boardTasks / total) * 100,
          } : { todo: 33, calendar: 33, board: 34 };

          return (
            <div key={member.userId} className="space-y-0.5">
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
                <span className={`text-xs font-medium tabular-nums ${isOverloaded ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                  {member.loadScore.toFixed(1)}%
                </span>
              </div>

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
