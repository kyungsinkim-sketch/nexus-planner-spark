/**
 * WeatherWidget — Shows a 7-day weather forecast for a selected city.
 * Dark card design with gradient background (inspired by Apple widgets).
 */

import { useState, useMemo, useEffect } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudSun, CloudDrizzle, Wind } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { WidgetDataContext } from '@/types/widget';
import type { LucideIcon } from 'lucide-react';

type WeatherCondition = 'sunny' | 'partlyCloudy' | 'cloudy' | 'rainy' | 'drizzle' | 'snowy' | 'windy';

interface CityWeatherDef {
  key: string;
  labelKo: string;
  labelEn: string;
  flag: string;
  lat: number;
}

const WEATHER_CITIES: CityWeatherDef[] = [
  { key: 'seoul',       labelKo: '서울',       labelEn: 'Seoul',        flag: '🇰🇷', lat: 37.5 },
  { key: 'tokyo',       labelKo: '도쿄',       labelEn: 'Tokyo',        flag: '🇯🇵', lat: 35.7 },
  { key: 'beijing',     labelKo: '베이징',     labelEn: 'Beijing',      flag: '🇨🇳', lat: 39.9 },
  { key: 'bangkok',     labelKo: '방콕',       labelEn: 'Bangkok',      flag: '🇹🇭', lat: 13.8 },
  { key: 'newdelhi',    labelKo: '뉴델리',     labelEn: 'New Delhi',    flag: '🇮🇳', lat: 28.6 },
  { key: 'dubai',       labelKo: '두바이',     labelEn: 'Dubai',        flag: '🇦🇪', lat: 25.3 },
  { key: 'london',      labelKo: '런던',       labelEn: 'London',       flag: '🇬🇧', lat: 51.5 },
  { key: 'paris',       labelKo: '파리',       labelEn: 'Paris',        flag: '🇫🇷', lat: 48.9 },
  { key: 'berlin',      labelKo: '베를린',     labelEn: 'Berlin',       flag: '🇩🇪', lat: 52.5 },
  { key: 'newyork',     labelKo: '뉴욕',       labelEn: 'New York',     flag: '🇺🇸', lat: 40.7 },
  { key: 'losangeles',  labelKo: 'LA',         labelEn: 'LA',           flag: '🇺🇸', lat: 34.1 },
  { key: 'sydney',      labelKo: '시드니',     labelEn: 'Sydney',       flag: '🇦🇺', lat: -33.9 },
  { key: 'singapore',   labelKo: '싱가포르',   labelEn: 'Singapore',    flag: '🇸🇬', lat: 1.3 },
  { key: 'saopaulo',    labelKo: '상파울루',   labelEn: 'São Paulo',    flag: '🇧🇷', lat: -23.6 },
  { key: 'moscow',      labelKo: '모스크바',   labelEn: 'Moscow',       flag: '🇷🇺', lat: 55.8 },
  { key: 'hongkong',    labelKo: '홍콩',       labelEn: 'Hong Kong',    flag: '🇭🇰', lat: 22.3 },
  { key: 'jakarta',     labelKo: '자카르타',   labelEn: 'Jakarta',      flag: '🇮🇩', lat: -6.2 },
  { key: 'cairo',       labelKo: '카이로',     labelEn: 'Cairo',        flag: '🇪🇬', lat: 30.0 },
  { key: 'istanbul',    labelKo: '이스탄불',   labelEn: 'Istanbul',     flag: '🇹🇷', lat: 41.0 },
  { key: 'toronto',     labelKo: '토론토',     labelEn: 'Toronto',      flag: '🇨🇦', lat: 43.7 },
];

const CONDITIONS: WeatherCondition[] = ['sunny', 'partlyCloudy', 'cloudy', 'rainy', 'drizzle', 'snowy', 'windy'];
const CONDITION_ICONS: Record<WeatherCondition, LucideIcon> = {
  sunny: Sun, partlyCloudy: CloudSun, cloudy: Cloud,
  rainy: CloudRain, drizzle: CloudDrizzle, snowy: CloudSnow, windy: Wind,
};
const CONDITION_COLORS: Record<WeatherCondition, string> = {
  sunny: 'text-amber-300', partlyCloudy: 'text-amber-200', cloudy: 'text-gray-300',
  rainy: 'text-blue-300', drizzle: 'text-blue-200', snowy: 'text-sky-100', windy: 'text-teal-300',
};
const CONDITION_LABELS_KO: Record<WeatherCondition, string> = {
  sunny: '맑음', partlyCloudy: '구름 조금', cloudy: '흐림',
  rainy: '비', drizzle: '이슬비', snowy: '눈', windy: '바람',
};
const CONDITION_LABELS_EN: Record<WeatherCondition, string> = {
  sunny: 'Clear', partlyCloudy: 'Partly Cloudy', cloudy: 'Cloudy',
  rainy: 'Rain', drizzle: 'Drizzle', snowy: 'Snow', windy: 'Windy',
};

function generateForecast(cityKey: string, lat: number): Array<{ dayOffset: number; condition: WeatherCondition; high: number; low: number }> {
  const today = new Date();
  const month = today.getMonth();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const isNorth = lat >= 0;
  const baseTemp = (() => {
    if (Math.abs(lat) < 15) return { high: 32, low: 24, variation: 3 };
    if (Math.abs(lat) < 30) {
      const winterMonth = isNorth ? (month >= 11 || month <= 1) : (month >= 5 && month <= 7);
      return winterMonth ? { high: 18, low: 8, variation: 5 } : { high: 33, low: 22, variation: 4 };
    }
    if (Math.abs(lat) < 50) {
      const winterMonth = isNorth ? (month >= 11 || month <= 1) : (month >= 5 && month <= 7);
      const summerMonth = isNorth ? (month >= 5 && month <= 7) : (month >= 11 || month <= 1);
      if (winterMonth) return { high: 3, low: -5, variation: 4 };
      if (summerMonth) return { high: 28, low: 18, variation: 4 };
      return { high: 15, low: 6, variation: 5 };
    }
    const winterMonth = isNorth ? (month >= 11 || month <= 2) : (month >= 5 && month <= 8);
    return winterMonth ? { high: -5, low: -15, variation: 5 } : { high: 20, low: 10, variation: 5 };
  })();
  const seed = cityKey.split('').reduce((s, c) => s + c.charCodeAt(0), 0) + dayOfYear;
  const pseudoRandom = (i: number) => { const x = Math.sin(seed + i * 37) * 10000; return x - Math.floor(x); };
  return Array.from({ length: 7 }, (_, i) => {
    const r = pseudoRandom(i);
    const high = Math.round(baseTemp.high + (r - 0.5) * baseTemp.variation * 2);
    const low = Math.round(baseTemp.low + (pseudoRandom(i + 100) - 0.5) * baseTemp.variation * 2);
    let condition: WeatherCondition;
    if (high <= 0) condition = r > 0.3 ? 'snowy' : 'cloudy';
    else if (high <= 10) condition = r > 0.7 ? 'rainy' : r > 0.4 ? 'cloudy' : 'partlyCloudy';
    else if (high <= 20) condition = CONDITIONS[Math.floor(r * 5)] || 'partlyCloudy';
    else if (high <= 30) condition = r > 0.7 ? 'rainy' : r > 0.4 ? 'partlyCloudy' : 'sunny';
    else condition = r > 0.6 ? 'sunny' : 'partlyCloudy';
    return { dayOffset: i, condition, high, low: Math.min(low, high - 2) };
  });
}

function WeatherWidget({ context: _context }: { context: WidgetDataContext }) {
  const { t, language } = useTranslation();
  const { widgetSettings, updateWidgetSettings, weatherSettingsOpen, setWeatherSettingsOpen } = useAppStore();

  const selectedCityKey = useMemo(() => {
    const stored = widgetSettings?.weather?.city;
    return (typeof stored === 'string' && stored) ? stored : 'seoul';
  }, [widgetSettings]);

  const [tempCity, setTempCity] = useState(selectedCityKey);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (weatherSettingsOpen) {
      setTempCity(selectedCityKey);
      setSearchQuery('');
    }
  }, [weatherSettingsOpen, selectedCityKey]);

  const cityDef = useMemo(
    () => WEATHER_CITIES.find(c => c.key === selectedCityKey) || WEATHER_CITIES[0],
    [selectedCityKey],
  );

  const forecast = useMemo(
    () => generateForecast(selectedCityKey, cityDef.lat),
    [selectedCityKey, cityDef.lat],
  );

  const days = useMemo(() => {
    const today = new Date();
    return forecast.map((f) => {
      const date = new Date(today);
      date.setDate(date.getDate() + f.dayOffset);
      const dayName = f.dayOffset === 0
        ? t('today')
        : new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', { weekday: 'short' }).format(date);
      return { ...f, dayName };
    });
  }, [forecast, t, language]);

  const todayForecast = days[0];
  const TodayIcon = CONDITION_ICONS[todayForecast.condition];
  const conditionLabel = language === 'ko'
    ? CONDITION_LABELS_KO[todayForecast.condition]
    : CONDITION_LABELS_EN[todayForecast.condition];
  const cityLabel = language === 'ko' ? cityDef.labelKo : cityDef.labelEn;

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return WEATHER_CITIES;
    const q = searchQuery.toLowerCase();
    return WEATHER_CITIES.filter(c =>
      c.labelEn.toLowerCase().includes(q) || c.labelKo.includes(q) || c.key.includes(q)
    );
  }, [searchQuery]);

  const handleSave = () => {
    updateWidgetSettings('weather', { city: tempCity });
    setWeatherSettingsOpen(false);
  };

  return (
    <>
      <div className="h-full flex flex-col widget-dark-card weather-gradient-bg p-3">
        {/* Header: city + current temp */}
        <div className="shrink-0 mb-1">
          <p className="text-sm font-semibold text-white/90">{cityLabel}</p>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-light text-white tabular-nums">{todayForecast.high}°</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <TodayIcon className={`w-4 h-4 ${CONDITION_COLORS[todayForecast.condition]}`} />
            <span className="text-xs text-white/70">{conditionLabel}</span>
            <span className="text-xs text-white/50">
              {language === 'ko' ? `최고:${todayForecast.high}° 최저:${todayForecast.low}°` : `H:${todayForecast.high}° L:${todayForecast.low}°`}
            </span>
          </div>
        </div>

        {/* 7-day forecast row */}
        <div className="grid grid-cols-7 gap-0.5 flex-1 items-center border-t border-white/10 pt-2 mt-1">
          {days.map((day) => {
            const Icon = CONDITION_ICONS[day.condition];
            const isToday = day.dayOffset === 0;
            return (
              <div key={day.dayOffset} className="text-center">
                <p className={`text-[10px] font-medium ${isToday ? 'text-white' : 'text-white/50'}`}>
                  {day.dayName}
                </p>
                <Icon className={`w-4 h-4 mx-auto my-0.5 ${CONDITION_COLORS[day.condition]}`} />
                <p className="text-[11px] font-semibold text-white">{day.high}°</p>
                <p className="text-[10px] text-white/40">{day.low}°</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* City Selection Dialog */}
      <Dialog open={weatherSettingsOpen} onOpenChange={setWeatherSettingsOpen}>
        <DialogContent className="sm:max-w-sm" onMouseDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('weeklyWeather')} — {t('settings')}</DialogTitle>
          </DialogHeader>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ko' ? '도시 검색...' : 'Search city...'}
            className="h-8 text-sm"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto py-1">
            {filteredCities.map((city) => {
              const isSelected = tempCity === city.key;
              const label = language === 'ko' ? city.labelKo : city.labelEn;
              return (
                <button
                  key={city.key}
                  onClick={() => setTempCity(city.key)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors border ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-transparent border-border text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-base">{city.flag}</span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
            {filteredCities.length === 0 && (
              <p className="col-span-2 text-xs text-muted-foreground text-center py-4">
                {language === 'ko' ? '결과 없음' : 'No results'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setWeatherSettingsOpen(false)}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={handleSave}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WeatherWidget;
