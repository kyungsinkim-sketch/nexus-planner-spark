/**
 * WorldClockWidget — Shows digital clocks for major world cities.
 * Updates every second via setInterval.
 * Uses Intl.DateTimeFormat for native timezone support.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import type { WidgetDataContext } from '@/types/widget';

interface CityTime {
  key: string;
  timezone: string;
  labelKo: string;
  labelEn: string;
  flag: string;
}

const CITIES: CityTime[] = [
  { key: 'seoul', timezone: 'Asia/Seoul', labelKo: '서울', labelEn: 'Seoul', flag: '🇰🇷' },
  { key: 'newyork', timezone: 'America/New_York', labelKo: '뉴욕', labelEn: 'New York', flag: '🇺🇸' },
  { key: 'london', timezone: 'Europe/London', labelKo: '런던', labelEn: 'London', flag: '🇬🇧' },
  { key: 'tokyo', timezone: 'Asia/Tokyo', labelKo: '도쿄', labelEn: 'Tokyo', flag: '🇯🇵' },
  { key: 'losangeles', timezone: 'America/Los_Angeles', labelKo: 'LA', labelEn: 'LA', flag: '🇺🇸' },
];

function WorldClockWidget({ context: _context }: { context: WidgetDataContext }) {
  const [now, setNow] = useState(new Date());
  const { language } = useTranslation();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (tz: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

  const formatDate = (tz: string) =>
    new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(now);

  return (
    <div className="grid grid-cols-5 gap-1 h-full items-center px-2">
      {CITIES.map((city) => {
        const label = language === 'ko' ? city.labelKo : city.labelEn;
        return (
          <div key={city.key} className="text-center">
            <p className="text-[11px] text-muted-foreground/70">{city.flag}</p>
            <p className="text-lg font-mono font-semibold text-foreground tabular-nums leading-tight">
              {formatTime(city.timezone)}
            </p>
            <p className="text-xs font-medium text-foreground/80 truncate">{label}</p>
            <p className="text-[10px] text-muted-foreground truncate">{formatDate(city.timezone)}</p>
          </div>
        );
      })}
    </div>
  );
}

export default WorldClockWidget;
