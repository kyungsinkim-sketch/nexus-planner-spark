/**
 * MobileAIChatView — AI Chat tab (Tab 1) for Re-Be.io Phase 3 mobile redesign
 *
 * Layout: Date+Weather widgets → Morning briefing → Conversation history → Input bar
 */

import { useState, useMemo, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Sparkles, ArrowUp, Mic, Cloud, Sun, CloudRain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ── Date Widget ──────────────────────────────────────────────
function DateWidget({ locale, language }: { locale: Locale; language: string }) {
  const now = new Date();
  const dayOfWeek = format(now, 'EEEE', { locale });
  const dayNum = format(now, 'd');
  const yearMonth = language === 'ko'
    ? format(now, 'yyyy년 M월', { locale })
    : format(now, 'MMMM yyyy', { locale });

  return (
    <div className="flex-1 bg-slate-900/90 dark:bg-slate-950 rounded-2xl p-4 flex flex-col justify-between min-h-[120px]">
      <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{dayOfWeek}</span>
      <span className="text-[42px] font-bold text-white leading-none tracking-tight">{dayNum}</span>
      <span className="text-[11px] text-white/40">{yearMonth}</span>
    </div>
  );
}

// ── Weather Widget ───────────────────────────────────────────
function WeatherWidget({ language }: { language: string }) {
  // Static weather display — can be wired to a real weather service later
  const city = language === 'ko' ? '서울' : 'Seoul';
  const temp = '12°';
  const high = '15°';
  const low = '4°';
  const status = language === 'ko' ? '구름 조금' : 'Partly Cloudy';

  return (
    <div className="flex-1 bg-slate-900/90 dark:bg-slate-950 rounded-2xl p-4 flex flex-col justify-between min-h-[120px]">
      <span className="text-xs font-medium text-white/50">{city}</span>
      <div className="flex items-end gap-2">
        <span className="text-[42px] font-bold text-white leading-none tracking-tight">{temp}</span>
        <Cloud className="w-6 h-6 text-white/40 mb-1.5" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-white/40">{status}</span>
        <span className="text-[11px] text-white/25">H:{high} L:{low}</span>
      </div>
    </div>
  );
}

// ── Morning Briefing Card ────────────────────────────────────
function MorningBriefing({
  greeting,
  todayEvents,
  language,
  locale,
}: {
  greeting: string;
  todayEvents: Array<{ id: string; title: string; startAt: string; location?: string }>;
  language: string;
  locale: Locale;
}) {
  const topEvent = todayEvents[0];

  return (
    <div className="bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h2 className="text-lg font-bold text-foreground">{greeting} ✋</h2>
      </div>

      <p className="text-xs font-medium text-slate-500 dark:text-white/40 uppercase tracking-wider mb-2">
        {language === 'ko' ? '오늘의 일정' : "Today's Schedule"}
      </p>

      {topEvent ? (
        <div className="rounded-xl bg-slate-100/80 dark:bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800 dark:text-white/80">{topEvent.title}</span>
            <span className="text-xs text-slate-500 dark:text-white/30 font-mono">
              {format(parseISO(topEvent.startAt), 'HH:mm')}
            </span>
          </div>
          {topEvent.location && (
            <p className="text-xs text-slate-400 dark:text-white/25 mt-1">📍 {topEvent.location}</p>
          )}
          <p className="text-xs text-slate-500 dark:text-white/35 mt-1.5">
            {todayEvents.length > 1
              ? (language === 'ko'
                ? `외 ${todayEvents.length - 1}개 일정이 있어요`
                : `+${todayEvents.length - 1} more event${todayEvents.length - 1 > 1 ? 's' : ''} today`)
              : (language === 'ko' ? '오늘 유일한 일정이에요' : 'Only event today')}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-400 dark:text-white/30">
          {language === 'ko' ? '오늘은 일정이 없어요 🎉' : 'No events today 🎉'}
        </p>
      )}
    </div>
  );
}

// ── Conversation History ─────────────────────────────────────
function ConversationHistory({ messages, language }: { messages: ChatMessage[]; language: string }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const recent = messages.slice(-3);

  if (recent.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-4">
        <p className="text-xs text-slate-400 dark:text-white/25 text-center">
          {language === 'ko' ? 'Brain AI와 대화를 시작해보세요' : 'Start a conversation with Brain AI'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-400 dark:text-white/30 uppercase tracking-wider mb-1">
        {language === 'ko' ? '최근 대화' : 'Recent'}
      </p>
      {recent.map((msg, i) => {
        const isExpanded = expandedIdx === i;
        return (
          <button
            key={i}
            onClick={() => setExpandedIdx(isExpanded ? null : i)}
            className={cn(
              'w-full text-left rounded-xl p-3 transition-all',
              msg.role === 'user'
                ? 'bg-slate-100/80 dark:bg-white/5'
                : 'bg-white/60 dark:bg-white/[0.03] border border-white/10 dark:border-white/5'
            )}
          >
            <div className="flex items-center gap-2 mb-0.5">
              {msg.role === 'assistant' && <Sparkles className="w-3 h-3 text-amber-500" />}
              <span className="text-[10px] text-slate-400 dark:text-white/25">
                {format(msg.timestamp, 'HH:mm')}
              </span>
            </div>
            <p className={cn(
              'text-[13px] leading-relaxed',
              msg.role === 'user' ? 'text-slate-700 dark:text-white/60' : 'text-slate-600 dark:text-white/50',
              !isExpanded && 'line-clamp-2'
            )}>
              {msg.content}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export function MobileAIChatView() {
  const { events, currentUser } = useAppStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const todayEvents = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    return events
      .filter(e => {
        try {
          const s = parseISO(e.startAt);
          return !isBefore(s, dayStart) && !isAfter(s, dayEnd);
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [events]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = currentUser?.name?.split(' ')[0] || '';
    if (hour < 12) return language === 'ko' ? `좋은 아침, ${name}` : `Good Morning, ${name}`;
    if (hour < 18) return language === 'ko' ? `안녕, ${name}` : `Good Afternoon, ${name}`;
    return language === 'ko' ? `좋은 저녁, ${name}` : `Good Evening, ${name}`;
  }, [currentUser, language]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { processMessageWithLLM } = await import('@/services/brainService');
      const userId = currentUser?.id || '';
      const result = await processMessageWithLLM({
        messageContent: msg,
        userId,
        chatMembers: [],
        language,
      });
      const reply = result.llmResponse?.replyMessage || (language === 'ko' ? '처리 완료' : 'Done');
      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date() }]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : (language === 'ko' ? '오류가 발생했습니다.' : 'An error occurred.');
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentUser, language]);

  return (
    <div className="relative flex flex-col h-full bg-background">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-20">
        {/* Widget row: Date + Weather */}
        <div className="flex gap-3 mb-4">
          <DateWidget locale={locale} language={language} />
          <WeatherWidget language={language} />
        </div>

        {/* Morning Briefing */}
        <div className="mb-4">
          <MorningBriefing
            greeting={greeting}
            todayEvents={todayEvents}
            language={language}
            locale={locale}
          />
        </div>

        {/* Conversation History */}
        <ConversationHistory messages={messages} language={language} />
      </div>

      {/* Fixed Input Bar */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 pt-2 bg-background/80 backdrop-blur-lg">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 shadow-sm">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder={language === 'ko' ? 'Brain AI에게 물어보세요...' : 'Ask Brain AI...'}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none"
            disabled={loading}
          />
          <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/50 transition-colors">
            <Mic className="w-4 h-4" />
          </button>
          {(input.trim() || loading) && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                loading
                  ? 'bg-slate-300 dark:bg-white/20 animate-pulse'
                  : 'bg-primary text-primary-foreground'
              )}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MobileAIChatView;
