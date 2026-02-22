/**
 * ProjectBoardWidget — monday.com-style project board with Main Table & Gantt views.
 *
 * Displays tasks grouped by phase, with status badges, owner avatars,
 * timeline bars, due dates, and progress indicators.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import type { WidgetDataContext } from '@/types/widget';
import type { User } from '@/types/core';
import { cn } from '@/lib/utils';
import { LayoutGrid, GanttChart, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { format, differenceInDays, addDays, startOfWeek, isWithinInterval, parseISO } from 'date-fns';

// ── Types ──────────────────────────────────────────────────

type BoardTaskStatus = 'done' | 'working' | 'stuck' | 'waiting' | 'backlog' | 'review';

interface BoardTask {
  id: string;
  title: string;
  status: BoardTaskStatus;
  ownerId: string;
  reviewerIds?: string[];
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  progress: number; // 0-100
}

interface BoardGroup {
  id: string;
  title: string;
  color: string;
  tasks: BoardTask[];
}

type ViewMode = 'table' | 'gantt';

// ── Status config ──────────────────────────────────────────

const STATUS_CONFIG: Record<BoardTaskStatus, { bg: string; text: string; labelKey: string }> = {
  done:    { bg: 'bg-emerald-500', text: 'text-white', labelKey: 'statusDone' },
  working: { bg: 'bg-amber-400',   text: 'text-white', labelKey: 'statusWorking' },
  stuck:   { bg: 'bg-red-500',     text: 'text-white', labelKey: 'statusStuck' },
  waiting: { bg: 'bg-muted',       text: 'text-muted-foreground', labelKey: 'statusWaiting' },
  backlog: { bg: 'bg-slate-400',   text: 'text-white', labelKey: 'statusBacklog' },
  review:  { bg: 'bg-orange-400',  text: 'text-white', labelKey: 'statusReview' },
};

// ── Mock board data (scoped to project) ────────────────────

function generateBoardData(projectId?: string): BoardGroup[] {
  return [
    {
      id: 'g1', title: '기획', color: '#0073EA',
      tasks: [
        { id: 't1', title: '킥오프 미팅 자료 준비', status: 'done', ownerId: 'u2', startDate: '2026-02-03', endDate: '2026-02-14', dueDate: '2026-02-15', progress: 100 },
        { id: 't2', title: '목표 및 방향성 정리', status: 'done', ownerId: 'u3', startDate: '2026-02-10', endDate: '2026-02-21', dueDate: '2026-02-19', progress: 100 },
        { id: 't3', title: '핵심 리소스 확인', status: 'working', ownerId: 'u2', reviewerIds: ['u1'], startDate: '2026-02-17', endDate: '2026-03-01', dueDate: '2026-02-22', progress: 60 },
        { id: 't4', title: '리스크 평가', status: 'backlog', ownerId: 'u4', startDate: '2026-02-24', endDate: '2026-03-07', dueDate: '2026-03-05', progress: 0 },
      ],
    },
    {
      id: 'g2', title: '디자인', color: '#E44258',
      tasks: [
        { id: 't5', title: '레퍼런스 수집 및 무드보드', status: 'done', ownerId: 'u4', startDate: '2026-02-10', endDate: '2026-02-20', dueDate: '2026-02-20', progress: 100 },
        { id: 't6', title: '시안 작업 (A/B)', status: 'working', ownerId: 'u4', reviewerIds: ['u1', 'u3'], startDate: '2026-02-18', endDate: '2026-03-05', dueDate: '2026-03-01', progress: 40 },
        { id: 't7', title: '수정 반영', status: 'waiting', ownerId: 'u4', startDate: '2026-03-03', endDate: '2026-03-10', dueDate: '2026-03-08', progress: 0 },
        { id: 't8', title: '최종 시안 확정', status: 'backlog', ownerId: 'u1', startDate: '2026-03-08', endDate: '2026-03-14', dueDate: '2026-03-14', progress: 0 },
      ],
    },
    {
      id: 'g3', title: '제작', color: '#FDAB3D',
      tasks: [
        { id: 't9', title: '촬영 스케줄 확정', status: 'review', ownerId: 'u2', startDate: '2026-02-24', endDate: '2026-03-05', dueDate: '2026-03-03', progress: 80 },
        { id: 't10', title: '촬영 진행', status: 'backlog', ownerId: 'u5', startDate: '2026-03-10', endDate: '2026-03-20', dueDate: '2026-03-18', progress: 0 },
        { id: 't11', title: '편집 1차', status: 'backlog', ownerId: 'u3', startDate: '2026-03-18', endDate: '2026-03-28', dueDate: '2026-03-28', progress: 0 },
        { id: 't12', title: '최종 납품', status: 'backlog', ownerId: 'u2', startDate: '2026-03-28', endDate: '2026-04-05', dueDate: '2026-04-04', progress: 0 },
      ],
    },
  ];
}

// ── Sub-components ─────────────────────────────────────────

function OwnerAvatar({ user }: { user?: User }) {
  if (!user) return <div className="w-7 h-7 rounded-full bg-muted" />;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className="w-7 h-7 text-[10px] cursor-default">
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {user.name.slice(-2)}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{user.name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StatusBadge({ status, t }: { status: BoardTaskStatus; t: (k: any) => string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center justify-center px-3 py-0.5 rounded text-xs font-medium min-w-[72px]', cfg.bg, cfg.text)}>
      {t(cfg.labelKey)}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden border border-border">
        <div className="h-full bg-emerald-600 rounded-full transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

function TimelineBar({ startDate, endDate, rangeStart, totalDays }: { startDate: string; endDate: string; rangeStart: Date; totalDays: number }) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const leftDays = Math.max(0, differenceInDays(start, rangeStart));
  const widthDays = Math.max(1, differenceInDays(end, start) + 1);
  const leftPct = (leftDays / totalDays) * 100;
  const widthPct = (widthDays / totalDays) * 100;

  return (
    <div className="relative h-6 w-full">
      <div
        className="absolute top-1 h-4 rounded-full bg-primary/70"
        style={{ left: `${leftPct}%`, width: `${Math.min(widthPct, 100 - leftPct)}%` }}
      />
    </div>
  );
}

// ── Main Table View ────────────────────────────────────────

function MainTableView({ groups, users, t }: { groups: BoardGroup[]; users: User[]; t: (k: any) => string }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const toggleGroup = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <ScrollArea className="w-full">
      <div className="min-w-[700px]">
        {/* Column header */}
        <div className="grid grid-cols-[minmax(200px,2fr)_80px_80px_100px_80px_110px] gap-1 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
          <span>{t('taskName')}</span>
          <span className="text-center">{t('taskStatus')}</span>
          <span className="text-center">{t('owner')}</span>
          <span className="text-center">{t('timeline')}</span>
          <span className="text-center">{t('dueDate')}</span>
          <span className="text-center">{t('progressStatus')}</span>
        </div>

        {groups.map(group => {
          const isCollapsed = collapsed[group.id];
          const groupDone = group.tasks.filter(t => t.status === 'done').length;
          const groupTotal = group.tasks.length;

          return (
            <div key={group.id} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/40 transition-colors"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                <span className="font-semibold text-sm" style={{ color: group.color }}>{group.title}</span>
                <span className="text-xs text-muted-foreground ml-1">{groupDone}/{groupTotal}</span>
              </button>

              {/* Task rows */}
              {!isCollapsed && group.tasks.map(task => (
                <div
                  key={task.id}
                  className="grid grid-cols-[minmax(200px,2fr)_80px_80px_100px_80px_110px] gap-1 px-3 py-1.5 items-center border-l-[3px] hover:bg-muted/30 transition-colors"
                  style={{ borderLeftColor: group.color }}
                >
                  <span className="text-sm truncate pl-5">{task.title}</span>
                  <div className="flex justify-center"><StatusBadge status={task.status} t={t} /></div>
                  <div className="flex justify-center gap-0.5">
                    <OwnerAvatar user={userMap.get(task.ownerId)} />
                    {task.reviewerIds?.map(rid => (
                      <OwnerAvatar key={rid} user={userMap.get(rid)} />
                    ))}
                  </div>
                  <div className="text-center text-xs text-muted-foreground">
                    {task.startDate && task.endDate
                      ? `${format(parseISO(task.startDate), 'M/d')} - ${format(parseISO(task.endDate), 'M/d')}`
                      : '-'}
                  </div>
                  <div className="text-center text-xs text-muted-foreground">
                    {task.dueDate ? format(parseISO(task.dueDate), 'M/d') : '-'}
                  </div>
                  <div className="flex justify-center"><ProgressBar value={task.progress} /></div>
                </div>
              ))}

              {/* Group summary row */}
              {!isCollapsed && (
                <div className="grid grid-cols-[minmax(200px,2fr)_80px_80px_100px_80px_110px] gap-1 px-3 py-1.5 border-l-[3px] border-transparent bg-muted/20 text-xs text-muted-foreground">
                  <span className="pl-5 flex items-center gap-1 cursor-pointer hover:text-primary transition-colors">
                    <Plus className="w-3 h-3" />{t('addItem')}
                  </span>
                  <span />
                  <span />
                  <span />
                  <span />
                  <div className="flex justify-center">
                    <ProgressBar value={groupTotal > 0 ? Math.round((groupDone / groupTotal) * 100) : 0} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ── Gantt Chart View ───────────────────────────────────────

function GanttChartView({ groups, users, t }: { groups: BoardGroup[]; users: User[]; t: (k: any) => string }) {
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  // Calculate date range
  const allTasks = groups.flatMap(g => g.tasks);
  const allDates = allTasks.flatMap(t => [t.startDate, t.endDate].filter(Boolean)) as string[];
  const minDate = allDates.length ? parseISO(allDates.sort()[0]) : new Date();
  const maxDate = allDates.length ? parseISO(allDates.sort().reverse()[0]) : addDays(new Date(), 30);

  const rangeStart = startOfWeek(addDays(minDate, -3), { weekStartsOn: 1 });
  const totalDays = differenceInDays(addDays(maxDate, 10), rangeStart);
  const weeks: Date[] = [];
  for (let d = 0; d < totalDays; d += 7) {
    weeks.push(addDays(rangeStart, d));
  }

  return (
    <ScrollArea className="w-full">
      <div className="min-w-[900px]">
        <div className="flex">
          {/* Left side: task list */}
          <div className="w-[220px] flex-shrink-0 border-r border-border">
            <div className="h-8 border-b border-border px-3 flex items-center text-xs font-medium text-muted-foreground">
              {t('taskName')}
            </div>
            {groups.map(group => (
              <div key={group.id}>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                  <span className="text-xs font-semibold" style={{ color: group.color }}>{group.title}</span>
                </div>
                {group.tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 px-3 py-1 border-l-[3px]" style={{ borderLeftColor: group.color }}>
                    <OwnerAvatar user={userMap.get(task.ownerId)} />
                    <span className="text-xs truncate flex-1">{task.title}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Right side: timeline */}
          <div className="flex-1 overflow-hidden">
            {/* Week headers */}
            <div className="flex h-8 border-b border-border">
              {weeks.map((w, i) => (
                <div key={i} className="flex-shrink-0 text-[10px] text-muted-foreground flex items-center justify-center border-r border-border/50" style={{ width: `${(7 / totalDays) * 100}%`, minWidth: 60 }}>
                  {format(w, 'M/d')}
                </div>
              ))}
            </div>

            {/* Bars */}
            {groups.map(group => (
              <div key={group.id}>
                <div className="h-[30px] bg-muted/30" />
                {group.tasks.map(task => (
                  <div key={task.id} className="h-[30px] relative">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {weeks.map((_, i) => (
                        <div key={i} className="flex-shrink-0 border-r border-border/20" style={{ width: `${(7 / totalDays) * 100}%`, minWidth: 60 }} />
                      ))}
                    </div>
                    {/* Bar */}
                    {task.startDate && task.endDate && (
                      <div className="absolute inset-x-0 top-0 h-full px-0">
                        <TimelineBar
                          startDate={task.startDate}
                          endDate={task.endDate}
                          rangeStart={rangeStart}
                          totalDays={totalDays}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ── Main Widget ────────────────────────────────────────────

export default function ProjectBoardWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const { users } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const groups = useMemo(() => generateBoardData(context.projectId), [context.projectId]);

  return (
    <div className="flex flex-col h-full">
      {/* View mode toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
        <Button
          variant={viewMode === 'table' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setViewMode('table')}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          {t('mainTable')}
        </Button>
        <Button
          variant={viewMode === 'gantt' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setViewMode('gantt')}
        >
          <GanttChart className="w-3.5 h-3.5" />
          {t('ganttChart')}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'table' ? (
          <MainTableView groups={groups} users={users} t={t} />
        ) : (
          <GanttChartView groups={groups} users={users} t={t} />
        )}
      </div>
    </div>
  );
}
