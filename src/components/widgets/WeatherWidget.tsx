/**
 * WeatherWidget (Weekly) — Shows a 7-day weather forecast for a selected city.
 * Dark card design with gradient background (inspired by Apple widgets).
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { WidgetDataContext } from '@/types/widget';
import { WEATHER_CITIES, CONDITION_ICONS, CONDITION_COLORS, CONDITION_LABELS_KO, CONDITION_LABELS_EN, generateForecast } from './weatherUtils';

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 300, h: 200 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function WeatherWidget({ context: _context }: { context: WidgetDataContext }) {
  const { t, language } = useTranslation();
  const { widgetSettings, updateWidgetSettings, weatherSettingsOpen, setWeatherSettingsOpen } = useAppStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const { w, h } = useContainerSize(containerRef);

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
      <div ref={containerRef} className="h-full flex flex-col widget-dark-card overflow-hidden" style={{ padding: h < 120 ? 4 : h < 160 ? 8 : 12 }}>
        {/* 7-day forecast row */}
        <div className="grid grid-cols-7 gap-0.5 flex-1 items-center min-h-0">
          {days.map((day) => {
            const Icon = CONDITION_ICONS[day.condition];
            const isToday = day.dayOffset === 0;
            const iconSize = h < 100 ? 12 : h < 140 ? 16 : 24;
            const fontSize = h < 100 ? 9 : h < 140 ? 10 : 14;
            const tempSize = h < 100 ? 10 : h < 140 ? 12 : 16;
            return (
              <div key={day.dayOffset} className="text-center min-w-0 overflow-hidden">
                <p
                  className={`font-medium truncate ${isToday ? 'text-white' : 'text-white/50'}`}
                  style={{ fontSize }}
                >
                  {day.dayName}
                </p>
                <Icon
                  className={`mx-auto ${CONDITION_COLORS[day.condition]}`}
                  style={{ width: iconSize, height: iconSize, marginTop: h < 140 ? 1 : 4, marginBottom: h < 140 ? 1 : 4 }}
                />
                <p className="font-semibold text-white" style={{ fontSize: tempSize }}>{day.high}°</p>
                <p className="text-white/40" style={{ fontSize: Math.max(9, fontSize - 1) }}>{day.low}°</p>
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
            <DialogDescription className="sr-only">{t('weeklyWeather')}</DialogDescription>
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
