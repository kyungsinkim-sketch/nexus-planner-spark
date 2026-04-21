/**
 * LiveCaptionWidget — Real-time meeting captions & translation.
 *
 * Uses the browser Web Speech API (`webkitSpeechRecognition`) to transcribe
 * microphone input live, and the shared `translateService` for Korean↔English
 * auto-translation. Independent from callService STT.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Languages,
  Copy,
  Trash2,
  AlertTriangle,
  Check,
  ArrowRight,
  Download,
} from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';
import { useTranslation } from '@/hooks/useTranslation';
import { translate } from '@/services/translateService';

interface CaptionLine {
  id: number;
  text: string;
  translation?: string | null;
  isFinal: boolean;
  timestamp: number;
}

type SpeechLang = 'ko-KR' | 'en-US';

const LANG_LABELS: Record<SpeechLang, { short: string; full: string; target: string }> = {
  'ko-KR': { short: 'KO', full: '한국어', target: 'English' },
  'en-US': { short: 'EN', full: 'English', target: '한국어' },
};

function LiveCaptionWidget(_props: { context: WidgetDataContext }) {
  const { t } = useTranslation();

  const [supported, setSupported] = useState(true);
  const [running, setRunning] = useState(false);
  const [lang, setLang] = useState<SpeechLang>('ko-KR');
  const [translateOn, setTranslateOn] = useState(true);
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [copied, setCopied] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const recognitionRef = useRef<any>(null);
  const idRef = useRef(0);
  const interimIdRef = useRef<number | null>(null);
  const wantRunningRef = useRef(false);
  const translateOnRef = useRef(true);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => { translateOnRef.current = translateOn; }, [translateOn]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  // Scroll only the internal transcript container — NEVER the ancestor page/dashboard.
  // Previously used scrollIntoView which bubbles up through all scroll parents,
  // causing the dashboard to auto-scroll the widget into view.
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Elapsed timer
  useEffect(() => {
    if (running) {
      startTimeRef.current = Date.now();
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  const runTranslate = useCallback((lineId: number, text: string) => {
    translate(text).then(result => {
      setLines(prev => prev.map(l => l.id === lineId ? { ...l, translation: result ?? null } : l));
    }).catch(() => {
      setLines(prev => prev.map(l => l.id === lineId ? { ...l, translation: null } : l));
    });
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    if (recognitionRef.current) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      // Pre-compute IDs and actions OUTSIDE the state updater.
      // React 18 defers updater execution (batching), so mutations
      // inside the updater aren't visible after the setLines call.
      type Entry =
        | { type: 'final'; id: number; text: string; removeInterimId: number | null }
        | { type: 'interim-new'; id: number; text: string }
        | { type: 'interim-update'; id: number; text: string };

      const entries: Entry[] = [];

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result[0].transcript || '').trim();
        if (!text) continue;

        if (result.isFinal) {
          const removeId = interimIdRef.current;
          interimIdRef.current = null;
          const id = ++idRef.current;
          entries.push({ type: 'final', id, text, removeInterimId: removeId });
        } else {
          if (interimIdRef.current !== null) {
            entries.push({ type: 'interim-update', id: interimIdRef.current, text });
          } else {
            const id = ++idRef.current;
            interimIdRef.current = id;
            entries.push({ type: 'interim-new', id, text });
          }
        }
      }

      setLines(prev => {
        let next = prev;
        for (const entry of entries) {
          if (entry.type === 'final') {
            if (entry.removeInterimId !== null) {
              next = next.filter(l => l.id !== entry.removeInterimId);
            }
            next = [...next, { id: entry.id, text: entry.text, isFinal: true, timestamp: Date.now() }];
            if (next.length > 200) next = next.slice(-200);
          } else if (entry.type === 'interim-update') {
            next = next.map(l => l.id === entry.id ? { ...l, text: entry.text } : l);
          } else {
            next = [...next, { id: entry.id, text: entry.text, isFinal: false, timestamp: Date.now() }];
          }
        }
        return next;
      });

      // Trigger translation — IDs are pre-computed, safe outside updater
      if (translateOnRef.current) {
        for (const entry of entries) {
          if (entry.type === 'final') {
            runTranslate(entry.id, entry.text);
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantRunningRef.current = false;
        setRunning(false);
      }
    };

    recognition.onend = () => {
      if (wantRunningRef.current && recognitionRef.current === recognition) {
        try { recognition.start(); } catch {
          recognitionRef.current = null;
          setRunning(false);
        }
      } else {
        recognitionRef.current = null;
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      wantRunningRef.current = true;
      setRunning(true);
    } catch {
      recognitionRef.current = null;
      wantRunningRef.current = false;
      setRunning(false);
    }
  }, [lang, runTranslate]);

  const stop = useCallback(() => {
    wantRunningRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) { try { rec.stop(); } catch { /* already stopped */ } }
    setRunning(false);
  }, []);

  // Restart when language changes while running
  useEffect(() => {
    if (running && recognitionRef.current) {
      stop();
      const t = setTimeout(() => start(), 150);
      return () => clearTimeout(t);
    }
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantRunningRef.current = false;
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) { try { rec.stop(); } catch { /* already stopped */ } }
    };
  }, []);

  // When translate toggled ON, translate existing untranslated lines
  useEffect(() => {
    if (!translateOn) return;
    lines.forEach(l => {
      if (l.isFinal && !l.translation) runTranslate(l.id, l.text);
    });
  }, [translateOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLang = useCallback(() => {
    setLang(prev => prev === 'ko-KR' ? 'en-US' : 'ko-KR');
  }, []);

  const allText = useMemo(
    () => lines.filter(l => l.isFinal).map(l =>
      l.translation ? `${l.text}\n  → ${l.translation}` : l.text
    ).join('\n'),
    [lines],
  );

  const copyAll = useCallback(async () => {
    if (!allText) return;
    try {
      await navigator.clipboard.writeText(allText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }, [allText]);

  const downloadTxt = useCallback(() => {
    if (!allText) return;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const blob = new Blob([allText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-transcript-${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allText]);

  const clearAll = useCallback(() => {
    setLines([]);
    interimIdRef.current = null;
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const langInfo = LANG_LABELS[lang];
  const finalLineCount = lines.filter(l => l.isFinal).length;

  if (!supported) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <AlertTriangle className="w-8 h-8 text-yellow-500" />
        <div className="text-sm text-foreground/80">{t('liveCaptionUnsupported')}</div>
        <div className="text-xs text-muted-foreground">{t('liveCaptionUseChrome')}</div>
      </div>
    );
  }

  // Empty state — big Start button
  if (!running && lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 gap-4">
        {/* Big start button */}
        <button
          onClick={start}
          className="w-20 h-20 rounded-full bg-primary/15 hover:bg-primary/25 border-2 border-primary/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <Mic className="w-8 h-8 text-primary" />
        </button>
        <div className="text-sm font-medium text-foreground/80">{t('liveCaptionStart')}</div>
        <div className="text-xs text-muted-foreground text-center">{t('liveCaptionEmpty')}</div>

        {/* Language + translate controls */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-foreground/80 transition-colors"
          >
            <span>{langInfo.full}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span>{langInfo.target}</span>
          </button>
          <button
            onClick={() => setTranslateOn(v => !v)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              translateOn
                ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{translateOn ? t('liveCaptionTranslateOn') : t('liveCaptionTranslateOff')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Active / has-lines state
  return (
    <div className="flex flex-col h-full">
      {/* Control bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 shrink-0">
        {/* Mic toggle */}
        <button
          onClick={running ? stop : start}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            running
              ? 'bg-red-500/15 text-red-600 border border-red-500/30 hover:bg-red-500/25'
              : 'bg-green-500/15 text-green-700 border border-green-500/30 hover:bg-green-500/25'
          }`}
        >
          {running ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{running ? t('liveCaptionStop') : t('liveCaptionStart')}</span>
          {running && <span className="text-red-500/60 tabular-nums">{formatTime(elapsedSec)}</span>}
        </button>

        {/* Language swap */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-foreground/70 transition-colors"
          title={`${langInfo.full} → ${langInfo.target}`}
        >
          <span>{langInfo.short}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <span>{lang === 'ko-KR' ? 'EN' : 'KO'}</span>
        </button>

        {/* Translate toggle */}
        <button
          onClick={() => setTranslateOn(v => !v)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium transition-colors ${
            translateOn
              ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          title={t('liveCaptionTranslate')}
        >
          <Languages className="w-3.5 h-3.5" />
        </button>

        {/* Line count */}
        <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
          {finalLineCount > 0 && `${finalLineCount}줄`}
        </span>

        {/* Copy */}
        <button
          onClick={copyAll}
          disabled={!allText}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          title={t('liveCaptionCopy')}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* Download */}
        <button
          onClick={downloadTxt}
          disabled={!allText}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          title="Download .txt"
        >
          <Download className="w-3.5 h-3.5" />
        </button>

        {/* Clear */}
        <button
          onClick={clearAll}
          disabled={lines.length === 0}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          title={t('liveCaptionClear')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Transcript — selectable text */}
      <div ref={transcriptRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 select-text cursor-text">
        {lines.map(line => {
          const time = new Date(line.timestamp);
          const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
          return (
            <div key={line.id} className="group text-sm leading-relaxed">
              <div className="flex gap-2">
                {line.isFinal && (
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums pt-0.5 shrink-0 select-none">
                    {timeStr}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className={line.isFinal ? 'text-foreground' : 'text-muted-foreground italic'}>
                    {line.text}
                  </div>
                  {translateOn && line.isFinal && (
                    line.translation ? (
                      <div className="text-blue-500/80 text-xs mt-0.5">
                        → {line.translation}
                      </div>
                    ) : line.translation === undefined ? (
                      <div className="text-muted-foreground/40 text-xs mt-0.5 italic">
                        {t('liveCaptionTranslating')}
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LiveCaptionWidget;
