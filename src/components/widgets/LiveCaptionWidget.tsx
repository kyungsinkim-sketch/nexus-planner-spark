/**
 * LiveCaptionWidget — Real-time meeting captions & translation.
 *
 * Uses the browser Web Speech API (`webkitSpeechRecognition`) to transcribe
 * microphone input live, and the shared `translateService` for Korean↔English
 * auto-translation. No server cost, but Chrome/Edge/Safari only.
 *
 * Independent from `callService.ts` STT so that starting/stopping here does
 * not interfere with in-call captions. The only shared piece is the
 * translate API, which is a pure function.
 *
 * Features:
 * - Start/stop mic
 * - Language picker (ko-KR / en-US / auto)
 * - Translate toggle (ko↔en)
 * - Copy all / Clear
 * - Auto-restart on `onend` (browsers stop after ~60s of silence)
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
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

function LiveCaptionWidget(_props: { context: WidgetDataContext }) {
  const { t } = useTranslation();

  const [supported, setSupported] = useState(true);
  const [running, setRunning] = useState(false);
  const [lang, setLang] = useState<SpeechLang>('ko-KR');
  const [translateOn, setTranslateOn] = useState(false);
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [copied, setCopied] = useState(false);

  const recognitionRef = useRef<any>(null);
  const idRef = useRef(0);
  const interimIdRef = useRef<number | null>(null);
  const wantRunningRef = useRef(false);
  const translateOnRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    translateOnRef.current = translateOn;
  }, [translateOn]);

  // Detect Web Speech API availability
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  // Auto-scroll to newest line
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lines]);

  const runTranslate = useCallback((lineId: number, text: string) => {
    translate(text).then(result => {
      if (!result) return;
      setLines(prev => prev.map(l => l.id === lineId ? { ...l, translation: result } : l));
    }).catch(() => { /* ignore */ });
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    if (recognitionRef.current) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const newFinals: Array<{ id: number; text: string }> = [];
      setLines(prev => {
        let next = prev;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = (result[0].transcript || '').trim();
          if (!text) continue;

          if (result.isFinal) {
            // Drop interim placeholder (if any) then push final line
            if (interimIdRef.current !== null) {
              next = next.filter(l => l.id !== interimIdRef.current);
              interimIdRef.current = null;
            }
            const id = ++idRef.current;
            next = [...next, { id, text, isFinal: true, timestamp: Date.now() }];
            if (next.length > 100) next = next.slice(-100);
            if (translateOnRef.current) newFinals.push({ id, text });
          } else {
            if (interimIdRef.current !== null) {
              next = next.map(l => l.id === interimIdRef.current ? { ...l, text } : l);
            } else {
              const id = ++idRef.current;
              interimIdRef.current = id;
              next = [...next, { id, text, isFinal: false, timestamp: Date.now() }];
            }
          }
        }
        return next;
      });

      // Kick off translations outside the state updater
      for (const { id, text } of newFinals) runTranslate(id, text);
    };

    recognition.onerror = (event: any) => {
      console.warn('[LiveCaption] error:', event.error);
      // Benign errors — browser will retry via onend restart below
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantRunningRef.current = false;
        setRunning(false);
      }
    };

    recognition.onend = () => {
      // Browsers stop the session after ~60s silence; auto-restart if user still wants it
      if (wantRunningRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // If start fails (e.g. double-start), clear state
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
    } catch (err) {
      console.error('[LiveCaption] start failed:', err);
      recognitionRef.current = null;
      wantRunningRef.current = false;
      setRunning(false);
    }
  }, [lang, runTranslate]);

  const stop = useCallback(() => {
    wantRunningRef.current = false;
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try { rec.stop(); } catch { /* ignore */ }
    }
    setRunning(false);
  }, []);

  // Restart recognition when language changes while running
  useEffect(() => {
    if (running && recognitionRef.current) {
      stop();
      // small delay to let the old instance wind down
      const t = setTimeout(() => start(), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantRunningRef.current = false;
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      if (rec) {
        try { rec.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  // When user toggles translate ON, translate any final lines that don't have one
  useEffect(() => {
    if (!translateOn) return;
    lines.forEach(l => {
      if (l.isFinal && !l.translation) runTranslate(l.id, l.text);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translateOn]);

  const toggleMic = useCallback(() => {
    if (running) stop(); else start();
  }, [running, start, stop]);

  const allText = useMemo(
    () => lines.filter(l => l.isFinal).map(l => l.translation ? `${l.text}\n${l.translation}` : l.text).join('\n'),
    [lines],
  );

  const copyAll = useCallback(async () => {
    if (!allText) return;
    try {
      await navigator.clipboard.writeText(allText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [allText]);

  const clearAll = useCallback(() => {
    setLines([]);
    interimIdRef.current = null;
  }, []);

  if (!supported) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <AlertTriangle className="w-8 h-8 text-yellow-400" />
        <div className="text-sm text-foreground/80">{t('liveCaptionUnsupported')}</div>
        <div className="text-xs text-foreground/50">{t('liveCaptionUseChrome')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <button
          onClick={toggleMic}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            running
              ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
              : 'bg-white/10 text-white/80 hover:bg-white/20'
          }`}
          title={running ? t('liveCaptionStop') : t('liveCaptionStart')}
        >
          {running ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{running ? t('liveCaptionListening') : t('liveCaptionStart')}</span>
        </button>

        <Select value={lang} onValueChange={(v) => setLang(v as SpeechLang)}>
          <SelectTrigger className="h-7 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ko-KR">한국어</SelectItem>
            <SelectItem value="en-US">English</SelectItem>
          </SelectContent>
        </Select>

        <button
          onClick={() => setTranslateOn(v => !v)}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
            translateOn
              ? 'bg-blue-500/25 text-blue-300'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
          title={t('liveCaptionTranslate')}
        >
          <Languages className="w-3.5 h-3.5" />
          <span>{translateOn ? t('liveCaptionTranslateOn') : t('liveCaptionTranslateOff')}</span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={copyAll}
            disabled={!allText}
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
            title={t('liveCaptionCopy')}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={clearAll}
            disabled={lines.length === 0}
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent"
            title={t('liveCaptionClear')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-1.5 opacity-60">
            <Mic className="w-6 h-6" />
            <div className="text-xs">{t('liveCaptionEmpty')}</div>
          </div>
        ) : (
          lines.map(line => (
            <div
              key={line.id}
              className={`text-sm leading-relaxed ${line.isFinal ? 'text-white' : 'text-white/55 italic'}`}
            >
              <div>{line.text}</div>
              {translateOn && line.isFinal && line.translation && (
                <div className="text-blue-300/90 text-xs mt-0.5">{line.translation}</div>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

export default LiveCaptionWidget;
