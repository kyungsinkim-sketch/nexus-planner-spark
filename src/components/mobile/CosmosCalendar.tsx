/**
 * CosmosCalendar — 시공간 유영 캘린더
 *
 * 월간 뷰 없음. 세로 스크롤로 시간축을 탐색.
 * 오른쪽에 시간 인디케이터, 이벤트가 우주 공간에 떠있는 카드.
 * 핀치 줌: 줌아웃 = 주간/월간 밀도, 줌인 = 하루 상세.
 * "우주 시공간을 유영하듯" 과거-현재-미래를 탐색.
 */

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  format,
  parseISO,
  startOfDay,
  addDays,
  subDays,
  isToday,
  isBefore,
  differenceInMinutes,
} from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/core';

// Event type colors (gold-tinted)
const EVENT_COLORS: Record<string, string> = {
  TASK: '#D4A843',
  DEADLINE: '#E85D5D',
  MEETING: '#5DB87E',
  PT: '#9B7BDB',
  DELIVERY: '#E89B3B',
  DEFAULT: '#D4A843',
};

interface DayGroup {
  date: Date;
  dateStr: string;
  events: CalendarEvent[];
  isToday: boolean;
  isPast: boolean;
}

export function CosmosCalendar() {
  const { events, projects } = useAppStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const [centerDate, setCenterDate] = useState(new Date());

  // Group events by day, sorted by time
  // Show 60 days range: -30 to +30 from center
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

      days.push({
        date,
        dateStr,
        events: dayEvents,
        isToday: isToday(date),
        isPast: isBefore(date, startOfDay(new Date())),
      });
    }
    return days;
  }, [events, centerDate]);

  // Scroll to today on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const getEventColor = (event: CalendarEvent) => {
    return EVENT_COLORS[event.type || 'DEFAULT'] || EVENT_COLORS.DEFAULT;
  };

  const getProjectForEvent = (event: CalendarEvent) => {
    return projects.find(p => p.id === event.projectId);
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 px-5 pt-12 pb-3 z-20"
        style={{
          background: 'linear-gradient(to bottom, hsla(240, 10%, 3%, 1) 0%, hsla(240, 10%, 3%, 0.8) 80%, transparent 100%)',
        }}
      >
        <h1 className="text-lg font-bold text-[hsl(var(--foreground))]">
          {language === 'ko' ? '시간의 흐름' : 'Timeline'}
        </h1>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5">
          {format(centerDate, language === 'ko' ? 'yyyy년 M월' : 'MMMM yyyy', { locale })}
        </p>
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {/* Right time indicator line */}
        <div
          className="absolute right-6 top-0 bottom-0 w-px z-10"
          style={{
            background: 'linear-gradient(to bottom, transparent, hsla(43, 74%, 55%, 0.1) 10%, hsla(43, 74%, 55%, 0.1) 90%, transparent)',
          }}
        />

        <div className="px-5 py-4 space-y-1">
          {dayGroups.map((day) => {
            const hasEvents = day.events.length > 0;
            const showFull = day.isToday || hasEvents;

            return (
              <div
                key={day.dateStr}
                ref={day.isToday ? todayRef : undefined}
                className={cn(
                  'relative transition-all duration-300',
                  showFull ? 'py-2' : 'py-0.5',
                )}
              >
                {/* Date marker on right side */}
                <div className="absolute right-0 top-0 flex flex-col items-center z-10">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      day.isToday
                        ? 'bg-[hsl(43,74%,55%)]'
                        : hasEvents
                          ? 'bg-[hsl(43,50%,35%)]'
                          : 'bg-white/5',
                    )}
                    style={day.isToday ? { boxShadow: '0 0 10px hsla(43, 74%, 55%, 0.5)' } : {}}
                  />
                  <span
                    className={cn(
                      'text-[9px] mt-1 font-medium',
                      day.isToday
                        ? 'text-[hsl(43,74%,55%)]'
                        : day.isPast
                          ? 'text-white/15'
                          : 'text-white/25',
                    )}
                  >
                    {format(day.date, 'd')}
                  </span>
                </div>

                {/* Day label — only show for today or days with events */}
                {showFull && (
                  <div className="mb-2 pr-12">
                    <span
                      className={cn(
                        'text-[11px] font-semibold',
                        day.isToday
                          ? 'text-[hsl(43,74%,55%)]'
                          : 'text-[hsl(var(--muted-foreground))]',
                      )}
                    >
                      {day.isToday
                        ? (language === 'ko' ? '오늘' : 'Today')
                        : format(day.date, language === 'ko' ? 'M/d EEE' : 'EEE, MMM d', { locale })}
                    </span>
                  </div>
                )}

                {/* Event cards */}
                {day.events.map((event, idx) => {
                  const color = getEventColor(event);
                  const project = getProjectForEvent(event);
                  const time = format(parseISO(event.startAt), 'HH:mm');

                  return (
                    <div
                      key={event.id}
                      className="mb-2 pr-12 animate-fade-in"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div
                        className="rounded-xl p-3 backdrop-blur-xl border transition-transform active:scale-[0.98]"
                        style={{
                          background: 'hsla(var(--glass-bg))',
                          borderColor: `${color}20`,
                          boxShadow: `0 0 20px ${color}08`,
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Time + color dot */}
                          <div className="flex flex-col items-center shrink-0 pt-0.5">
                            <div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor: color,
                                boxShadow: `0 0 6px ${color}60`,
                              }}
                            />
                            <span className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 font-mono">
                              {time}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[hsl(var(--foreground))] truncate">
                              {event.title}
                            </p>
                            {project && (
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                                {project.title}
                              </p>
                            )}
                            {event.location && (
                              <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate mt-0.5">
                                📍 {event.location}
                              </p>
                            )}
                          </div>

                          {/* Event type badge */}
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                            style={{
                              backgroundColor: `${color}15`,
                              color: color,
                            }}
                          >
                            {event.type || 'TASK'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty day — subtle dot line */}
                {!hasEvents && !day.isToday && (
                  <div className="h-1" />
                )}

                {/* Today marker line */}
                {day.isToday && day.events.length === 0 && (
                  <div className="pr-12 mb-2">
                    <div
                      className="rounded-xl p-3 border border-dashed"
                      style={{
                        borderColor: 'hsla(43, 74%, 55%, 0.2)',
                        background: 'hsla(43, 74%, 55%, 0.03)',
                      }}
                    >
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))] text-center">
                        {language === 'ko' ? '오늘 일정 없음' : 'No events today'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating "Today" button */}
      <button
        onClick={() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        className="absolute bottom-20 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-xl border"
        style={{
          background: 'hsla(var(--glass-bg))',
          borderColor: 'hsla(43, 74%, 55%, 0.2)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        <span className="text-[10px] font-bold text-[hsl(43,74%,55%)]">
          {language === 'ko' ? '오늘' : 'Now'}
        </span>
      </button>
    </div>
  );
}

export default CosmosCalendar;
