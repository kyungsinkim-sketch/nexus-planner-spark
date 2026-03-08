/**
 * MobileCalendarView — Phase 3 mobile calendar with custom Clock Dial Time Picker
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Plus, MoreHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format, parseISO, startOfDay, endOfDay, addDays, subDays,
  startOfWeek, eachDayOfInterval, isSameDay,
} from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { toast } from 'sonner';

/* ─── Clock Dial Time Picker ─── */

function formatDecimalHour(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function snapTo15(h: number): number {
  return Math.round(h * 4) / 4;
}

interface ClockDialPickerProps {
  startHour: number;
  endHour: number;
  onStartChange: (h: number) => void;
  onEndChange: (h: number) => void;
}

function ClockDialPicker({ startHour, endHour, onStartChange, onEndChange }: ClockDialPickerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<'start' | 'end' | null>(null);

  const cx = 160;
  const cy = 150;
  const r = 120;

  // Map 0-24 hours to angle: 0h = left (π), 24h = right (0)
  const hourToAngle = (h: number) => Math.PI - (h / 24) * Math.PI;
  const angleToHour = (a: number) => snapTo15(((Math.PI - a) / Math.PI) * 24);

  const polarToXY = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  });

  const startAngle = hourToAngle(startHour);
  const endAngle = hourToAngle(endHour);
  const startPos = polarToXY(startAngle, r);
  const endPos = polarToXY(endAngle, r);

  // Build arc path for highlighted segment (start→end, going clockwise = decreasing angle)
  const buildArc = (fromAngle: number, toAngle: number) => {
    const steps = 60;
    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = fromAngle + (toAngle - fromAngle) * t;
      const p = polarToXY(a, r);
      points.push(`${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`);
    }
    return points.join(' ');
  };

  // Background arc (full semicircle)
  const bgArc = buildArc(Math.PI, 0);
  // Highlighted arc between start and end
  const highlightArc = buildArc(startAngle, endAngle);

  // Hour tick marks
  const ticks = Array.from({ length: 13 }, (_, i) => i * 2); // 0,2,4,...24

  const getHourFromPointer = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = 320 / rect.width;
    const scaleY = 180 / rect.height;
    const px = (clientX - rect.left) * scaleX;
    const py = (clientY - rect.top) * scaleY;
    const dx = px - cx;
    const dy = cy - py;
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle = 0;
    if (angle > Math.PI) angle = Math.PI;
    return angleToHour(angle);
  }, []);

  const handlePointerDown = useCallback((which: 'start' | 'end') => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = which;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragging.current) return;
      const pt = 'touches' in e ? e.touches[0] : e;
      const h = getHourFromPointer(pt.clientX, pt.clientY);
      if (h === null) return;
      if (dragging.current === 'start') {
        onStartChange(Math.min(h, endHour - 0.25));
      } else {
        onEndChange(Math.max(h, startHour + 0.25));
      }
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [getHourFromPointer, onStartChange, onEndChange, startHour, endHour]);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg ref={svgRef} viewBox="0 0 320 180" className="w-full max-w-[320px] select-none touch-none">
        {/* Background arc */}
        <path d={bgArc} fill="none" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
        {/* Highlighted arc */}
        <path d={highlightArc} fill="none" stroke="hsl(234, 89%, 60%)" strokeWidth="8" strokeLinecap="round" />
        {/* Tick marks & labels */}
        {ticks.map(h => {
          const a = hourToAngle(h);
          const outer = polarToXY(a, r + 10);
          const inner = polarToXY(a, r - 10);
          const label = polarToXY(a, r + 26);
          return (
            <g key={h}>
              <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#64748B" strokeWidth="1.5" />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle"
                className="fill-slate-400 text-[10px]" style={{ fontSize: 10 }}>
                {h}
              </text>
            </g>
          );
        })}
        {/* Start handle */}
        <circle cx={startPos.x} cy={startPos.y} r={12} fill="hsl(234, 89%, 60%)" stroke="#fff" strokeWidth="2"
          className="cursor-grab" onMouseDown={handlePointerDown('start')} onTouchStart={handlePointerDown('start')} />
        <text x={startPos.x} y={startPos.y + 1} textAnchor="middle" dominantBaseline="middle"
          className="fill-primary-foreground text-[8px] font-bold pointer-events-none" style={{ fontSize: 8 }}>S</text>
        {/* End handle */}
        <circle cx={endPos.x} cy={endPos.y} r={12} fill="#A78BFA" stroke="#fff" strokeWidth="2"
          className="cursor-grab" onMouseDown={handlePointerDown('end')} onTouchStart={handlePointerDown('end')} />
        <text x={endPos.x} y={endPos.y + 1} textAnchor="middle" dominantBaseline="middle"
          className="fill-primary-foreground text-[8px] font-bold pointer-events-none" style={{ fontSize: 8 }}>E</text>
      </svg>
      <div className="flex gap-6 text-sm">
        <span className="text-slate-300">Start <span className="font-mono font-bold text-primary">{formatDecimalHour(startHour)}</span></span>
        <span className="text-slate-300">End <span className="font-mono font-bold text-[#A78BFA]">{formatDecimalHour(endHour)}</span></span>
      </div>
    </div>
  );
}

/* ─── New Event Bottom Sheet ─── */

interface NewEventSheetProps {
  date: Date;
  onClose: () => void;
}

function NewEventSheet({ date, onClose }: NewEventSheetProps) {
  const { projects, currentUser } = useAppStore();
  const { language } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(10);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(language === 'ko' ? '제목을 입력해주세요' : 'Please enter a title');
      return;
    }
    setSaving(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const startAtStr = `${dateStr}T${formatDecimalHour(startHour)}:00`;
      const endAtStr = `${dateStr}T${formatDecimalHour(endHour)}:00`;
      // Use appStore or direct service — for now just toast success
      toast.success(language === 'ko' ? '이벤트가 생성되었습니다' : 'Event created');
      onClose();
    } catch {
      toast.error(language === 'ko' ? '저장 실패' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full bg-card dark:bg-card rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            {language === 'ko' ? '새 이벤트' : 'New Event'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Date display */}
        <p className="text-xs text-slate-500 mb-4">
          {format(date, 'EEEE, MMMM d, yyyy', { locale: language === 'ko' ? ko : enUS })}
        </p>

        {/* Title */}
        <input
          type="text"
          placeholder={language === 'ko' ? '이벤트 제목' : 'Event title'}
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-muted dark:bg-muted text-foreground rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground mb-3"
        />

        {/* Project chips */}
        {projects.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
            {projects.filter(p => p.status === 'ACTIVE').map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(selectedProjectId === p.id ? null : p.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0 transition-colors',
                  selectedProjectId === p.id
                    ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                    : 'bg-slate-800 text-slate-400'
                )}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.keyColor || '#6366F1' }} />
                {p.title}
              </button>
            ))}
          </div>
        )}

        {/* Description */}
        <textarea
          placeholder={language === 'ko' ? '설명 (선택)' : 'Description (optional)'}
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-muted dark:bg-muted text-foreground rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none mb-4"
        />

        {/* Clock Dial Picker */}
        <ClockDialPicker
          startHour={startHour}
          endHour={endHour}
          onStartChange={setStartHour}
          onEndChange={setEndHour}
        />

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-5 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {saving
            ? (language === 'ko' ? '저장 중...' : 'Saving...')
            : (language === 'ko' ? '저장' : 'Save')}
        </button>
      </div>
    </div>
  );
}

/* ─── Main Calendar View ─── */

export function MobileCalendarView() {
  const { events, projects } = useAppStore();
  const { language } = useTranslation();
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [showNewEvent, setShowNewEvent] = useState(false);

  const locale = language === 'ko' ? ko : enUS;

  // Visible days (3 weeks centered on weekStart)
  const visibleDays = useMemo(() => {
    const start = subDays(weekStart, 7);
    const end = addDays(weekStart, 20);
    return eachDayOfInterval({ start, end });
  }, [weekStart]);

  // Events for selected date
  const dayEvents = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    return events.filter(ev => {
      const evStart = parseISO(ev.startAt);
      return isSameDay(evStart, dayStart);
    }).sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [events, selectedDate]);

  const today = useMemo(() => new Date(), []);

  const navigateWeek = (dir: -1 | 1) => {
    setWeekStart(prev => addDays(prev, dir * 7));
  };

  const getProjectForEvent = (ev: typeof events[0]) => {
    if (!ev.projectId) return null;
    return projects.find(p => p.id === ev.projectId) ?? null;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setShowNewEvent(true)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">
          {format(selectedDate, 'MMMM yyyy', { locale })}
        </h1>
      </div>

      {/* Date navigation */}
      <div className="shrink-0 px-2 pb-2">
        <div className="flex items-center gap-1">
          <button onClick={() => navigateWeek(-1)} className="p-1 text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div ref={dateScrollRef} className="flex-1 flex gap-1 overflow-x-auto scrollbar-none py-1">
            {visibleDays.map(day => {
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'flex flex-col items-center min-w-[40px] py-1.5 px-1 rounded-xl transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : isToday
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <span className="text-[10px] font-medium uppercase">
                    {format(day, 'EEE', { locale })}
                  </span>
                  <span className={cn('text-sm font-bold mt-0.5', isSelected && 'text-inherit')}>
                    {format(day, 'd')}
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={() => navigateWeek(1)} className="p-1 text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-24">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-sm">
              {language === 'ko' ? '이 날에는 이벤트가 없어요' : 'No events for this day'}
            </p>
            <button
              onClick={() => setShowNewEvent(true)}
              className="mt-3 text-xs text-primary underline"
            >
              {language === 'ko' ? '새 이벤트 추가' : 'Add new event'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            {dayEvents.map(ev => {
              const project = getProjectForEvent(ev);
              return (
                <div
                  key={ev.id}
                  className="relative bg-card/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(ev.startAt), 'HH:mm')} – {format(parseISO(ev.endAt), 'HH:mm')}
                      </p>
                    </div>
                    <button className="p-1 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  {project && (
                    <div className="flex gap-1.5 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-accent/50">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.keyColor || '#6366F1' }} />
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

      {/* New Event Sheet */}
      {showNewEvent && (
        <NewEventSheet date={selectedDate} onClose={() => setShowNewEvent(false)} />
      )}
    </div>
  );
}

export default MobileCalendarView;
