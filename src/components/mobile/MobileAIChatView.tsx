/**
 * MobileAIChatView — AI Chat tab (Tab 1) for Re-Be.io Phase 3 mobile redesign
 *
 * Layout (fixed zones, top to bottom):
 * ┌─────────────────────────────┐
 * │  Date + Weather (dark card) │  ← sticky top
 * │  Morning Briefing           │  ← sticky below widgets
 * │  ─── fade gradient ───      │  ← mask: old messages fade behind briefing
 * │  Brain AI messages ↑↑↑      │  ← scrolls UP, newest at bottom
 * │  [Input bar]                │  ← fixed above bottom nav
 * └─────────────────────────────┘
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Brain, Send, Loader2, Mic, Cloud, Sun, CloudRain, CheckCircle2, Clock as ClockIcon, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WEATHER_CITIES, CONDITION_ICONS, CONDITION_COLORS, CONDITION_LABELS_KO, CONDITION_LABELS_EN, generateForecast } from '@/components/widgets/weatherUtils';

// ── Types ────────────────────────────────────────────────────

interface BrainAction {
  type: string;
  title: string;
  status: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: BrainAction[];
  revealed?: number;
}

// ── Date Widget (desktop-matching dark card) ─────────────────

function DateWidget({ language }: { language: string }) {
  const now = new Date();
  const dayOfWeek = new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', { weekday: 'long' }).format(now);
  const dateNumber = now.getDate();
  const monthYear = new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', { month: 'long', year: 'numeric' }).format(now);

  return (
    <div className="flex-1 flex flex-col items-center justify-center rounded-2xl date-gradient-bg p-4 min-h-[120px]">
      <p className="text-xs font-bold tracking-wider uppercase text-red-400">{dayOfWeek}</p>
      <span className="text-5xl font-extralight text-white tabular-nums leading-none mt-1">{dateNumber}</span>
      <p className="text-xs text-white/60 mt-2">{monthYear}</p>
    </div>
  );
}

// ── Weather Widget (desktop-matching dark card) ──────────────

function WeatherWidget({ language }: { language: string }) {
  const { widgetSettings } = useAppStore();
  const cityKey = (widgetSettings?.weather?.city as string) || 'seoul';
  const cityDef = useMemo(() => WEATHER_CITIES.find(c => c.key === cityKey) || WEATHER_CITIES[0], [cityKey]);
  const forecast = useMemo(() => generateForecast(cityKey, cityDef.lat), [cityKey, cityDef.lat]);
  const today = forecast[0];
  const TodayIcon = CONDITION_ICONS[today.condition];
  const condLabel = language === 'ko' ? CONDITION_LABELS_KO[today.condition] : CONDITION_LABELS_EN[today.condition];
  const cityLabel = language === 'ko' ? cityDef.labelKo : cityDef.labelEn;

  return (
    <div className="flex-1 flex flex-col items-center justify-center rounded-2xl weather-gradient-bg p-4 min-h-[120px]">
      <p className="text-xs font-semibold text-white/90 mb-1">{cityLabel}</p>
      <span className="text-5xl font-light text-white tabular-nums leading-none">{today.high}°</span>
      <div className="flex items-center gap-2 mt-2">
        <TodayIcon className={`w-4 h-4 ${CONDITION_COLORS[today.condition]}`} />
        <span className="text-xs text-white/80">{condLabel}</span>
      </div>
      <span className="text-[10px] text-white/50 mt-1">
        H:{today.high}° L:{today.low}°
      </span>
    </div>
  );
}

// ── Profile Card (replaces Date/Weather widgets) ─────────────

function ProfileCard({
  user,
  language,
  projects,
  onProjectsClick,
}: {
  user: ReturnType<typeof useAppStore>['currentUser'];
  language: string;
  projects: ReturnType<typeof useAppStore>['projects'];
  onProjectsClick?: () => void;
}) {
  const activeProjectCount = projects.filter(p => p.status === 'ACTIVE').length;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(145deg, #0C0A1E 0%, #1a1535 50%, #0C0A1E 100%)' }}>
      {/* Header: logo left, company name right */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <img src="/loading-star.png" alt="Re-Be" className="w-7 h-7" />
          <div>
            <p className="text-[10px] text-[#C5C0E8]/60 tracking-wide">Re-Be.io</p>
            <p className="text-xs font-semibold text-white/90">Creative Identity</p>
          </div>
        </div>
        {user?.organizationName && (
          <span className="text-[11px] font-semibold text-[#C5C0E8]/50 tracking-widest uppercase" style={{ fontFamily: 'Pretendard Variable, Pretendard, sans-serif' }}>
            {user.organizationName.replace(/\s*(Co\.,?\s*Ltd\.?|Inc\.?|Corp\.?|LLC)\s*/i, '').trim().toUpperCase()}
          </span>
        )}
      </div>

      {/* User photo center */}
      <div className="flex flex-col items-center py-4">
        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#C5C0E8]/20 bg-white/10 flex items-center justify-center">
          {user?.avatar ? (
            <img src={user.avatar} alt={user?.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl text-white/60">{user?.name?.[0] || '?'}</span>
          )}
        </div>

        {/* Name */}
        <h3 className="text-lg font-bold text-white mt-3">{user?.name || 'User'}</h3>

        {/* Title */}
        <p className="text-sm text-[#C5C0E8]/70 mt-0.5">
          {user?.position || ''}
        </p>

        {/* Department */}
        {user?.team && (
          <p className="text-xs text-[#C5C0E8]/50 mt-0.5">{user.team}</p>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-around px-4 py-3 border-t border-white/5">
        <button onClick={onProjectsClick} className="flex items-center gap-1.5 active:opacity-60 transition-opacity">
          <span className="text-[10px] text-white/40">📁</span>
          <span className="text-xs font-medium text-white/70">{activeProjectCount} Projects</span>
        </button>
        {user?.department && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/40">✦</span>
            <span className="text-xs font-medium text-[#C5C0E8]/70">{user.department}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Morning Briefing ─────────────────────────────────────────

function MorningBriefing({
  greeting, todayEvents, language, locale,
}: {
  greeting: string;
  todayEvents: Array<{ id: string; title: string; startAt: string; location?: string }>;
  language: string;
  locale: Locale;
}) {
  const topEvent = todayEvents[0];
  return (
    <div className="mobile-glass rounded-2xl p-5">
      <h2 className="typo-h2 font-bold text-foreground mb-1">{greeting} ✋</h2>
      <h3 className="typo-h4 font-bold text-foreground mt-5 mb-3">
        {language === 'ko' ? '오늘의 일정' : "Today's Schedule"}
      </h3>
      {topEvent ? (
        <div className="rounded-xl bg-accent/50 dark:bg-white/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{topEvent.title}</span>
            <span className="text-xs text-muted-foreground font-mono">
              {format(parseISO(topEvent.startAt), 'HH:mm')}
            </span>
          </div>
          {topEvent.location && <p className="text-xs text-muted-foreground mt-1">📍 {topEvent.location}</p>}
          <p className="text-xs text-muted-foreground mt-1.5">
            {todayEvents.length > 1
              ? (language === 'ko' ? `외 ${todayEvents.length - 1}개 일정이 있어요` : `+${todayEvents.length - 1} more events today`)
              : (language === 'ko' ? '오늘 유일한 일정이에요' : 'Only event today')}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {language === 'ko' ? '오늘은 일정이 없어요 🎉' : 'No events today 🎉'}
        </p>
      )}
    </div>
  );
}

// ── Typing animation hook ────────────────────────────────────

function useTypingReveal(messages: ChatMessage[], setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const pending = messages.find(
      m => m.role === 'assistant' && m.revealed !== undefined && m.revealed < m.content.length,
    );
    if (!pending) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === pending.id);
        if (idx === -1) return prev;
        const msg = prev[idx];
        if (msg.revealed === undefined || msg.revealed >= msg.content.length) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          return prev;
        }
        const step = Math.min(3, msg.content.length - msg.revealed);
        const updated = [...prev];
        updated[idx] = { ...msg, revealed: msg.revealed + step };
        if (updated[idx].revealed! >= msg.content.length) {
          updated[idx] = { ...msg, revealed: undefined };
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }
        return updated;
      });
    }, 25);

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [messages, setMessages]);
}

// ── Action helpers ───────────────────────────────────────────

function getActionStatusIcon(status: string) {
  switch (status) {
    case 'executed': return <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />;
    case 'failed': return <XCircle className="w-2.5 h-2.5 text-red-500" />;
    default: return <ClockIcon className="w-2.5 h-2.5 text-amber-500" />;
  }
}

function getActionTypeLabel(type: string) {
  switch (type) {
    case 'create_todo': return 'Todo';
    case 'create_event': return 'Event';
    case 'update_event': return 'Event Update';
    case 'create_board_task': return 'Board Task';
    default: return 'Action';
  }
}

// ── Main Component ───────────────────────────────────────────

export function MobileAIChatView() {
  const { events, currentUser, users, projects, loadEvents, loadTodos, addTodo } = useAppStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;
  // Seed messages — visual continuity (faded at top via CSS mask)
  const seedMessages = useMemo<ChatMessage[]>(() => {
    const now = new Date();
    const name = currentUser?.name?.split(' ')[0] || '';
    if (language === 'ko') {
      return [
        { id: 'seed_1', role: 'user', content: '오늘 일정 알려줘', timestamp: new Date(now.getTime() - 3600000) },
        { id: 'seed_2', role: 'assistant', content: `${name}님, 오늘 일정이 정리되었어요. 언제든 물어봐 주세요!`, timestamp: new Date(now.getTime() - 3500000), revealed: undefined },
      ];
    }
    return [
      { id: 'seed_1', role: 'user', content: "What's on my schedule today?", timestamp: new Date(now.getTime() - 3600000) },
      { id: 'seed_2', role: 'assistant', content: `${name}, your schedule is all set. Feel free to ask anytime!`, timestamp: new Date(now.getTime() - 3500000), revealed: undefined },
    ];
  }, [currentUser, language]);

  const BRAIN_BOT_ID = '00000000-0000-0000-0000-000000000099';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const allMessages = useMemo(() => historyLoaded ? messages : [...seedMessages, ...messages], [seedMessages, messages, historyLoaded]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load previous Brain AI conversation from DB
  useEffect(() => {
    if (!currentUser?.id) return;
    (async () => {
      try {
        const { getDirectMessages } = await import('@/services/chatService');
        const history = await getDirectMessages(currentUser.id, BRAIN_BOT_ID);
        if (history.length > 0) {
          // Show only the last 2 messages (1 user + 1 assistant typically)
          const recent = history.slice(-2);
          setMessages(recent.map(m => ({
            id: m.id,
            role: m.userId === BRAIN_BOT_ID ? 'assistant' as const : 'user' as const,
            content: m.content,
            timestamp: new Date(m.createdAt),
          })));
          setHistoryLoaded(true);
        }
      } catch (err) {
        console.error('[BrainChat] Failed to load history:', err);
      }
    })();
  }, [currentUser?.id]);

  // Track keyboard height via visualViewport
  const [kbBottom, setKbBottom] = useState<number | null>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const vv = window.visualViewport;
    const update = () => {
      if (vv && document.activeElement === el) {
        const kbHeight = window.innerHeight - vv.height - vv.offsetTop;
        setKbBottom(kbHeight > 50 ? kbHeight : null);
        document.body.classList.toggle('keyboard-open', kbHeight > 50);
      }
    };
    const onFocus = () => { if (vv) { vv.addEventListener('resize', update); vv.addEventListener('scroll', update); update(); } };
    const onBlur = () => setTimeout(() => { setKbBottom(null); document.body.classList.remove('keyboard-open'); if (vv) { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); } }, 100);
    el.addEventListener('focus', onFocus);
    el.addEventListener('blur', onBlur);
    return () => { el.removeEventListener('focus', onFocus); el.removeEventListener('blur', onBlur); document.body.classList.remove('keyboard-open'); if (vv) { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); } };
  }, []);

  useTypingReveal(messages, setMessages);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, loading]);

  const todayEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => { try { const s = parseISO(e.startAt); return !isBefore(s, startOfDay(now)) && !isAfter(s, endOfDay(now)); } catch { return false; } })
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
    if (!input.trim() || loading || !currentUser?.id) return;
    const msg = input.trim();
    setInput('');

    const userMsgId = `user_${Date.now()}`;
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: msg, timestamp: new Date() }]);
    setLoading(true);

    // Save user message to DB
    try {
      const { sendDirectMessage } = await import('@/services/chatService');
      const saved = await sendDirectMessage(currentUser.id, BRAIN_BOT_ID, msg);
      setMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, id: saved.id } : m));
    } catch (e) { console.error('[BrainChat] Save user msg failed:', e); }

    try {
      const { processMessageWithLLM } = await import('@/services/brainService');
      const result = await processMessageWithLLM({ messageContent: msg, userId: currentUser.id, chatMembers: [], language });
      const reply = result.llmResponse?.replyMessage || (language === 'ko' ? '처리 완료' : 'Done');
      const actions: BrainAction[] = (result.llmResponse?.suggestedActions || []).map((a: any) => ({
        type: a.type || 'unknown', title: a.title || a.content || '', status: a.status || 'pending',
      }));

      // Save Brain AI reply to DB
      let brainMsgId = `brain_${Date.now()}`;
      try {
        const { sendDirectMessage } = await import('@/services/chatService');
        const saved = await sendDirectMessage(BRAIN_BOT_ID, currentUser.id, reply);
        brainMsgId = saved.id;
      } catch (e) { console.error('[BrainChat] Save brain msg failed:', e); }

      setMessages(prev => [...prev, {
        id: brainMsgId, role: 'assistant', content: reply, timestamp: new Date(),
        actions: actions.length > 0 ? actions : undefined, revealed: 0,
      }]);
    } catch (err: unknown) {
      const errContent = err instanceof Error ? err.message : 'Error';
      setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: errContent, timestamp: new Date(), revealed: 0 }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentUser, language]);

  const formatTime = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="relative flex flex-col h-full widget-area-bg overflow-hidden">
      {/* ═══ Scrollable area: briefing at top, messages grow from bottom ═══ */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col" style={{ paddingBottom: '140px' }}>
        {/* ── Sticky header zone: Profile Card + Briefing ── */}
        <div className="shrink-0 px-4 pt-6 pb-2">
          <ProfileCard user={currentUser} language={language} projects={projects} onProjectsClick={() => useWidgetStore.getState().setMobileView('projects')} />
          <div className="mt-4">
            <MorningBriefing greeting={greeting} todayEvents={todayEvents} language={language} locale={locale} />
          </div>
        </div>

        {/* ── Chat messages: flex-1 pushes them to the bottom ── */}
        {/* CSS mask: messages fade to transparent at the top */}
        <div
          className={cn('flex-1 flex flex-col px-4 relative', 'justify-end')}
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 48px)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 48px)',
          }}
        >
          <div className="space-y-2.5">
            {allMessages.map((msg) => {
              const displayContent = msg.revealed !== undefined ? msg.content.slice(0, msg.revealed) : msg.content;
              const isTyping = msg.revealed !== undefined && msg.revealed < msg.content.length;

              return (
                <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2',
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-violet-50 dark:bg-violet-950/40 border border-violet-200/50 dark:border-violet-800/50 text-foreground',
                  )}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Brain className="w-3 h-3 text-violet-500" />
                        <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">Brain AI</span>
                      </div>
                    )}
                    <p className="text-[13px] leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {displayContent}
                      {isTyping && <span className="inline-block w-[2px] h-[14px] bg-violet-500 ml-0.5 animate-pulse align-text-bottom" />}
                    </p>
                    {msg.actions && msg.actions.length > 0 && !isTyping && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {msg.actions.map((action, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/80 dark:bg-white/10 border border-border/50 text-[10px] font-medium text-foreground/80">
                            {getActionStatusIcon(action.status)}
                            <span>{getActionTypeLabel(action.type)}</span>
                            {action.title && <span className="truncate max-w-[80px] text-muted-foreground">{action.title}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className={cn('block text-[10px] mt-1', msg.role === 'user' ? 'text-white/50' : 'text-muted-foreground/50')}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/50 dark:border-violet-800/50">
                  <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
                  <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                    {language === 'ko' ? 'Brain AI 생각 중...' : 'Brain AI is thinking...'}
                  </span>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      {/* ═══ Input bar — fixed above floating nav (or just above keyboard) ═══ */}
      <div
        className="fixed left-0 right-0 z-40 px-4 py-2"
        style={{ bottom: kbBottom != null ? `${kbBottom}px` : 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full mobile-glass shadow-lg">
          <Brain className="w-4 h-4 text-violet-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            onFocus={() => { window.scrollTo(0, 0); setTimeout(() => window.scrollTo(0, 0), 150); }}
            placeholder={language === 'ko' ? 'Brain AI에게 물어보세요...' : 'Ask Brain AI...'}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={loading}
          />
          <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0',
              loading ? 'bg-muted animate-pulse'
                : input.trim() ? 'bg-violet-500 text-white hover:bg-violet-600'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileAIChatView;
