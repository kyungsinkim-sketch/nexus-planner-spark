/**
 * TodayDateWidget — Displays today's date in an Apple Calendar-inspired dark card.
 * Shows day of week, large date number, and month/year.
 * Matches the todayWeather widget size (minW:1, minH:2, defaultW:2, defaultH:2).
 */

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { WidgetDataContext } from '@/types/widget';

function TodayDateWidget({ context: _context }: { context: WidgetDataContext }) {
  const { language } = useTranslation();
  const [now, setNow] = useState(new Date());

  // Update every minute to keep the date fresh (handles midnight rollover)
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const dayOfWeek = new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
    weekday: 'long',
  }).format(now);

  const dateNumber = now.getDate();

  const monthYear = new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(now);

  return (
    <div className="h-full flex flex-col items-center justify-center widget-dark-card date-gradient-bg p-4 select-none">
      {/* Day of week — red accent like Apple Calendar */}
      <p className="text-sm font-bold tracking-wider uppercase text-red-400">
        {dayOfWeek}
      </p>

      {/* Large date number */}
      <span className="text-6xl font-extralight text-white tabular-nums leading-none mt-1">
        {dateNumber}
      </span>

      {/* Month + Year */}
      <p className="text-sm text-white/60 mt-2">
        {monthYear}
      </p>
    </div>
  );
}

export default TodayDateWidget;
