/**
 * ProjectBoardWidget — monday.com-style project board with Main Table & Gantt views.
 *
 * Uses real data from appStore (boardGroups + boardTasks).
 * Supports inline editing of task title, status, owner, dates, and progress.
 * Each project has its own independent board data.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import type { WidgetDataContext } from '@/types/widget';
import type { User, BoardGroup, BoardTask, BoardTaskStatus } from '@/types/core';
import { cn } from '@/lib/utils';
import { LayoutGrid, GanttChart, ChevronDown, ChevronRight, Plus, Trash2, X, Check } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, differenceInDays, addDays, startOfWeek, parseISO } from 'date-fns';

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

const ALL_STATUSES: BoardTaskStatus[] = ['backlog', 'waiting', 'working', 'review', 'stuck', 'done'];

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

function StatusBadge({
  status,
  t,
  onStatusChange,
}: {
  status: BoardTaskStatus;
  t: (k: string) => string;
  onStatusChange?: (newStatus: BoardTaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[status];

  if (!onStatusChange) {
    return (
      <span className={cn('inline-flex items-center justify-center px-3 py-0.5 rounded text-xs font-medium min-w-[72px]', cfg.bg, cfg.text)}>
        {t(cfg.labelKey)}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn('inline-flex items-center justify-center px-3 py-0.5 rounded text-xs font-medium min-w-[72px] cursor-pointer hover:opacity-80 transition-opacity', cfg.bg, cfg.text)}
      >
        {t(cfg.labelKey)}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-[100px]">
          {ALL_STATUSES.map(s => {
            const sc = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => { onStatusChange(s); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left',
                  s === status && 'bg-accent'
                )}
              >
                <span className={cn('w-3 h-3 rounded-sm', sc.bg)} />
                {t(sc.labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(String(value));

  if (editing && onChange) {
    return (
      <div className="flex items-center gap-1 min-w-[100px]">
        <input
          type="number"
          min={0}
          max={100}
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={() => {
            const v = Math.max(0, Math.min(100, parseInt(editVal) || 0));
            onChange(v);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = Math.max(0, Math.min(100, parseInt(editVal) || 0));
              onChange(v);
              setEditing(false);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-12 h-5 text-[11px] text-center border border-border rounded bg-background px-1"
          autoFocus
        />
        <span className="text-[10px] text-muted-foreground">%</span>
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center gap-2 min-w-[100px]', onChange && 'cursor-pointer')}
      onClick={() => { if (onChange) { setEditVal(String(value)); setEditing(true); } }}
    >
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

// ── Inline editable cell ──────────────────────────────────

function EditableCell({
  value,
  onSave,
  type = 'text',
  className = '',
}: {
  value: string;
  onSave: (v: string) => void;
  type?: 'text' | 'date';
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);

  if (!editing) {
    return (
      <span
        className={cn('cursor-pointer hover:bg-accent/30 rounded px-1 py-0.5 transition-colors', className)}
        onClick={() => { setEditVal(value); setEditing(true); }}
      >
        {value || '-'}
      </span>
    );
  }

  return (
    <input
      type={type}
      value={editVal}
      onChange={(e) => setEditVal(e.target.value)}
      onBlur={() => { onSave(editVal); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSave(editVal); setEditing(false); }
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-full h-6 text-xs border border-border rounded bg-background px-1"
      autoFocus
    />
  );
}

// ── Owner selector ────────────────────────────────────────

function OwnerSelector({ currentOwnerId, users, onSelect }: {
  currentOwnerId: string;
  users: User[];
  onSelect: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentUser = users.find(u => u.id === currentOwnerId);

  return (
    <div className="relative">
      <div className="cursor-pointer" onClick={() => setOpen(!open)}>
        <OwnerAvatar user={currentUser} />
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto min-w-[140px]">
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => { onSelect(u.id); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left',
                u.id === currentOwnerId && 'bg-accent'
              )}
            >
              <Avatar className="w-5 h-5 text-[8px]">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {u.name.slice(-2)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{u.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Table View ────────────────────────────────────────

function MainTableView({
  groups,
  tasks,
  users,
  projectId,
  t,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
}: {
  groups: BoardGroup[];
  tasks: BoardTask[];
  users: User[];
  projectId: string;
  t: (k: string) => string;
  onUpdateTask: (taskId: string, updates: Record<string, unknown>) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (groupId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const toggleGroup = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const getGroupTasks = useCallback((groupId: string) => {
    return tasks.filter(t => t.boardGroupId === groupId).sort((a, b) => a.orderNo - b.orderNo);
  }, [tasks]);

  return (
    <ScrollArea className="w-full h-full">
      <div className="min-w-[700px]">
        {/* Column header */}
        <div className="grid grid-cols-[minmax(200px,2fr)_80px_80px_100px_80px_110px_36px] gap-1 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
          <span>{t('taskName')}</span>
          <span className="text-center">{t('taskStatus')}</span>
          <span className="text-center">{t('owner')}</span>
          <span className="text-center">{t('timeline')}</span>
          <span className="text-center">{t('dueDate')}</span>
          <span className="text-center">{t('progressStatus')}</span>
          <span />
        </div>

        {groups.map(group => {
          const groupTasks = getGroupTasks(group.id);
          const isCollapsed = collapsed[group.id];
          const groupDone = groupTasks.filter(t => t.status === 'done').length;
          const groupTotal = groupTasks.length;

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
              {!isCollapsed && groupTasks.map(task => (
                <div
                  key={task.id}
                  className="grid grid-cols-[minmax(200px,2fr)_80px_80px_100px_80px_110px_36px] gap-1 px-3 py-1.5 items-center border-l-[3px] hover:bg-muted/30 transition-colors group/row"
                  style={{ borderLeftColor: group.color }}
                >
                  {/* Title - editable */}
                  <div className="pl-5">
                    <EditableCell
                      value={task.title}
                      onSave={(v) => { if (v.trim()) onUpdateTask(task.id, { title: v.trim() }); }}
                      className="text-sm truncate block w-full"
                    />
                  </div>

                  {/* Status - clickable dropdown */}
                  <div className="flex justify-center">
                    <StatusBadge
                      status={task.status}
                      t={t}
                      onStatusChange={(s) => {
                        const updates: Record<string, unknown> = { status: s };
                        if (s === 'done') updates.progress = 100;
                        onUpdateTask(task.id, updates);
                      }}
                    />
                  </div>

                  {/* Owner - clickable */}
                  <div className="flex justify-center gap-0.5">
                    <OwnerSelector
                      currentOwnerId={task.ownerId}
                      users={users}
                      onSelect={(id) => onUpdateTask(task.id, { ownerId: id })}
                    />
                  </div>

                  {/* Timeline - editable dates */}
                  <div className="text-center text-xs text-muted-foreground">
                    {task.startDate && task.endDate
                      ? `${format(parseISO(task.startDate), 'M/d')} - ${format(parseISO(task.endDate), 'M/d')}`
                      : (
                        <EditableCell
                          value=""
                          type="date"
                          onSave={(v) => {
                            if (v) {
                              const end = new Date(v);
                              end.setDate(end.getDate() + 7);
                              onUpdateTask(task.id, { startDate: v, endDate: end.toISOString().slice(0, 10) });
                            }
                          }}
                          className="text-xs"
                        />
                      )}
                  </div>

                  {/* Due date - editable */}
                  <div className="text-center text-xs text-muted-foreground">
                    <EditableCell
                      value={task.dueDate || ''}
                      type="date"
                      onSave={(v) => onUpdateTask(task.id, { dueDate: v || null })}
                      className="text-xs"
                    />
                  </div>

                  {/* Progress - editable */}
                  <div className="flex justify-center">
                    <ProgressBar
                      value={task.progress}
                      onChange={(v) => {
                        const updates: Record<string, unknown> = { progress: v };
                        if (v === 100) updates.status = 'done';
                        onUpdateTask(task.id, updates);
                      }}
                    />
                  </div>

                  {/* Delete button */}
                  <div className="flex justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add item row */}
              {!isCollapsed && (
                <div className="grid grid-cols-[minmax(200px,2fr)_80px_80px_100px_80px_110px_36px] gap-1 px-3 py-1.5 border-l-[3px] border-transparent bg-muted/20 text-xs text-muted-foreground">
                  <button
                    onClick={() => onAddTask(group.id)}
                    className="pl-5 flex items-center gap-1 cursor-pointer hover:text-primary transition-colors text-left"
                  >
                    <Plus className="w-3 h-3" />{t('addItem')}
                  </button>
                  <span />
                  <span />
                  <span />
                  <span />
                  <div className="flex justify-center">
                    <ProgressBar value={groupTotal > 0 ? Math.round((groupDone / groupTotal) * 100) : 0} />
                  </div>
                  <span />
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

function GanttChartView({
  groups,
  tasks,
  users,
  t,
}: {
  groups: BoardGroup[];
  tasks: BoardTask[];
  users: User[];
  t: (k: string) => string;
}) {
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const getGroupTasks = useCallback((groupId: string) => {
    return tasks.filter(t => t.boardGroupId === groupId).sort((a, b) => a.orderNo - b.orderNo);
  }, [tasks]);

  // Calculate date range from all tasks
  const allDates = useMemo(() => {
    const dates = tasks.flatMap(t => [t.startDate, t.endDate].filter(Boolean)) as string[];
    return dates;
  }, [tasks]);

  const minDate = allDates.length ? parseISO(allDates.sort()[0]) : new Date();
  const maxDate = allDates.length ? parseISO(allDates.sort().reverse()[0]) : addDays(new Date(), 30);

  const rangeStart = startOfWeek(addDays(minDate, -3), { weekStartsOn: 1 });
  const totalDays = Math.max(14, differenceInDays(addDays(maxDate, 10), rangeStart));
  const weeks: Date[] = [];
  for (let d = 0; d < totalDays; d += 7) {
    weeks.push(addDays(rangeStart, d));
  }

  return (
    <ScrollArea className="w-full h-full">
      <div className="min-w-[900px]">
        <div className="flex">
          {/* Left side: task list */}
          <div className="w-[220px] flex-shrink-0 border-r border-border">
            <div className="h-8 border-b border-border px-3 flex items-center text-xs font-medium text-muted-foreground">
              {t('taskName')}
            </div>
            {groups.map(group => {
              const groupTasks = getGroupTasks(group.id);
              return (
                <div key={group.id}>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                    <span className="text-xs font-semibold" style={{ color: group.color }}>{group.title}</span>
                  </div>
                  {groupTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2 px-3 py-1 border-l-[3px]" style={{ borderLeftColor: group.color }}>
                      <OwnerAvatar user={userMap.get(task.ownerId)} />
                      <span className="text-xs truncate flex-1">{task.title}</span>
                    </div>
                  ))}
                </div>
              );
            })}
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
            {groups.map(group => {
              const groupTasks = getGroupTasks(group.id);
              return (
                <div key={group.id}>
                  <div className="h-[30px] bg-muted/30" />
                  {groupTasks.map(task => (
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
              );
            })}
          </div>
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ── Add Group Dialog ──────────────────────────────────────

function AddGroupInline({ onAdd }: { onAdd: (title: string, color: string) => void }) {
  const [title, setTitle] = useState('');
  const [show, setShow] = useState(false);
  const colors = ['#0073EA', '#E44258', '#FDAB3D', '#00C875', '#A25DDC', '#FF642E', '#579BFC'];
  const [color, setColor] = useState(colors[0]);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>그룹 추가</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex gap-1">
        {colors.map(c => (
          <button
            key={c}
            className={cn('w-4 h-4 rounded-full transition-all', c === color && 'ring-2 ring-offset-1 ring-primary')}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="그룹 이름"
        className="h-7 text-xs flex-1"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim()) {
            onAdd(title.trim(), color);
            setTitle('');
            setShow(false);
          }
          if (e.key === 'Escape') setShow(false);
        }}
      />
      <Button size="sm" className="h-7 text-xs" onClick={() => { if (title.trim()) { onAdd(title.trim(), color); setTitle(''); setShow(false); } }}>
        <Check className="w-3 h-3" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShow(false)}>
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────

export default function ProjectBoardWidget({ context }: { context: WidgetDataContext }) {
  const { t } = useTranslation();
  const {
    users,
    currentUser,
    boardGroups,
    boardTasks,
    loadBoardData,
    addBoardGroup,
    addBoardTask,
    updateBoardTask,
    deleteBoardTask,
  } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [newTaskGroupId, setNewTaskGroupId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const projectId = context.type === 'project' ? context.projectId : undefined;

  // Load board data for this project
  useEffect(() => {
    if (projectId) {
      loadBoardData(projectId);
    }
  }, [projectId, loadBoardData]);

  // Filter data for current project
  const projectGroups = useMemo(
    () => boardGroups.filter(g => g.projectId === projectId).sort((a, b) => a.orderNo - b.orderNo),
    [boardGroups, projectId],
  );

  const projectTasks = useMemo(
    () => boardTasks.filter(t => t.projectId === projectId),
    [boardTasks, projectId],
  );

  // Project team members for owner selection
  const projectUsers = useMemo(() => {
    const projects = useAppStore.getState().projects;
    const project = projects.find(p => p.id === projectId);
    if (project?.teamMemberIds?.length) {
      return users.filter(u => project.teamMemberIds!.includes(u.id));
    }
    return users;
  }, [users, projectId]);

  const handleUpdateTask = useCallback((taskId: string, updates: Record<string, unknown>) => {
    updateBoardTask(taskId, updates as any);
  }, [updateBoardTask]);

  const handleDeleteTask = useCallback((taskId: string) => {
    deleteBoardTask(taskId);
    toast.success(t('deleted') || '삭제되었습니다');
  }, [deleteBoardTask, t]);

  const handleAddTask = useCallback((groupId: string) => {
    setNewTaskGroupId(groupId);
    setNewTaskTitle('');
  }, []);

  const handleConfirmAddTask = useCallback(() => {
    if (!newTaskTitle.trim() || !newTaskGroupId || !projectId || !currentUser) return;

    addBoardTask({
      boardGroupId: newTaskGroupId,
      projectId,
      title: newTaskTitle.trim(),
      ownerId: currentUser.id,
    });

    setNewTaskGroupId(null);
    setNewTaskTitle('');
    toast.success(t('todoCreated') || '작업이 추가되었습니다');
  }, [newTaskTitle, newTaskGroupId, projectId, currentUser, addBoardTask, t]);

  const handleAddGroup = useCallback((title: string, color: string) => {
    if (!projectId) return;
    addBoardGroup(projectId, title, color);
  }, [projectId, addBoardGroup]);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {t('selectProject') || '프로젝트를 선택하세요'}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* View mode toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0">
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
          <MainTableView
            groups={projectGroups}
            tasks={projectTasks}
            users={projectUsers}
            projectId={projectId}
            t={t}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onAddTask={handleAddTask}
          />
        ) : (
          <GanttChartView
            groups={projectGroups}
            tasks={projectTasks}
            users={projectUsers}
            t={t}
          />
        )}
      </div>

      {/* Add group button */}
      <div className="shrink-0 border-t border-border">
        <AddGroupInline onAdd={handleAddGroup} />
      </div>

      {/* New task inline input (floating) */}
      {newTaskGroupId && (
        <div className="absolute bottom-16 left-4 right-4 bg-popover border border-border rounded-lg shadow-lg p-3 z-50">
          <div className="flex items-center gap-2">
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={t('whatNeedsToBeDone') || '할 일을 입력하세요'}
              className="flex-1 h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTaskTitle.trim()) handleConfirmAddTask();
                if (e.key === 'Escape') setNewTaskGroupId(null);
              }}
            />
            <Button size="sm" className="h-8" onClick={handleConfirmAddTask} disabled={!newTaskTitle.trim()}>
              <Check className="w-3.5 h-3.5 mr-1" />
              {t('add') || '추가'}
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setNewTaskGroupId(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
