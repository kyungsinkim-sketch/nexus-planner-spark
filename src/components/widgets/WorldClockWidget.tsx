/**
 * WorldClockWidget — Shows digital clocks for selected world cities/timezones.
 * Dark card design inspired by Apple clock widget.
 */

import { useState, useEffect, useMemo } from 'react';
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
import { X } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

interface CityDef {
  key: string;
  timezone: string;
  labelKo: string;
  labelEn: string;
  flag: string;
}

const PREDEFINED_CITIES: CityDef[] = [
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
  { key: 'jakarta',     timezone: 'Asia/Jakarta',          labelKo: '자카르타',   labelEn: 'Jakarta',      flag: '🇮🇩' },
  { key: 'mumbai',      timezone: 'Asia/Kolkata',          labelKo: '뭄바이',     labelEn: 'Mumbai',       flag: '🇮🇳' },
  { key: 'hongkong',    timezone: 'Asia/Hong_Kong',        labelKo: '홍콩',       labelEn: 'Hong Kong',    flag: '🇭🇰' },
  { key: 'taipei',      timezone: 'Asia/Taipei',           labelKo: '타이페이',   labelEn: 'Taipei',       flag: '🇹🇼' },
  { key: 'toronto',     timezone: 'America/Toronto',       labelKo: '토론토',     labelEn: 'Toronto',      flag: '🇨🇦' },
  { key: 'vancouver',   timezone: 'America/Vancouver',     labelKo: '밴쿠버',     labelEn: 'Vancouver',    flag: '🇨🇦' },
  { key: 'mexico',      timezone: 'America/Mexico_City',   labelKo: '멕시코시티', labelEn: 'Mexico City',  flag: '🇲🇽' },
  { key: 'cairo',       timezone: 'Africa/Cairo',          labelKo: '카이로',     labelEn: 'Cairo',        flag: '🇪🇬' },
  { key: 'istanbul',    timezone: 'Europe/Istanbul',       labelKo: '이스탄불',   labelEn: 'Istanbul',     flag: '🇹🇷' },
  { key: 'rome',        timezone: 'Europe/Rome',           labelKo: '로마',       labelEn: 'Rome',         flag: '🇮🇹' },
  { key: 'madrid',      timezone: 'Europe/Madrid',         labelKo: '마드리드',   labelEn: 'Madrid',       flag: '🇪🇸' },
  { key: 'amsterdam',   timezone: 'Europe/Amsterdam',      labelKo: '암스테르담', labelEn: 'Amsterdam',    flag: '🇳🇱' },
];

const CITY_MAP = new Map(PREDEFINED_CITIES.map(c => [c.key, c]));
const DEFAULT_CITY_KEYS = ['seoul', 'newyork', 'london', 'tokyo', 'losangeles'];
const MAX_CITIES = 6;

function isValidTimezone(tz: string): boolean {
  try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; } catch { return false; }
}

interface StoredCity { key: string; timezone: string; label: string; flag: string; }

function resolveStoredCity(key: string, lang: string): StoredCity {
  const predefined = CITY_MAP.get(key);
  if (predefined) return { key: predefined.key, timezone: predefined.timezone, label: lang === 'ko' ? predefined.labelKo : predefined.labelEn, flag: predefined.flag };
  if (isValidTimezone(key)) { const cityName = key.split('/').pop()?.replace(/_/g, ' ') || key; return { key, timezone: key, label: cityName, flag: '🌐' }; }
  return { key, timezone: 'UTC', label: key, flag: '🌐' };
}

/** Compute UTC offset difference string relative to local timezone */
function getOffsetLabel(tz: string, lang: string): string {
  const now = new Date();
  const localOffset = now.getTimezoneOffset(); // in minutes (negative = ahead of UTC)
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
  const parts = formatter.formatToParts(now);
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
  // Parse offset like "GMT+9" or "GMT-5"
  const match = tzPart.match(/GMT([+-]?\d+(?::\d+)?)/);
  if (!match) return '';
  const offsetStr = match[1];
  const [hStr, mStr] = offsetStr.includes(':') ? offsetStr.split(':') : [offsetStr, '0'];
  const targetOffsetMin = parseInt(hStr) * 60 + (parseInt(mStr || '0') * (parseInt(hStr) < 0 ? -1 : 1));
  const localOffsetMin = -localOffset;
  const diffHours = (targetOffsetMin - localOffsetMin) / 60;
  if (diffHours === 0) return lang === 'ko' ? '현지' : 'Local';
  const sign = diffHours > 0 ? '+' : '';
  return `${sign}${diffHours}${lang === 'ko' ? '시간' : 'h'}`;
}

function WorldClockWidget({ context: _context }: { context: WidgetDataContext }) {
  const [now, setNow] = useState(new Date());
  const { language, t } = useTranslation();
  const { widgetSettings, updateWidgetSettings, worldClockSettingsOpen, setWorldClockSettingsOpen } = useAppStore();

  const selectedKeys: string[] = useMemo(() => {
    const stored = widgetSettings?.worldClock?.cities;
    if (Array.isArray(stored) && stored.length > 0) return stored as string[];
    return DEFAULT_CITY_KEYS;
  }, [widgetSettings]);

  const [tempSelected, setTempSelected] = useState<string[]>(selectedKeys);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (worldClockSettingsOpen) { setTempSelected(selectedKeys); setSearchQuery(''); }
  }, [worldClockSettingsOpen, selectedKeys]);

  const selectedCities = useMemo(() => selectedKeys.map(k => resolveStoredCity(k, language)), [selectedKeys, language]);

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return PREDEFINED_CITIES;
    const q = searchQuery.toLowerCase();
    return PREDEFINED_CITIES.filter(c =>
      c.labelEn.toLowerCase().includes(q) || c.labelKo.includes(q) || c.timezone.toLowerCase().includes(q) || c.key.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const customTimezoneMatch = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.trim();
    if (PREDEFINED_CITIES.some(c => c.key === q || c.timezone === q)) return null;
    if (isValidTimezone(q)) { const label = q.split('/').pop()?.replace(/_/g, ' ') || q; return { key: q, timezone: q, label, flag: '🌐' }; }
    for (const prefix of ['America/', 'Europe/', 'Asia/', 'Africa/', 'Pacific/', 'Australia/']) {
      const tryTz = prefix + q.replace(/\s+/g, '_');
      if (isValidTimezone(tryTz)) { const label = tryTz.split('/').pop()?.replace(/_/g, ' ') || tryTz; return { key: tryTz, timezone: tryTz, label, flag: '🌐' }; }
    }
    return null;
  }, [searchQuery]);

  const formatTime = (tz: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);

  const formatSeconds = (tz: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, second: '2-digit' }).format(now);

  const toggleCity = (key: string) => {
    setTempSelected(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= MAX_CITIES) return prev;
      return [...prev, key];
    });
  };

  const handleSave = () => { updateWidgetSettings('worldClock', { cities: tempSelected }); setWorldClockSettingsOpen(false); };

  const cols = Math.min(selectedCities.length, 6);

  return (
    <>
      <div
        className="h-full widget-dark-card p-2 grid gap-1 items-center"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {selectedCities.map((city) => {
          const offset = getOffsetLabel(city.timezone, language);
          return (
            <div key={city.key} className="text-center py-0.5">
              <p className="text-[11px] font-semibold text-white/90 truncate">
                {city.label}
                {offset && <span className="text-[10px] text-white/40 font-normal ml-0.5">({offset})</span>}
              </p>
              <p className="text-xl font-mono font-bold text-white tabular-nums leading-tight">
                {formatTime(city.timezone)}
                <span className="text-[10px] text-white/30 font-normal ml-0.5">{formatSeconds(city.timezone)}</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Settings Dialog */}
      <Dialog open={worldClockSettingsOpen} onOpenChange={setWorldClockSettingsOpen}>
        <DialogContent className="sm:max-w-md" onMouseDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('worldClock')} — {t('settings')}</DialogTitle>
          </DialogHeader>
          {tempSelected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {tempSelected.map(key => {
                const city = resolveStoredCity(key, language);
                return (
                  <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                    {city.flag} {city.label}
                    <button onClick={() => toggleCity(key)} className="hover:bg-primary/20 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </span>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {language === 'ko' ? `도시 이름 또는 타임존을 검색하세요 (${tempSelected.length}/${MAX_CITIES})` : `Search city or timezone (${tempSelected.length}/${MAX_CITIES})`}
          </p>
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={language === 'ko' ? '도시명 또는 타임존 입력...' : 'City name or timezone...'} className="h-8 text-sm" autoFocus />
          {customTimezoneMatch && !tempSelected.includes(customTimezoneMatch.key) && (
            <button onClick={() => toggleCity(customTimezoneMatch.key)} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 ${tempSelected.length >= MAX_CITIES ? 'opacity-40 pointer-events-none' : ''}`}>
              <span className="text-base">🌐</span><span className="truncate">{customTimezoneMatch.label}</span><span className="text-[10px] text-emerald-500 ml-auto">{customTimezoneMatch.timezone}</span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto py-1">
            {filteredCities.map((city) => {
              const isSelected = tempSelected.includes(city.key);
              const label = language === 'ko' ? city.labelKo : city.labelEn;
              return (
                <button key={city.key} onClick={() => toggleCity(city.key)} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors border ${isSelected ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-border text-foreground hover:bg-muted'} ${!isSelected && tempSelected.length >= MAX_CITIES ? 'opacity-40 pointer-events-none' : ''}`}>
                  <span className="text-base">{city.flag}</span><span className="truncate">{label}</span>
                </button>
              );
            })}
            {filteredCities.length === 0 && !customTimezoneMatch && (
              <p className="col-span-2 text-xs text-muted-foreground text-center py-4">
                {language === 'ko' ? '결과 없음. IANA 타임존을 직접 입력해보세요 (예: America/Denver)' : 'No results. Try an IANA timezone (e.g. America/Denver)'}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setWorldClockSettingsOpen(false)}>{t('cancel')}</Button>
            <Button size="sm" onClick={handleSave} disabled={tempSelected.length === 0}>{t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WorldClockWidget;
