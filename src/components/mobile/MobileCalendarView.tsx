/**
 * MobileCalendarView — Phase 3 Calendar tab
 *
 * Layout reference (file_52):
 * - Top: + button (left) + Month/Year (right)
 * - Horizontal scrollable date strip (7 days visible, selected = rounded pill)
 * - Event list: Liquid Glass rounded-2xl cards with title, time, project tags
 * - New event: dark bottom sheet with Clock Dial time picker
 *
 * Colors/styles follow PC web design system (Liquid Glass, primary, bg-background)
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Plus, MoreHorizontal, X, Clock } from 'lucide-react';
import {
  format, parseISO, startOfDay, endOfDay, addDays, subDays,
  startOfWeek, eachDayOfInterval, isSameDay,
} from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

// ════════════════════════════════════════
// Clock Dial Time Picker
// ════════════════════════════════════════

function formatHour(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function snap15(h: number): number {
  return Math.round(h * 4) / 4;
}

function ClockDialPicker({
  startHour,
  endHour,
  onStartChange,
  onEndChange,
}: {
  startHour: number;
  endHour: number;
  onStartChange: (h: number) => void;
  onEndChange: (h: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<'start' | 'end' | null>(null);

  const cx = 160;
  const cy = 155;
  const r = 115;

  // 0h = left (π), 24h = right (0)
  const h2a = (h: number) => Math.PI - (h / 24) * Math.PI;
  const a2h = (a: number) => snap15(((Math.PI - a) / Math.PI) * 24);
  const polar = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  });

  const arc = (from: number, to: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const a = from + ((to - from) * i) / 60;
      const p = polar(a, r);
      pts.push(`${i === 0 ? 'M' : 'L'}${p.x},${p.y}`);
    }
    return pts.join(' ');
  };

  const bgArc = arc(Math.PI, 0);
  const hlArc = arc(h2a(startHour), h2a(endHour));
  const sp = polar(h2a(startHour), r);
  const ep = polar(h2a(endHour), r);

  const ticks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

  const getHour = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = 320 / rect.width;
    const sy = 180 / rect.height;
    const px = (clientX - rect.left) * sx;
    const py = (clientY - rect.top) * sy;
    let a = Math.atan2(cy - py, px - cx);
    if (a < 0) a = 0;
    if (a > Math.PI) a = Math.PI;
    return a2h(a);
  }, []);

  const onDown = useCallback((which: 'start' | 'end') => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = which;
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const pt = 'touches' in e ? e.touches[0] : e;
      const h = getHour(pt.clientX, pt.clientY);
      if (h === null) return;
      if (dragging.current === 'start') onStartChange(Math.min(h, endHour - 0.25));
      else onEndChange(Math.max(h, startHour + 0.25));
    };
    const up = () => { dragging.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [getHour, onStartChange, onEndChange, startHour, endHour]);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <svg ref={svgRef} viewBox="0 0 320 180" className="w-full max-w-[300px] select-none touch-none">
        {/* Background arc */}
        <path d={bgArc} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" strokeLinecap="round" />
        {/* Highlighted range */}
        <path d={hlArc} fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" />

        {/* Fine tick marks along the arc */}
        {Array.from({ length: 49 }, (_, i) => i * 0.5).map((h) => {
          const a = h2a(h);
          const o = polar(a, r + 6);
          const inner = polar(a, r - 6);
          const isMajor = h % 2 === 0;
          return (
            <line
              key={h}
              x1={inner.x} y1={inner.y} x2={o.x} y2={o.y}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={isMajor ? 1.5 : 0.5}
              opacity={isMajor ? 0.5 : 0.2}
            />
          );
        })}

        {/* Hour labels */}
        {ticks.map((h) => {
          const lbl = polar(h2a(h), r + 22);
          return (
            <text
              key={h}
              x={lbl.x}
              y={lbl.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="hsl(var(--muted-foreground))"
              style={{ fontSize: 9, fontWeight: 500 }}
            >
              {String(h).padStart(2, '0')}
            </text>
          );
        })}

        {/* Center pivot */}
        <circle cx={cx} cy={cy + 8} r={8} fill="hsl(var(--muted))" />

        {/* Start handle */}
        <circle
          cx={sp.x} cy={sp.y} r={11}
          fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5"
          className="cursor-grab active:cursor-grabbing"
          onMouseDown={onDown('start')} onTouchStart={onDown('start')}
        />
        {/* End handle */}
        <circle
          cx={ep.x} cy={ep.y} r={11}
          fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" strokeWidth="2.5"
          className="cursor-grab active:cursor-grabbing"
          onMouseDown={onDown('end')} onTouchStart={onDown('end')}
        />
      </svg>

      {/* Start / End display */}
      <div className="flex items-center justify-between w-full max-w-[280px]">
        <div className="text-center">
          <p className="typo-caption text-muted-foreground uppercase tracking-wide">Start</p>
          <p className="text-2xl font-bold text-foreground font-mono mt-0.5">{formatHour(startHour)}</p>
        </div>
        <div className="text-center">
          <p className="typo-caption text-muted-foreground uppercase tracking-wide">End</p>
          <p className="text-2xl font-bold text-foreground font-mono mt-0.5">{formatHour(endHour)}</p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// Event Bottom Sheet (Create + View/Edit)
// ════════════════════════════════════════

function dateToHour(iso: string): number {
  try {
    const d = parseISO(iso);
    return snap15(d.getHours() + d.getMinutes() / 60);
  } catch { return 9; }
}

import type { CalendarEvent } from '@/types/core';

function EventSheet({
  date,
  event,
  onClose,
}: {
  date: Date;
  event?: CalendarEvent | null;
  onClose: () => void;
}) {
  const { projects, currentUser, updateEvent, deleteEvent } = useAppStore();
  const { language } = useTranslation();
  const isEdit = !!event;

  const [title, setTitle] = useState(event?.title || '');
  const [desc, setDesc] = useState((event as any)?.description || '');
  const [projId, setProjId] = useState<string | null>(event?.projectId || null);
  const [startH, setStartH] = useState(event ? dateToHour(event.startAt) : 9);
  const [endH, setEndH] = useState(event ? dateToHour(event.endAt) : 10);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const locale = language === 'ko' ? ko : enUS;

  const buildDatetime = (h: number) => {
    const d = new Date(date);
    d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
    return d.toISOString();
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(language === 'ko' ? '제목을 입력해주세요' : 'Enter a title');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && event) {
        await updateEvent(event.id, {
          title: title.trim(),
          startAt: buildDatetime(startH),
          endAt: buildDatetime(endH),
          projectId: projId || undefined,
        });
        toast.success(language === 'ko' ? '일정이 수정되었습니다' : 'Event updated');
      } else {
        // Create — currently placeholder (same as before)
        toast.success(language === 'ko' ? '일정이 생성되었습니다' : 'Event created');
      }
      onClose();
    } catch {
      toast.error(language === 'ko' ? '저장 실패' : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    setDeleting(true);
    try {
      await deleteEvent(event.id);
      toast.success(language === 'ko' ? '일정이 삭제되었습니다' : 'Event deleted');
      onClose();
    } catch {
      toast.error(language === 'ko' ? '삭제 실패' : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full bg-card rounded-t-3xl p-5 pb-24 max-h-[85vh] overflow-y-auto border-t border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="typo-h3 font-semibold">
            {isEdit
              ? (language === 'ko' ? '일정 상세' : 'Event Detail')
              : (language === 'ko' ? '새 일정' : 'New Event')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <p className="typo-caption text-muted-foreground mb-4">
          {format(date, language === 'ko' ? 'yyyy년 M월 d일 EEEE' : 'EEEE, MMMM d, yyyy', { locale })}
        </p>

        {/* Title input */}
        <input
          type="text"
          placeholder={language === 'ko' ? '일정 제목' : 'Event title'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-muted rounded-xl px-4 py-3 typo-body outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground mb-3"
        />

        {/* Project chips */}
        {projects.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
            {projects.filter((p) => p.status === 'ACTIVE').slice(0, 8).map((p) => (
              <button
                key={p.id}
                onClick={() => setProjId(projId === p.id ? null : p.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full typo-caption whitespace-nowrap shrink-0 transition-colors border',
                  projId === p.id
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-muted text-muted-foreground border-transparent',
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.keyColor || 'hsl(var(--primary))' }} />
                {p.title}
              </button>
            ))}
          </div>
        )}

        {/* Description */}
        <textarea
          placeholder={language === 'ko' ? '설명 (선택)' : 'Description (optional)'}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          className="w-full bg-muted rounded-xl px-4 py-3 typo-body outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground resize-none mb-4"
        />

        {/* Clock Dial */}
        <ClockDialPicker startHour={startH} endHour={endH} onStartChange={setStartH} onEndChange={setEndH} />

        {/* Action buttons */}
        <div className="flex gap-3 mt-4">
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="flex-1 py-3 rounded-2xl border border-destructive/30 text-destructive font-semibold typo-body disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {deleting ? (language === 'ko' ? '삭제 중...' : 'Deleting...') : (language === 'ko' ? '삭제' : 'Delete')}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || deleting}
            className={cn(
              'py-3 rounded-2xl bg-primary text-primary-foreground font-semibold typo-body disabled:opacity-50 active:scale-[0.98] transition-transform',
              isEdit ? 'flex-1' : 'w-full',
            )}
          >
            {saving
              ? (language === 'ko' ? '저장 중...' : 'Saving...')
              : isEdit
                ? (language === 'ko' ? '수정' : 'Update')
                : (language === 'ko' ? '저장' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// Main Calendar View
// ════════════════════════════════════════

export function MobileCalendarView() {
  const { events, projects } = useAppStore();
  const { language } = useTranslation();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [showSheet, setShowSheet] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const locale = language === 'ko' ? ko : enUS;
  const today = useMemo(() => new Date(), []);

  // Show 3 weeks of days for horizontal scroll
  const visibleDays = useMemo(() => {
    return eachDayOfInterval({
      start: subDays(weekStart, 7),
      end: addDays(weekStart, 20),
    });
  }, [weekStart]);

  // Events for selected day
  const dayEvents = useMemo(() => {
    return events
      .filter((ev) => {
        try { return isSameDay(parseISO(ev.startAt), selectedDate); }
        catch { return false; }
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [events, selectedDate]);

  return (
    <div className="flex flex-col h-full widget-area-bg">
      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-5 pb-2">
        <div>
          <h1 className="typo-h3 font-bold text-foreground">
            {format(selectedDate, 'MMMM', { locale })}
          </h1>
          <p className="typo-caption text-muted-foreground">{format(selectedDate, 'yyyy')}</p>
        </div>
        <button
          onClick={() => { setEditingEvent(null); setShowSheet(true); }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Date strip ── */}
      <div className="shrink-0 px-2 py-2">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-none py-1">
          {visibleDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'flex flex-col items-center min-w-[42px] py-2 px-1 rounded-2xl transition-all',
                  isSelected
                    ? 'bg-foreground text-background'
                    : isToday
                      ? 'bg-primary/10'
                      : 'hover:bg-accent',
                )}
              >
                <span
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-wide',
                    isSelected ? 'text-background/70' : 'text-muted-foreground',
                  )}
                >
                  {format(day, 'EEE', { locale })}
                </span>
                <span
                  className={cn(
                    'text-base font-bold mt-0.5',
                    isSelected ? 'text-background' : isToday ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Event list ── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-24">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="typo-widget-sub text-muted-foreground">
              {language === 'ko' ? '이 날에는 일정이 없어요' : 'No events for this day'}
            </p>
            <button
              onClick={() => { setEditingEvent(null); setShowSheet(true); }}
              className="mt-3 typo-caption text-primary font-medium"
            >
              {language === 'ko' ? '+ 새 일정 추가' : '+ Add new event'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            {dayEvents.map((ev) => {
              const project = ev.projectId ? projects.find((p) => p.id === ev.projectId) : null;
              return (
                <div
                  key={ev.id}
                  onClick={() => { setEditingEvent(ev); setShowSheet(true); }}
                  className={cn(
                    'relative rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform',
                    'bg-white/60 dark:bg-white/5 backdrop-blur-xl',
                    'border border-white/20 dark:border-white/10',
                    'shadow-sm',
                  )}
                >
                  {/* Title + menu */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="typo-widget-body font-bold text-foreground">{ev.title}</h3>
                    <button className="p-1 -mr-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="typo-caption text-muted-foreground">
                      {format(parseISO(ev.startAt), 'HH:mm')} – {format(parseISO(ev.endAt), 'HH:mm')}
                    </span>
                  </div>

                  {/* Project tag */}
                  {project && (
                    <div className="flex gap-1.5 mt-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full typo-micro bg-accent/50 border border-border/50">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: project.keyColor || 'hsl(var(--primary))' }}
                        />
                        {project.title}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Event Sheet (create / view+edit) ── */}
      {showSheet && (
        <EventSheet
          date={selectedDate}
          event={editingEvent}
          onClose={() => { setShowSheet(false); setEditingEvent(null); }}
        />
      )}
    </div>
  );
}

export default MobileCalendarView;
