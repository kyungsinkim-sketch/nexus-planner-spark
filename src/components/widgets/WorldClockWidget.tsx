/**
 * WorldClockWidget — Shows digital clocks for selected world cities.
 * Updates every second via setInterval.
 * Uses Intl.DateTimeFormat for native timezone support.
 * City selection is persisted via appStore.widgetSettings.worldClock.cities
 */

import { useState, useEffect, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { WidgetDataContext } from '@/types/widget';

interface CityDef {
  key: string;
  timezone: string;
  labelKo: string;
  labelEn: string;
  flag: string;
}

const ALL_CITIES: CityDef[] = [
  { key: 'seoul',       timezone: 'Asia/Seoul',            labelKo: '서울',       labelEn: 'Seoul',        flag: '🇰🇷' },
  { key: 'tokyo',       timezone: 'Asia/Tokyo',            labelKo: '도쿄',       labelEn: 'Tokyo',        flag: '🇯🇵' },
  { key: 'beijing',     timezone: 'Asia/Shanghai',         labelKo: '베이징',     labelEn: 'Beijing',      flag: '🇨🇳' },
  { key: 'bangkok',     timezone: 'Asia/Bangkok',          labelKo: '방콕',       labelEn: 'Bangkok',      flag: '🇹🇭' },
  { key: 'newdelhi',    timezone: 'Asia/Kolkata',          labelKo: '뉴델리',     labelEn: 'New Delhi',    flag: '🇮🇳' },
  { key: 'dubai',       timezone: 'Asia/Dubai',            labelKo: '두바이',     labelEn: 'Dubai',        flag: '🇦🇪' },
  { key: 'london',      timezone: 'Europe/London',         labelKo: '런던',       labelEn: 'London',       flag: '🇬🇧' },
  { key: 'paris',       timezone: 'Europe/Paris',          labelKo: '파리',       labelEn: 'Paris',        flag: '🇫🇷' },
  { key: 'berlin',      timezone: 'Europe/Berlin',         labelKo: '베를린',     labelEn: 'Berlin',       flag: '🇩🇪' },
  { key: 'moscow',      timezone: 'Europe/Moscow',         labelKo: '모스크바',   labelEn: 'Moscow',       flag: '🇷🇺' },
  { key: 'newyork',     timezone: 'America/New_York',      labelKo: '뉴욕',       labelEn: 'New York',     flag: '🇺🇸' },
  { key: 'losangeles',  timezone: 'America/Los_Angeles',   labelKo: 'LA',         labelEn: 'LA',           flag: '🇺🇸' },
  { key: 'chicago',     timezone: 'America/Chicago',       labelKo: '시카고',     labelEn: 'Chicago',      flag: '🇺🇸' },
  { key: 'saopaulo',    timezone: 'America/Sao_Paulo',     labelKo: '상파울루',   labelEn: 'São Paulo',    flag: '🇧🇷' },
  { key: 'sydney',      timezone: 'Australia/Sydney',      labelKo: '시드니',     labelEn: 'Sydney',       flag: '🇦🇺' },
  { key: 'auckland',    timezone: 'Pacific/Auckland',      labelKo: '오클랜드',   labelEn: 'Auckland',     flag: '🇳🇿' },
  { key: 'honolulu',    timezone: 'Pacific/Honolulu',      labelKo: '호놀룰루',   labelEn: 'Honolulu',     flag: '🇺🇸' },
  { key: 'singapore',   timezone: 'Asia/Singapore',        labelKo: '싱가포르',   labelEn: 'Singapore',    flag: '🇸🇬' },
];

const DEFAULT_CITY_KEYS = ['seoul', 'newyork', 'london', 'tokyo', 'losangeles'];
const MAX_CITIES = 6;

function WorldClockWidget({ context: _context }: { context: WidgetDataContext }) {
  const [now, setNow] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const { language, t } = useTranslation();
  const { widgetSettings, updateWidgetSettings } = useAppStore();

  const selectedKeys: string[] = useMemo(() => {
    const stored = widgetSettings?.worldClock?.cities;
    if (Array.isArray(stored) && stored.length > 0) return stored as string[];
    return DEFAULT_CITY_KEYS;
  }, [widgetSettings]);

  const [tempSelected, setTempSelected] = useState<string[]>(selectedKeys);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync temp selection when settings opens
  useEffect(() => {
    if (showSettings) setTempSelected(selectedKeys);
  }, [showSettings, selectedKeys]);

  const selectedCities = useMemo(
    () => selectedKeys.map(k => ALL_CITIES.find(c => c.key === k)).filter(Boolean) as CityDef[],
    [selectedKeys],
  );

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

  const toggleCity = (key: string) => {
    setTempSelected(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= MAX_CITIES) return prev;
      return [...prev, key];
    });
  };

  const handleSave = () => {
    updateWidgetSettings('worldClock', { cities: tempSelected });
    setShowSettings(false);
  };

  const cols = Math.min(selectedCities.length, 6);

  return (
    <>
      <div className="h-full flex flex-col relative">
        {/* Settings gear button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
          className="absolute top-0 right-0 p-1 rounded hover:bg-white/10 transition-colors z-10"
          title={t('settings')}
        >
          <Settings className="w-3 h-3 text-muted-foreground/60 hover:text-foreground transition-colors" />
        </button>

        {/* City clocks grid */}
        <div
          className="flex-1 grid gap-1 items-center px-1"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {selectedCities.map((city) => {
            const label = language === 'ko' ? city.labelKo : city.labelEn;
            return (
              <div key={city.key} className="text-center py-0.5">
                <p className="text-base leading-none mb-0.5">{city.flag}</p>
                <p className="text-lg font-mono font-bold text-foreground tabular-nums leading-tight">
                  {formatTime(city.timezone)}
                </p>
                <p className="text-[11px] font-medium text-foreground/80 truncate">{label}</p>
                <p className="text-[9px] text-muted-foreground truncate leading-tight">{formatDate(city.timezone)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-sm" onMouseDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('worldClock')} — {t('settings')}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {language === 'ko'
              ? `최대 ${MAX_CITIES}개 도시를 선택하세요 (${tempSelected.length}/${MAX_CITIES})`
              : `Select up to ${MAX_CITIES} cities (${tempSelected.length}/${MAX_CITIES})`}
          </p>
          <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto py-2">
            {ALL_CITIES.map((city) => {
              const isSelected = tempSelected.includes(city.key);
              const label = language === 'ko' ? city.labelKo : city.labelEn;
              return (
                <button
                  key={city.key}
                  onClick={() => toggleCity(city.key)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors border ${
                    isSelected
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-transparent border-border text-foreground hover:bg-muted'
                  } ${!isSelected && tempSelected.length >= MAX_CITIES ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <span className="text-base">{city.flag}</span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(false)}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={tempSelected.length === 0}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WorldClockWidget;
