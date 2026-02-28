/**
 * CosmosCalendar — 시공간 유영 캘린더 (Vercel-minimal)
 *
 * 세로 타임라인, 흑백 기반, 이벤트 타입 컬러만 포인트
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  format, parseISO, startOfDay, addDays, subDays, isToday, isBefore,
} from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/core';

const EVENT_COLORS: Record<string, string> = {
  TASK: '#ffffff',
  DEADLINE: '#ef4444',
  MEETING: '#22c55e',
  PT: '#a78bfa',
  DELIVERY: '#f59e0b',
  DEFAULT: '#ffffff',
};

interface DayGroup {
  date: Date; dateStr: string; events: CalendarEvent[]; isToday: boolean; isPast: boolean;
}

export function CosmosCalendar() {
  const { events, projects } = useAppStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [centerDate] = useState(new Date());

  const dayGroups = useMemo(() => {
    const start = subDays(startOfDay(centerDate), 30);
    const days: DayGroup[] = [];
    for (let i = 0; i < 60; i++) {
      const date = addDays(start, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayStart = startOfDay(date);
      const dayEnd = addDays(dayStart, 1);
      const dayEvents = events.filter(e => {
        try {
          const eDate = parseISO(e.startAt);
          return eDate >= dayStart && eDate < dayEnd;
        } catch { return false; }
      }).sort((a, b) => a.startAt.localeCompare(b.startAt));
      days.push({ date, dateStr, events: dayEvents, isToday: isToday(date), isPast: isBefore(date, startOfDay(new Date())) });
    }
    return days;
  }, [events, centerDate]);

  useEffect(() => {
    setTimeout(() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }, []);

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 pt-14 pb-4 z-20"
        style={{ background: 'linear-gradient(to bottom, black 70%, transparent)' }}>
        <h1 className="text-lg font-bold text-white tracking-tight">
          {language === 'ko' ? '캘린더' : 'Calendar'}
        </h1>
        <p className="text-[11px] text-white/25 mt-0.5 font-mono">
          {format(centerDate, language === 'ko' ? 'yyyy.MM' : 'MMMM yyyy', { locale })}
        </p>
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        {/* Vertical line */}
        <div className="absolute left-8 top-0 bottom-0 w-px bg-white/[0.04]" />

        <div className="py-4">
          {dayGroups.map(day => {
            const hasEvents = day.events.length > 0;
            const show = day.isToday || hasEvents;

            return (
              <div
                key={day.dateStr}
                ref={day.isToday ? todayRef : undefined}
                className={cn('relative', show ? 'py-2' : 'py-0.5')}
              >
                {/* Dot on timeline */}
                <div className="absolute left-[29px] top-3 z-10">
                  <div className={cn(
                    'w-[7px] h-[7px] rounded-full',
                    day.isToday ? 'bg-white' : hasEvents ? 'bg-white/20' : 'bg-white/[0.04]',
                  )} />
                </div>

                {show && (
                  <div className="pl-14 pr-5">
                    {/* Date label */}
                    <p className={cn(
                      'text-[11px] font-medium mb-1.5',
                      day.isToday ? 'text-white' : 'text-white/30',
                    )}>
                      {day.isToday
                        ? (language === 'ko' ? '오늘' : 'Today')
                        : format(day.date, language === 'ko' ? 'M/d EEE' : 'EEE, MMM d', { locale })}
                    </p>

                    {/* Event cards */}
                    {day.events.map((event, idx) => {
                      const color = EVENT_COLORS[event.type || 'DEFAULT'] || EVENT_COLORS.DEFAULT;
                      const project = projects.find(p => p.id === event.projectId);
                      return (
                        <div key={event.id} className="mb-2 animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                          <div className="rounded-lg p-3 border border-white/[0.06] bg-white/[0.02]">
                            <div className="flex items-start gap-2.5">
                              <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[13px] font-medium text-white/80 truncate">{event.title}</p>
                                  <span className="text-[10px] text-white/20 font-mono shrink-0">
                                    {format(parseISO(event.startAt), 'HH:mm')}
                                  </span>
                                </div>
                                {project && (
                                  <p className="text-[10px] text-white/25 truncate mt-0.5">{project.title}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {day.isToday && day.events.length === 0 && (
                      <div className="rounded-lg p-3 border border-dashed border-white/[0.06]">
                        <p className="text-[12px] text-white/20 text-center">
                          {language === 'ko' ? '일정 없음' : 'No events'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Today button */}
      <button
        onClick={() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        className="absolute bottom-20 right-5 z-30 px-3 py-1.5 rounded-full text-[10px] font-medium bg-white text-black"
      >
        {language === 'ko' ? '오늘' : 'Today'}
      </button>
    </div>
  );
}

export default CosmosCalendar;
