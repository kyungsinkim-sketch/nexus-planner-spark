/**
 * WeatherWidget — Shows a 7-day weather forecast.
 * Uses mock data (no API key required).
 * Seoul-based winter weather for demo.
 */

import { useMemo } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudSun, CloudDrizzle, Wind } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { WidgetDataContext } from '@/types/widget';
import type { LucideIcon } from 'lucide-react';

type WeatherCondition = 'sunny' | 'partlyCloudy' | 'cloudy' | 'rainy' | 'drizzle' | 'snowy' | 'windy';

interface DayForecast {
  dayOffset: number;
  condition: WeatherCondition;
  high: number;
  low: number;
}

// Mock 7-day forecast (Seoul winter)
const MOCK_FORECAST: DayForecast[] = [
  { dayOffset: 0, condition: 'partlyCloudy', high: 3, low: -4 },
  { dayOffset: 1, condition: 'sunny', high: 5, low: -2 },
  { dayOffset: 2, condition: 'cloudy', high: 2, low: -3 },
  { dayOffset: 3, condition: 'snowy', high: 0, low: -7 },
  { dayOffset: 4, condition: 'cloudy', high: 1, low: -5 },
  { dayOffset: 5, condition: 'rainy', high: 6, low: 1 },
  { dayOffset: 6, condition: 'sunny', high: 8, low: 0 },
];

const CONDITION_ICONS: Record<WeatherCondition, LucideIcon> = {
  sunny: Sun,
  partlyCloudy: CloudSun,
  cloudy: Cloud,
  rainy: CloudRain,
  drizzle: CloudDrizzle,
  snowy: CloudSnow,
  windy: Wind,
};

const CONDITION_COLORS: Record<WeatherCondition, string> = {
  sunny: 'text-amber-400',
  partlyCloudy: 'text-amber-300',
  cloudy: 'text-gray-400',
  rainy: 'text-blue-400',
  drizzle: 'text-blue-300',
  snowy: 'text-sky-200',
  windy: 'text-teal-400',
};

function WeatherWidget({ context: _context }: { context: WidgetDataContext }) {
  const { t, language } = useTranslation();

  const days = useMemo(() => {
    const today = new Date();
    return MOCK_FORECAST.map((f) => {
      const date = new Date(today);
      date.setDate(date.getDate() + f.dayOffset);
      const dayName =
        f.dayOffset === 0
          ? t('today')
          : new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
              weekday: 'short',
            }).format(date);
      return { ...f, dayName };
    });
  }, [t, language]);

  return (
    <div className="grid grid-cols-7 gap-0.5 h-full items-center px-1">
      {days.map((day) => {
        const Icon = CONDITION_ICONS[day.condition];
        const isToday = day.dayOffset === 0;
        return (
          <div
            key={day.dayOffset}
            className={`text-center py-1 rounded-lg transition-colors ${
              isToday ? 'bg-primary/10' : ''
            }`}
          >
            <p
              className={`text-xs font-medium ${
                isToday ? 'text-primary' : 'text-foreground/70'
              }`}
            >
              {day.dayName}
            </p>
            <Icon
              className={`w-5 h-5 mx-auto my-1 ${CONDITION_COLORS[day.condition]}`}
            />
            <p className="text-xs font-semibold text-foreground">{day.high}°</p>
            <p className="text-[10px] text-muted-foreground">{day.low}°</p>
          </div>
        );
      })}
    </div>
  );
}

export default WeatherWidget;
