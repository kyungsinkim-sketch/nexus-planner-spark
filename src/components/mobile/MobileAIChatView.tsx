/**
 * MobileAIChatView — AI Chat tab (Tab 1) for Re-Be.io Phase 3 mobile redesign
 *
 * Layout (top → bottom):
 * - Date + Weather widgets
 * - Morning Briefing (Today's Schedule)
 * - Brain AI conversation area (flex-1, scrollable)
 * - Input bar (fixed just above bottom nav)
 *
 * Brain AI messages use the same violet/Brain icon style as desktop BrainChatWidget.
 * Assistant messages appear with a typing animation.
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Brain, Send, Loader2, Mic, MicOff, Cloud, CheckCircle2, Clock as ClockIcon, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  /** For typing animation: how many chars are revealed so far */
  revealed?: number;
}

// ── Date Widget ──────────────────────────────────────────────

function DateWidget({ locale, language }: { locale: Locale; language: string }) {
  const now = new Date();
  return (
    <div className="flex-1 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between min-h-[120px]">
      <span className="text-xs font-semibold text-primary uppercase tracking-wide">
        {format(now, 'EEEE', { locale })}
      </span>
      <span className="text-[42px] font-bold text-foreground leading-none tracking-tight">
        {format(now, 'd')}
      </span>
      <span className="text-[11px] text-muted-foreground">
        {language === 'ko' ? format(now, 'yyyy년 M월', { locale }) : format(now, 'MMMM yyyy', { locale })}
      </span>
    </div>
  );
}

// ── Weather Widget ───────────────────────────────────────────

function WeatherWidget({ language }: { language: string }) {
  const city = language === 'ko' ? '서울' : 'Seoul';
  return (
    <div className="flex-1 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between min-h-[120px]">
      <span className="text-xs font-medium text-muted-foreground">{city}</span>
      <div className="flex items-end gap-2">
        <span className="text-[42px] font-bold text-foreground leading-none tracking-tight">12°</span>
        <Cloud className="w-6 h-6 text-muted-foreground mb-1.5" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">{language === 'ko' ? '구름 조금' : 'Partly Cloudy'}</span>
        <span className="text-[11px] text-muted-foreground/60">H:15° L:4°</span>
      </div>
    </div>
  );
}

// ── Morning Briefing ─────────────────────────────────────────

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
          {topEvent.location && (
            <p className="text-xs text-muted-foreground mt-1">📍 {topEvent.location}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1.5">
            {todayEvents.length > 1
              ? (language === 'ko'
                ? `외 ${todayEvents.length - 1}개 일정이 있어요`
                : `+${todayEvents.length - 1} more events today`)
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
    // Find first assistant message that isn't fully revealed
    const pending = messages.find(
      m => m.role === 'assistant' && m.revealed !== undefined && m.revealed < m.content.length,
    );
    if (!pending) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    if (intervalRef.current) return; // already running

    intervalRef.current = setInterval(() => {
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === pending.id);
        if (idx === -1) return prev;
        const msg = prev[idx];
        if (msg.revealed === undefined || msg.revealed >= msg.content.length) {
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
          return prev;
        }
        // Reveal 2-4 chars per tick for natural speed
        const step = Math.min(3, msg.content.length - msg.revealed);
        const updated = [...prev];
        updated[idx] = { ...msg, revealed: msg.revealed + step };
        if (updated[idx].revealed! >= msg.content.length) {
          updated[idx] = { ...msg, revealed: undefined }; // done
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }
        return updated;
      });
    }, 25); // ~40fps, 3 chars/tick ≈ 120 chars/sec

    return () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  }, [messages, setMessages]);
}

// ── Action helpers (same as desktop BrainChatWidget) ─────────

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
    case 'share_location': return 'Location';
    default: return 'Action';
  }
}

// ── Main Component ───────────────────────────────────────────

export function MobileAIChatView() {
  const { events, currentUser, users, projects, loadEvents, loadTodos, addTodo } = useAppStore();
  const { language } = useTranslation();
  const locale = language === 'ko' ? ko : enUS;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useTypingReveal(messages, setMessages);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const todayEvents = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    return events
      .filter(e => {
        try {
          const s = parseISO(e.startAt);
          return !isBefore(s, dayStart) && !isAfter(s, dayEnd);
        } catch { return false; }
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

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
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

      // Build action list from result
      const actions: BrainAction[] = [];
      if (result.llmResponse?.suggestedActions) {
        for (const a of result.llmResponse.suggestedActions) {
          actions.push({
            type: a.type || 'unknown',
            title: a.title || a.content || '',
            status: a.status || 'pending',
          });
        }
      }

      const assistantMsg: ChatMessage = {
        id: `brain_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
        actions: actions.length > 0 ? actions : undefined,
        revealed: 0, // start typing animation
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errContent = err instanceof Error ? err.message : (language === 'ko' ? '오류가 발생했습니다.' : 'An error occurred.');
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: errContent,
        timestamp: new Date(),
        revealed: 0,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentUser, language]);

  const formatTime = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full widget-area-bg">
      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-6 pb-16">
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

        {/* ── Brain AI Conversation ── */}
        <div className="space-y-2.5 pb-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/40 gap-2">
              <Brain className="w-8 h-8 text-violet-400/40" />
              <span className="text-xs font-medium text-muted-foreground/50">Brain AI</span>
            </div>
          )}

          {messages.map((msg) => {
            const displayContent = msg.revealed !== undefined
              ? msg.content.slice(0, msg.revealed)
              : msg.content;
            const isTyping = msg.revealed !== undefined && msg.revealed < msg.content.length;

            return (
              <div
                key={msg.id}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2',
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-violet-50 dark:bg-violet-950/40 border border-violet-200/50 dark:border-violet-800/50 text-foreground',
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Brain className="w-3 h-3 text-violet-500" />
                      <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                        Brain AI
                      </span>
                    </div>
                  )}
                  <p
                    className="text-[13px] leading-relaxed"
                    style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                  >
                    {displayContent}
                    {isTyping && (
                      <span className="inline-block w-[2px] h-[14px] bg-violet-500 ml-0.5 animate-pulse align-text-bottom" />
                    )}
                  </p>

                  {/* Action badges */}
                  {msg.actions && msg.actions.length > 0 && !isTyping && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.actions.map((action, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/80 dark:bg-white/10 border border-border/50 text-[10px] font-medium text-foreground/80"
                        >
                          {getActionStatusIcon(action.status)}
                          <span>{getActionTypeLabel(action.type)}</span>
                          {action.title && (
                            <span className="truncate max-w-[80px] text-muted-foreground">{action.title}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  <span className={cn(
                    'block text-[10px] mt-1',
                    msg.role === 'user' ? 'text-white/50' : 'text-muted-foreground/50',
                  )}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Processing indicator */}
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
        </div>
      </div>

      {/* ── Input bar (fixed just above bottom nav) ── */}
      <div className="fixed left-0 right-0 z-40 px-4 pb-2 pt-2" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px) + 8px)' }}>
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-sm">
          <Brain className="w-4 h-4 text-violet-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            placeholder={language === 'ko' ? 'Brain AI에게 물어보세요...' : 'Ask Brain AI...'}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={loading}
          />
          <button
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0',
              loading
                ? 'bg-muted animate-pulse'
                : input.trim()
                  ? 'bg-violet-500 text-white hover:bg-violet-600'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileAIChatView;
