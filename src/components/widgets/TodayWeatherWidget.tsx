/**
 * TodayWeatherWidget — Shows today's weather for a selected city.
 * Dark card with gradient background (Apple-style).
 */

import { useState, useMemo, useEffect } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudSun, CloudDrizzle, Wind } from 'lucide-react';
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
import type { LucideIcon } from 'lucide-react';
import { WEATHER_CITIES, CONDITIONS, CONDITION_ICONS, CONDITION_COLORS, CONDITION_LABELS_KO, CONDITION_LABELS_EN, generateForecast, type WeatherCondition } from './weatherUtils';

function TodayWeatherWidget({ context: _context }: { context: WidgetDataContext }) {
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

  const todayForecast = forecast[0];
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
      <div className="h-full flex flex-col items-center justify-center widget-dark-card weather-gradient-bg p-4">
        <p className="text-sm font-semibold text-white/90 mb-1">{cityLabel}</p>
        <span className="text-5xl font-light text-white tabular-nums leading-none">{todayForecast.high}°</span>
        <div className="flex items-center gap-2 mt-3">
          <TodayIcon className={`w-5 h-5 ${CONDITION_COLORS[todayForecast.condition]}`} />
          <span className="text-sm text-white/80">{conditionLabel}</span>
        </div>
        <span className="text-xs text-white/50 mt-1">
          {language === 'ko' ? `최고:${todayForecast.high}° 최저:${todayForecast.low}°` : `H:${todayForecast.high}° L:${todayForecast.low}°`}
        </span>
      </div>

      {/* City Selection Dialog */}
      <Dialog open={weatherSettingsOpen} onOpenChange={setWeatherSettingsOpen}>
        <DialogContent className="sm:max-w-sm" onMouseDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('todayWeather')} — {t('settings')}</DialogTitle>
            <DialogDescription className="sr-only">{t('todayWeather')}</DialogDescription>
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

export default TodayWeatherWidget;
