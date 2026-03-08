/**
 * ProjectBoardWidget — monday.com-style project board with Main Table & Gantt views.
 *
 * Uses real data from appStore (boardGroups + boardTasks).
 * Supports inline editing of task title, status, owner, dates, and progress.
 * Each project has its own independent board data.
 *
 * v2: Multiple owners, searchable owner selector, gantt drag-and-drop,
 *     group-colored gantt bars, default dates on task creation.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/stores/appStore';
import type { WidgetDataContext } from '@/types/widget';
import type { User, BoardGroup, BoardTask, BoardTaskStatus, Project } from '@/types/core';
import { cn } from '@/lib/utils';
import { LayoutGrid, GanttChart, ChevronDown, ChevronRight, Plus, Trash2, X, Check, Search, Clock, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

function OwnerAvatar({ user, size = 7 }: { user?: User; size?: number }) {
  if (!user) return <div className={`w-${size} h-${size} rounded-full bg-muted`} style={{ width: size * 4, height: size * 4 }} />;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar className="text-xs font-medium cursor-default" style={{ width: size * 4, height: size * 4 }}>
            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
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

/**
 * Calculate time-based progress (%) from startDate to dueDate/endDate.
 * Returns 0 before start, 100 after due, linear interpolation in between.
 * If task status is 'done', always returns 100.
 */
function calcTimeProgress(task: { startDate?: string; endDate?: string; dueDate?: string; status?: string; progress?: number }): number {
  if (task.status === 'done') return 100;
  const start = task.startDate ? parseISO(task.startDate) : null;
  const end = task.dueDate ? parseISO(task.dueDate) : (task.endDate ? parseISO(task.endDate) : null);
  if (!start || !end) return task.progress ?? 0; // fallback to manual if no dates
  const now = new Date();
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return now >= end ? 100 : 0;
  const elapsedMs = now.getTime() - start.getTime();
  return Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
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
          className="w-12 h-5 text-xs text-center border border-border rounded bg-background px-1"
          autoFocus
        />
        <span className="text-xs font-medium text-muted-foreground">%</span>
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center gap-2 min-w-[100px]', onChange && 'cursor-pointer')}
      onClick={() => { if (onChange) { setEditVal(String(value)); setEditing(true); } }}
    >
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden border border-border">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            value >= 100 ? 'bg-emerald-500' : value >= 80 ? 'bg-amber-500' : 'bg-primary',
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value}%</span>
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
        {type === 'date' && value ? format(parseISO(value), 'M/d') : (value || '-')}
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

// ── Multi-Owner selector with search ──────────────────────

function MultiOwnerSelector({
  ownerIds,
  users,
  onSelect,
}: {
  ownerIds: string[];
  users: User[];
  onSelect: (userIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedUsers = useMemo(() => ownerIds.map(id => users.find(u => u.id === id)).filter(Boolean) as User[], [ownerIds, users]);

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, search]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleUser = (userId: string) => {
    if (ownerIds.includes(userId)) {
      // Don't remove if it's the last owner
      if (ownerIds.length <= 1) return;
      onSelect(ownerIds.filter(id => id !== userId));
    } else {
      onSelect([...ownerIds, userId]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-0.5 cursor-pointer" onClick={() => { setOpen(!open); setSearch(''); }}>
        {selectedUsers.length === 0 ? (
          <div className="w-7 h-7 rounded-full bg-muted" />
        ) : selectedUsers.length === 1 ? (
          <OwnerAvatar user={selectedUsers[0]} />
        ) : (
          <div className="flex -space-x-2">
            {selectedUsers.slice(0, 3).map(u => (
              <Avatar key={u.id} className="w-7 h-7 text-[8px] border-2 border-background">
                {u.avatar && <AvatarImage src={u.avatar} alt={u.name} className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {u.name.slice(-2)}
                </AvatarFallback>
              </Avatar>
            ))}
            {selectedUsers.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[8px] border-2 border-background">
                +{selectedUsers.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-52 overflow-hidden min-w-[180px]">
          <div className="p-1.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchName')}
                className="w-full h-6 text-xs border border-border rounded bg-background pl-6 pr-2"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-36 overflow-y-auto">
            {filteredUsers.map(u => {
              const isSelected = ownerIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left',
                    isSelected && 'bg-accent'
                  )}
                >
                  <div className="relative">
                    <Avatar className="w-5 h-5 text-[8px]">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {u.name.slice(-2)}
                      </AvatarFallback>
                    </Avatar>
                    {isSelected && (
                      <Check className="absolute -top-0.5 -right-0.5 w-3 h-3 text-emerald-500 bg-background rounded-full" />
                    )}
                  </div>
                  <span className="truncate">{u.name}</span>
                </button>
              );
            })}
            {filteredUsers.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground text-center">검색 결과 없음</div>
            )}
          </div>
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

  const toggleGroup = (id: string) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  const getGroupTasks = useCallback((groupId: string) => {
    return tasks.filter(tk => tk.boardGroupId === groupId).sort((a, b) => a.orderNo - b.orderNo);
  }, [tasks]);

  return (
    <ScrollArea className="w-full h-full">
      <div className="min-w-[700px]">
        {/* Column header */}
        <div className="grid grid-cols-[minmax(200px,2fr)_90px_120px_90px_90px_120px_36px] gap-1 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border sticky top-0 bg-background z-10">
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
          const groupDone = groupTasks.filter(tk => tk.status === 'done').length;
          const groupTotal = groupTasks.length;

          return (
            <div key={group.id} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-muted/40 transition-colors rounded-lg mx-1"
                style={{ borderLeft: `3px solid ${group.color}` }}
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                <span className="font-semibold text-sm" style={{ color: group.color }}>{group.title}</span>
                <span className="text-xs text-muted-foreground ml-auto bg-muted/50 px-2 py-0.5 rounded-full">{groupDone}/{groupTotal}</span>
              </button>

              {/* Task rows */}
              {!isCollapsed && groupTasks.map(task => {
                const ownerIds = task.reviewerIds?.length
                  ? [task.ownerId, ...task.reviewerIds]
                  : [task.ownerId];

                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-[minmax(200px,2fr)_90px_120px_90px_90px_120px_36px] gap-1 px-3 py-1.5 items-center border-l-[3px] hover:bg-muted/30 transition-colors group/row"
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

                    {/* Owner - multi-select with search */}
                    <div className="flex justify-center gap-0.5">
                      <MultiOwnerSelector
                        ownerIds={ownerIds}
                        users={users}
                        onSelect={(ids) => {
                          const [primaryOwner, ...reviewers] = ids;
                          onUpdateTask(task.id, {
                            ownerId: primaryOwner,
                            reviewerIds: reviewers,
                          });
                        }}
                      />
                    </div>

                    {/* Start date - editable */}
                    <div className="text-center text-xs text-muted-foreground">
                      <EditableCell
                        value={task.startDate || ''}
                        type="date"
                        onSave={(v) => onUpdateTask(task.id, { startDate: v || null })}
                        className="text-xs"
                      />
                    </div>

                    {/* Due date - editable (syncs endDate for Gantt) */}
                    <div className="text-center text-xs text-muted-foreground">
                      <EditableCell
                        value={task.dueDate || task.endDate || ''}
                        type="date"
                        onSave={(v) => onUpdateTask(task.id, { dueDate: v || null, endDate: v || null })}
                        className="text-xs"
                      />
                    </div>

                    {/* Progress - auto-calculated from date range */}
                    <div className="flex justify-center">
                      <ProgressBar
                        value={calcTimeProgress(task)}
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
                );
              })}

              {/* Add item row */}
              {!isCollapsed && (
                <div className="grid grid-cols-[minmax(200px,2fr)_90px_120px_90px_90px_120px_36px] gap-1 px-3 py-1.5 border-l-[3px] border-transparent bg-muted/20 text-xs text-muted-foreground">
                  <button
                    onClick={() => onAddTask(group.id)}
                    className="pl-5 flex items-center gap-1 cursor-pointer hover:text-primary transition-colors text-left"
                  >
                    {t('addItem')}
                  </button>
                  <span />
                  <span />
                  <span />
                  <span />
                  <div className="flex justify-center">
                    <ProgressBar value={groupTotal > 0 ? Math.round(groupTasks.reduce((sum, tk) => sum + calcTimeProgress(tk), 0) / groupTotal) : 0} />
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

// ── Gantt Chart View — Card-based Timeline ────────────────────
// Reference: staggered card layout with group-color accent bars,
// avatar stacks, day-by-day header, today highlight.

const DAY_WIDTH = 80; // px per day column
const CARD_HEIGHT = 72; // card height in px
const CARD_GAP = 12; // vertical gap between cards
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Assign Y-lanes to cards so overlapping date ranges don't collide vertically. */
function assignLanes(items: { id: string; startDay: number; endDay: number }[]): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.startDay - b.startDay || a.endDay - b.endDay);
  const laneEnds: number[] = []; // track where each lane's last card ends
  const result = new Map<string, number>();
  for (const item of sorted) {
    let placed = false;
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (item.startDay > laneEnds[lane]) {
        laneEnds[lane] = item.endDay;
        result.set(item.id, lane);
        placed = true;
        break;
      }
    }
    if (!placed) {
      result.set(item.id, laneEnds.length);
      laneEnds.push(item.endDay);
    }
  }
  return result;
}

function GanttChartView({
  groups,
  tasks,
  users,
  t,
  onUpdateTask,
}: {
  groups: BoardGroup[];
  tasks: BoardTask[];
  users: User[];
  t: (k: string) => string;
  onUpdateTask: (taskId: string, updates: Record<string, unknown>) => void;
}) {
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    taskId: string;
    mode: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    origStart: string;
    origEnd: string;
  } | null>(null);

  // Build group color map
  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach(g => map.set(g.id, g.color));
    return map;
  }, [groups]);

  // Calculate date range (fully memoized to prevent re-render loops)
  const { rangeStart, totalDays, days, todayStr } = useMemo(() => {
    const allDates = tasks.flatMap(tk => [tk.startDate, tk.endDate, tk.dueDate].filter(Boolean)) as string[];
    const now = new Date();
    const minD = allDates.length ? parseISO([...allDates].sort()[0]) : now;
    const maxD = allDates.length ? parseISO([...allDates].sort().reverse()[0]) : addDays(now, 30);
    const rs = startOfWeek(addDays(minD, -3), { weekStartsOn: 1 });
    const td = Math.max(14, Math.min(365, differenceInDays(addDays(maxD, 10), rs)));
    const dayArr = Array.from({ length: td }, (_, i) => addDays(rs, i));
    return {
      rangeStart: rs,
      totalDays: td,
      days: dayArr,
      todayStr: format(now, 'yyyy-MM-dd'),
    };
  }, [tasks]);

  // All tasks with date ranges, flattened with lane assignment
  const tasksWithDates = useMemo(() => {
    return tasks
      .filter(tk => tk.startDate && (tk.endDate || tk.dueDate))
      .map(tk => {
        const effectiveEnd = tk.endDate || tk.dueDate!;
        const startDay = differenceInDays(parseISO(tk.startDate!), rangeStart);
        const endDay = differenceInDays(parseISO(effectiveEnd), rangeStart);
        return { ...tk, startDay, endDay, endDate: effectiveEnd };
      });
  }, [tasks, rangeStart]);

  const laneMap = useMemo(() => assignLanes(
    tasksWithDates.map(tk => ({ id: tk.id, startDay: tk.startDay, endDay: tk.endDay }))
  ), [tasksWithDates]);

  const maxLane = useMemo(() => {
    let m = 0;
    laneMap.forEach(v => { if (v > m) m = v; });
    return m;
  }, [laneMap]);

  const contentHeight = (maxLane + 1) * (CARD_HEIGHT + CARD_GAP) + CARD_GAP;

  // Track last applied delta
  const lastDeltaRef = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const daysDelta = Math.round(dx / DAY_WIDTH);
    if (daysDelta === lastDeltaRef.current) return;
    lastDeltaRef.current = daysDelta;

    if (daysDelta === 0) {
      onUpdateTask(dragging.taskId, { startDate: dragging.origStart, endDate: dragging.origEnd });
      return;
    }

    const origStart = parseISO(dragging.origStart);
    const origEnd = parseISO(dragging.origEnd);

    if (dragging.mode === 'move') {
      const newEndStr = format(addDays(origEnd, daysDelta), 'yyyy-MM-dd');
      onUpdateTask(dragging.taskId, {
        startDate: format(addDays(origStart, daysDelta), 'yyyy-MM-dd'),
        endDate: newEndStr,
        dueDate: newEndStr,
      });
    } else if (dragging.mode === 'resize-left') {
      const newStart = addDays(origStart, daysDelta);
      if (differenceInDays(origEnd, newStart) >= 0) {
        onUpdateTask(dragging.taskId, { startDate: format(newStart, 'yyyy-MM-dd') });
      }
    } else if (dragging.mode === 'resize-right') {
      const newEnd = addDays(origEnd, daysDelta);
      if (differenceInDays(newEnd, origStart) >= 0) {
        const newEndStr = format(newEnd, 'yyyy-MM-dd');
        onUpdateTask(dragging.taskId, { endDate: newEndStr, dueDate: newEndStr });
      }
    }
  }, [dragging, onUpdateTask]);

  const handleMouseUp = useCallback(() => {
    if (dragging && lastDeltaRef.current === 0) {
      onUpdateTask(dragging.taskId, { startDate: dragging.origStart, endDate: dragging.origEnd });
    }
    lastDeltaRef.current = 0;
    setDragging(null);
  }, [dragging, onUpdateTask]);

  useEffect(() => {
    if (!dragging) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const startDrag = (taskId: string, mode: 'move' | 'resize-left' | 'resize-right', startX: number, origStart: string, origEnd: string) => {
    setDragging({ taskId, mode, startX, origStart, origEnd });
  };

  // Scroll to today on mount
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const todayOffset = differenceInDays(new Date(), rangeStart);
    if (scrollRef.current && todayOffset > 3) {
      scrollRef.current.scrollLeft = (todayOffset - 3) * DAY_WIDTH;
    }
  }, []);

  const statusLabel = (status: string) => {
    const cfg = STATUS_CONFIG[status as BoardTaskStatus];
    return cfg ? t(cfg.labelKey) : status;
  };

  return (
    <ScrollArea className="w-full h-full">
      <div ref={scrollRef} className="overflow-x-auto">
        <div style={{ width: totalDays * DAY_WIDTH, minWidth: '100%' }}>
          {/* ── Day header row ── */}
          <div className="flex h-10 border-b border-border/40 sticky top-0 z-20 bg-background/95 backdrop-blur-sm">
            {days.map((day, i) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isToday = dayStr === todayStr;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-shrink-0 flex flex-col items-center justify-center text-xs border-r border-border/20',
                    isWeekend && 'text-muted-foreground/50',
                    !isWeekend && !isToday && 'text-muted-foreground',
                  )}
                  style={{ width: DAY_WIDTH }}
                >
                  <span className="text-xs font-medium">{DAY_NAMES[day.getDay()]}</span>
                  {isToday ? (
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {format(day, 'd')}
                    </span>
                  ) : (
                    <span className={cn('text-xs font-medium', isWeekend && 'opacity-50')}>
                      {format(day, 'd')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Timeline body ── */}
          <div className="relative" style={{ height: contentHeight }}>
            {/* Vertical grid lines + weekend shading */}
            {days.map((day, i) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const dayStr = format(day, 'yyyy-MM-dd');
              const isToday = dayStr === todayStr;
              return (
                <div
                  key={i}
                  className="absolute top-0 bottom-0"
                  style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                >
                  {isWeekend && (
                    <div className="absolute inset-0 bg-muted/10" />
                  )}
                  {isToday && (
                    <div className="absolute inset-y-0 left-1/2 -translate-x-px w-[2px] bg-primary/50 z-[5]" />
                  )}
                  <div className="absolute right-0 top-0 bottom-0 w-px bg-border/15" />
                </div>
              );
            })}

            {/* ── Task cards ── */}
            {tasksWithDates.map(task => {
              const lane = laneMap.get(task.id) ?? 0;
              const groupColor = groupColorMap.get(task.boardGroupId) ?? '#6366f1';
              const leftPx = task.startDay * DAY_WIDTH;
              const widthPx = Math.max((task.endDay - task.startDay + 1) * DAY_WIDTH, DAY_WIDTH);
              const topPx = CARD_GAP + lane * (CARD_HEIGHT + CARD_GAP);

              const ownerIds = task.reviewerIds?.length
                ? [task.ownerId, ...task.reviewerIds]
                : [task.ownerId];
              const owners = ownerIds.map(id => userMap.get(id)).filter(Boolean) as User[];
              const durationDays = task.endDay - task.startDay + 1;

              return (
                <div
                  key={task.id}
                  className={cn(
                    'absolute rounded-lg border border-border/40 bg-card/90 backdrop-blur-sm',
                    'shadow-sm hover:shadow-md hover:border-border/70 transition-all duration-150',
                    'flex items-stretch overflow-hidden group/card',
                  )}
                  style={{
                    left: leftPx,
                    width: widthPx,
                    top: topPx,
                    height: CARD_HEIGHT,
                    cursor: dragging?.taskId === task.id ? 'grabbing' : 'grab',
                    zIndex: dragging?.taskId === task.id ? 30 : 10,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    startDrag(task.id, 'move', e.clientX, task.startDate!, task.endDate!);
                  }}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 w-2 h-full cursor-col-resize z-20 opacity-0 group-hover/card:opacity-100 hover:bg-primary/10 transition-opacity"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      startDrag(task.id, 'resize-left', e.clientX, task.startDate!, task.endDate!);
                    }}
                  />

                  {/* Group color accent bar */}
                  <div
                    className="w-1 flex-shrink-0 rounded-l-lg"
                    style={{ backgroundColor: groupColor }}
                  />

                  {/* Card content */}
                  <div className="flex-1 min-w-0 px-3 py-2 flex flex-col justify-center gap-1">
                    {/* Top row: avatars + title */}
                    <div className="flex items-center gap-2">
                      {/* Avatar stack */}
                      <div className="flex -space-x-2 flex-shrink-0">
                        {owners.slice(0, 3).map((user, idx) => (
                          <TooltipProvider key={user.id} delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Avatar
                                  className="border-2 border-card ring-1 ring-border/30"
                                  style={{ width: 28, height: 28, zIndex: 3 - idx }}
                                >
                                  {user.avatar && <AvatarImage src={user.avatar} alt={user.name} className="object-cover" />}
                                  <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs font-medium">
                                    {user.name.slice(-2)}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">{user.name}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                        {owners.length > 3 && (
                          <Avatar className="border-2 border-card" style={{ width: 28, height: 28 }}>
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium font-medium">
                              +{owners.length - 3}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <span className="text-sm font-semibold truncate text-foreground">
                        {task.title}
                      </span>
                    </div>

                    {/* Bottom row: group + status + duration */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ backgroundColor: groupColor + '20', color: groupColor }}
                      >
                        {groups.find(g => g.id === task.boardGroupId)?.title || ''}
                      </span>
                      <span className="truncate">
                        {statusLabel(task.status)} · {durationDays}{t('ganttDays') || '일'}
                      </span>
                    </div>
                  </div>

                  {/* Three-dot menu */}
                  <div className="flex items-center pr-2 flex-shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: task context menu
                      }}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 w-2 h-full cursor-col-resize z-20 opacity-0 group-hover/card:opacity-100 hover:bg-primary/10 transition-opacity"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      startDrag(task.id, 'resize-right', e.clientX, task.startDate!, task.endDate!);
                    }}
                  />
                </div>
              );
            })}

            {/* Tasks without dates — empty state */}
            {tasks.filter(tk => !tk.startDate || !(tk.endDate || tk.dueDate)).length > 0 && (
              <div
                className="absolute bottom-2 left-4 text-xs text-muted-foreground/60 flex items-center gap-1"
                style={{ zIndex: 5 }}
              >
                <Clock className="w-3 h-3" />
                {tasks.filter(tk => !tk.startDate || !(tk.endDate || tk.dueDate)).length} {t('tasksNoDateSet') || '일정 미설정'}
              </div>
            )}
          </div>
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ── Timeline View ──────────────────────────────────────────

function TimelineView({
  groups,
  tasks,
  users,
  t,
  onUpdateTask,
}: {
  groups: BoardGroup[];
  tasks: BoardTask[];
  users: User[];
  t: (k: string) => string;
  onUpdateTask: (taskId: string, updates: Record<string, unknown>) => void;
}) {
  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);
  const groupColorMap = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach(g => map.set(g.id, g.color));
    return map;
  }, [groups]);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Build 21-day range centered around today
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = -7; i <= 13; i++) {
      result.push(addDays(today, i));
    }
    return result;
  }, []);

  const totalDays = days.length;
  const rangeStart = days[0];

  // Group tasks by swim lane (group)
  const getGroupTasks = useCallback((groupId: string) => {
    return tasks.filter(tk => tk.boardGroupId === groupId).sort((a, b) => a.orderNo - b.orderNo);
  }, [tasks]);

  // 3-dot menu state
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <ScrollArea className="w-full h-full">
      <div className="min-w-[800px] relative">
        {/* Date header */}
        <div className="flex border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
          {days.map((d, i) => {
            const isToday = format(d, 'yyyy-MM-dd') === todayStr;
            const dayName = format(d, 'EEE');
            const dayNum = format(d, 'd');
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={i}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center py-2 text-xs border-r border-border/20',
                  isWeekend && 'text-muted-foreground/60',
                )}
                style={{ width: `${100 / totalDays}%`, minWidth: 48 }}
              >
                <span className={cn('text-xs font-medium uppercase', isToday ? 'text-primary font-bold' : 'text-muted-foreground')}>
                  {dayName}
                </span>
                <span className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium mt-0.5',
                  isToday && 'bg-primary text-primary-foreground',
                )}>
                  {dayNum}
                </span>
              </div>
            );
          })}
        </div>

        {/* Today vertical dashed line */}
        {(() => {
          const todayIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === todayStr);
          if (todayIdx >= 0) {
            const pct = ((todayIdx + 0.5) / totalDays) * 100;
            return (
              <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${pct}%` }}>
                <div className="w-px h-full border-l-2 border-dashed border-primary/40" />
              </div>
            );
          }
          return null;
        })()}

        {/* Task cards by group */}
        {groups.map(group => {
          const groupTasks = getGroupTasks(group.id);
          const groupColor = groupColorMap.get(group.id) || '#666';

          return (
            <div key={group.id} className="relative">
              {/* Group label */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-b border-border/30">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: groupColor }} />
                <span className="text-xs font-semibold" style={{ color: groupColor }}>{group.title}</span>
                <span className="text-xs font-medium text-muted-foreground">{groupTasks.length}</span>
              </div>

              {/* Task rows */}
              <div className="relative" style={{ minHeight: groupTasks.length > 0 ? undefined : 40 }}>
                {/* Grid background */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {days.map((d, i) => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={cn('flex-shrink-0 border-r border-border/10', isWeekend && 'bg-muted/10')}
                        style={{ width: `${100 / totalDays}%`, minWidth: 48 }}
                      />
                    );
                  })}
                </div>

                {groupTasks.map((task) => {
                  const hasDateRange = task.startDate && task.endDate;
                  if (!hasDateRange) return null;

                  const start = parseISO(task.startDate!);
                  const end = parseISO(task.endDate!);
                  const startDayOffset = differenceInDays(start, rangeStart);
                  const durationDays = Math.max(1, differenceInDays(end, start) + 1);

                  // Clamp to visible range
                  const visibleStart = Math.max(0, startDayOffset);
                  const visibleEnd = Math.min(totalDays, startDayOffset + durationDays);
                  if (visibleEnd <= 0 || visibleStart >= totalDays) return null;

                  const leftPct = (visibleStart / totalDays) * 100;
                  const widthPct = ((visibleEnd - visibleStart) / totalDays) * 100;

                  // Get owners
                  const ownerIds = task.reviewerIds?.length
                    ? [task.ownerId, ...task.reviewerIds]
                    : [task.ownerId];
                  const owners = ownerIds.map(id => userMap.get(id)).filter(Boolean) as User[];

                  return (
                    <div key={task.id} className="relative h-[72px]">
                      <div
                        className="absolute top-2 bottom-2 rounded-xl bg-card/80 backdrop-blur-sm border border-border/40 shadow-sm hover:shadow-md hover:bg-card/95 transition-all overflow-hidden flex"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.min(widthPct, 100 - leftPct)}%`,
                          minWidth: 140,
                        }}
                      >
                        {/* Left color bar */}
                        <div className="w-[3px] flex-shrink-0 rounded-l-xl" style={{ backgroundColor: groupColor }} />

                        {/* Card content */}
                        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 min-w-0">
                          {/* Stacked avatars */}
                          <div className="flex -space-x-1.5 flex-shrink-0">
                            {owners.slice(0, 3).map(u => (
                              <Avatar key={u.id} className="w-6 h-6 text-[8px] border-2 border-card">
                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                  {u.name.slice(-2)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          </div>

                          {/* Title + description */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate">{task.title}</div>
                            <div className="text-xs font-medium text-muted-foreground truncate">
                              {task.startDate && task.endDate
                                ? `${format(parseISO(task.startDate), 'M/d')} - ${format(parseISO(task.endDate), 'M/d')}`
                                : ''}
                              {task.progress > 0 && task.progress < 100 && ` · ${task.progress}%`}
                            </div>
                          </div>

                          {/* Status dot */}
                          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_CONFIG[task.status].bg)} />

                          {/* 3-dot menu */}
                          <div className="relative flex-shrink-0">
                            <button
                              onClick={() => setMenuOpen(menuOpen === task.id ? null : task.id)}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                            {menuOpen === task.id && (
                              <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 min-w-[120px] py-1">
                                {ALL_STATUSES.map(s => {
                                  const sc = STATUS_CONFIG[s];
                                  return (
                                    <button
                                      key={s}
                                      onClick={() => {
                                        const updates: Record<string, unknown> = { status: s };
                                        if (s === 'done') updates.progress = 100;
                                        onUpdateTask(task.id, updates);
                                        setMenuOpen(null);
                                      }}
                                      className={cn(
                                        'w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left',
                                        s === task.status && 'bg-accent',
                                      )}
                                    >
                                      <span className={cn('w-2.5 h-2.5 rounded-sm', sc.bg)} />
                                      {t(sc.labelKey)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {groupTasks.filter(tk => !tk.startDate || !(tk.endDate || tk.dueDate)).length > 0 && (
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground/60">
                    + {groupTasks.filter(tk => !tk.startDate || !(tk.endDate || tk.dueDate)).length} {t('tasksNoDateSet') || 'no date set'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

// ── Add Group Dialog ──────────────────────────────────────

function AddGroupInline({ onAdd, t }: { onAdd: (title: string, color: string) => void; t?: (k: string) => string }) {
  const [title, setTitle] = useState('');
  const [show, setShow] = useState(false);
  // Bojagi (색동 보자기) palette — Korean traditional colors
  const colors = ['#D4A843', '#2B4EC7', '#E8368F', '#1DA06A', '#7B2D8E', '#F0A830', '#F4C4D0'];
  const [color, setColor] = useState(colors[0]);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{t?.('addGroup') || '그룹 추가'}</span>
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
        placeholder={t('groupName')}
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
    projects,
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

  // Get the project for default date info
  const project = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

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
    () => boardTasks.filter(tk => tk.projectId === projectId),
    [boardTasks, projectId],
  );

  // Project team members for owner selection
  const projectUsers = useMemo(() => {
    if (project?.teamMemberIds?.length) {
      return users.filter(u => project.teamMemberIds!.includes(u.id));
    }
    return users;
  }, [users, project]);

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

    // Default startDate = today, default dueDate = project endDate
    const today = new Date().toISOString().slice(0, 10);
    const projectEndDate = project?.endDate
      ? new Date(project.endDate).toISOString().slice(0, 10)
      : undefined;

    addBoardTask({
      boardGroupId: newTaskGroupId,
      projectId,
      title: newTaskTitle.trim(),
      ownerId: currentUser.id,
      startDate: today,
      endDate: projectEndDate || addDays(new Date(), 7).toISOString().slice(0, 10),
      dueDate: projectEndDate,
    });

    setNewTaskGroupId(null);
    setNewTaskTitle('');
    toast.success(t('todoCreated') || '작업이 추가되었습니다');
  }, [newTaskTitle, newTaskGroupId, projectId, currentUser, project, addBoardTask, t]);

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
            onUpdateTask={handleUpdateTask}
          />
        )}
      </div>

      {/* Add group button */}
      <div className="shrink-0 border-t border-border">
        <AddGroupInline onAdd={handleAddGroup} t={t} />
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
