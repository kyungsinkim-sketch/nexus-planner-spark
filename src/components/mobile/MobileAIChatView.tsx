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
import { Brain, Send, Loader2, Mic, Cloud, Sun, CloudRain, CheckCircle2, Clock as ClockIcon, XCircle, MessageSquare, Bell, ChevronRight, Hash, AtSign, Sparkles, ListTodo, Calendar as CalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WEATHER_CITIES, CONDITION_ICONS, CONDITION_COLORS, CONDITION_LABELS_KO, CONDITION_LABELS_EN, generateForecast } from '@/components/widgets/weatherUtils';
import type { AppNotification } from '@/types/core';

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

// ── Updates Widget (replaces Today's Schedule) ───────────────

interface UpdateItem {
  id: string;
  kind: 'event' | 'todo' | 'notif';
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle?: string;
  time?: string;
  onClick?: () => void;
}

function UpdatesWidget({
  notifications,
  todayEvents,
  pendingTodos,
  language,
  onNotifClick,
  onEventClick,
}: {
  notifications: AppNotification[];
  todayEvents: Array<{ id: string; title: string; startAt: string }>;
  pendingTodos: Array<{ id: string; title: string; dueDate: string; priority: string; projectId?: string }>;
  language: string;
  onNotifClick: (n: AppNotification) => void;
  onEventClick?: () => void;
}) {
  const items = useMemo<UpdateItem[]>(() => {
    const result: UpdateItem[] = [];

    // Today's events
    for (const ev of todayEvents) {
      let timeStr = '';
      try { timeStr = format(parseISO(ev.startAt), 'HH:mm'); } catch (_) { /* ignore */ }
      result.push({
        id: `ev-${ev.id}`,
        kind: 'event',
        icon: <CalIcon className="w-3.5 h-3.5 text-purple-400/70" />,
        iconBg: 'bg-purple-500/10',
        title: ev.title || (language === 'ko' ? '일정' : 'Event'),
        subtitle: timeStr,
        time: timeStr,
        onClick: onEventClick,
      });
    }

    // Pending todos (due today or overdue, max 5)
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const dueToday = pendingTodos
      .filter(t => t.dueDate === todayStr)
      .slice(0, 5);
    for (const todo of dueToday) {
      result.push({
        id: `todo-${todo.id}`,
        kind: 'todo',
        icon: <ListTodo className="w-3.5 h-3.5 text-emerald-400/70" />,
        iconBg: 'bg-emerald-500/10',
        title: todo.title,
        subtitle: language === 'ko' ? '오늘까지' : 'Due today',
      });
    }

    // Remaining pending todos (not due today/overdue) — up to 3
    const upcoming = pendingTodos
      .filter(t => t.dueDate > todayStr)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);
    for (const todo of upcoming) {
      result.push({
        id: `todo-${todo.id}`,
        kind: 'todo',
        icon: <ListTodo className="w-3.5 h-3.5 text-emerald-400/60" />,
        iconBg: 'bg-emerald-500/10',
        title: todo.title,
        subtitle: todo.dueDate,
      });
    }

    // Unread notifications (chat messages etc.)
    for (const notif of notifications) {
      let icon: React.ReactNode = <Bell className="w-3.5 h-3.5 text-muted-foreground/40" />;
      let bg = 'bg-muted/50';
      if (notif.type === 'chat') { icon = <MessageSquare className="w-3.5 h-3.5 text-blue-400/60" />; bg = 'bg-blue-500/10'; }
      else if (notif.type === 'todo') { icon = <ListTodo className="w-3.5 h-3.5 text-emerald-400/60" />; bg = 'bg-emerald-500/10'; }
      else if (notif.type === 'event') { icon = <CalIcon className="w-3.5 h-3.5 text-purple-400/60" />; bg = 'bg-purple-500/10'; }
      else if (notif.type === 'brain') { icon = <Sparkles className="w-3.5 h-3.5 text-amber-400/60" />; bg = 'bg-amber-500/10'; }
      result.push({
        id: `notif-${notif.id}`,
        kind: 'notif',
        icon,
        iconBg: bg,
        title: notif.title,
        subtitle: notif.message,
        onClick: () => onNotifClick(notif),
      });
    }

    return result;
  }, [todayEvents, pendingTodos, notifications, language, onNotifClick, onEventClick]);

  const totalCount = items.length;

  return (
    <div className="mobile-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-muted-foreground/50" />
        <h3 className="typo-h4 font-bold text-foreground">
          {language === 'ko' ? '업데이트' : 'Updates'}
        </h3>
        {totalCount > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
            {totalCount}
          </span>
        )}
      </div>

      {totalCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === 'ko' ? '조용한 하루예요 ✨' : 'All quiet today ✨'}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              className="w-full rounded-xl p-2.5 flex items-start gap-2.5 active:bg-accent/50 transition-colors text-left"
              onClick={item.onClick}
            >
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', item.iconBg)}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground/70 truncate">{item.title}</p>
                {item.subtitle && (
                  <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">{item.subtitle}</p>
                )}
              </div>
              {item.time ? (
                <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0 mt-1">{item.time}</span>
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 shrink-0 mt-1" />
              )}
            </button>
          ))}
        </div>
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

// ── Suggestion types for Universal Chat Bar ──────────────────

interface SuggestionItem {
  type: 'user' | 'project' | 'group' | 'brain';
  id: string;
  name: string;
  avatar?: string;
  keyColor?: string;
  roomId?: string;
}

export function MobileAIChatView() {
  const { events, currentUser, users, projects, loadEvents, loadTodos, addTodo, chatRooms, appNotifications, personalTodos } = useAppStore();
  const { openMobileDm, openMobileGroupChat, openProjectTab, setActiveTab } = useWidgetStore();
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
  const loadBrainHistory = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const { getDirectMessages } = await import('@/services/chatService');
      const history = await getDirectMessages(currentUser.id, BRAIN_BOT_ID);
      if (history.length > 0) {
        const recent = history.slice(-10);
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
  }, [currentUser?.id]);

  useEffect(() => {
    loadBrainHistory();
  }, [loadBrainHistory]);

  // Realtime subscription for Brain AI DM messages
  useEffect(() => {
    if (!currentUser?.id) return;
    let channel: ReturnType<typeof import('@/lib/supabase').supabase.channel> | null = null;

    import('@/lib/supabase').then(({ supabase, isSupabaseConfigured }) => {
      if (!isSupabaseConfigured()) return;
      channel = supabase
        .channel('brain_ai_dm_sync')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `direct_chat_user_id=eq.${currentUser.id}`,
        }, (payload) => {
          const msg = payload.new as Record<string, unknown>;
          // Only process Brain AI messages (not our own)
          if (msg.user_id === BRAIN_BOT_ID) {
            const newMsg: ChatMessage = {
              id: msg.id as string,
              role: 'assistant',
              content: msg.content as string,
              timestamp: new Date(msg.created_at as string),
            };
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            setHistoryLoaded(true);
          }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_id=eq.${currentUser.id}`,
        }, (payload) => {
          const msg = payload.new as Record<string, unknown>;
          // Only process DMs to Brain AI from other devices
          if (msg.direct_chat_user_id === BRAIN_BOT_ID) {
            const newMsg: ChatMessage = {
              id: msg.id as string,
              role: 'user',
              content: msg.content as string,
              timestamp: new Date(msg.created_at as string),
            };
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            setHistoryLoaded(true);
          }
        })
        .subscribe();
    }).catch(() => { /* supabase import failed */ });

    return () => {
      if (channel) {
        import('@/lib/supabase').then(({ supabase }) => {
          supabase.removeChannel(channel!);
        }).catch(() => { /* cleanup */ });
      }
    };
  }, [currentUser?.id]);

  // Reload events, todos, and brain history on mount + visibility change + focus
  useEffect(() => {
    loadEvents().catch(() => {});
    loadTodos().catch(() => {});

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadEvents().catch(() => {});
        loadTodos().catch(() => {});
        loadBrainHistory();
      }
    };
    const handleFocus = () => {
      loadEvents().catch(() => {});
      loadTodos().catch(() => {});
      loadBrainHistory();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadEvents, loadTodos, loadBrainHistory]);

  // iOS keyboard: track visual viewport height for fixed layout
  const [viewH, setViewH] = useState(() => window.visualViewport?.height || window.innerHeight);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setViewH(vv.height);
      // Prevent iOS body scroll
      window.scrollTo(0, 0);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  useTypingReveal(messages, setMessages);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, loading]);

  const todayEvents = useMemo(() => {
    const now = new Date();
    const myId = currentUser?.id;
    return events
      .filter(e => {
        try {
          const s = parseISO(e.startAt);
          if (isBefore(s, startOfDay(now)) || isAfter(s, endOfDay(now))) return false;
          // Only show events owned by or attended by current user
          if (!myId) return false;
          if (e.ownerId === myId) return true;
          if (e.attendeeIds?.includes(myId)) return true;
          return false;
        } catch (_e) { return false; }
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [events, currentUser?.id]);

  // ── Notifications (unread + todos + today events) ──
  // ── Updates: chat messages, todo alerts, brain suggestions, emails ──
  const unreadNotifs = useMemo(() => {
    if (!appNotifications) return [];
    return appNotifications.filter(n => !n.read).slice(0, 10);
  }, [appNotifications]);

  const pendingTodos = useMemo(() => {
    if (!personalTodos) return [];
    return personalTodos
      .filter(t => t.status !== 'done' && t.status !== 'cancelled')
      .map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority, projectId: t.projectId }));
  }, [personalTodos]);

  const handleNotifClick = useCallback((notif: AppNotification) => {
    try {
      if (notif.directUserId) {
        openMobileDm(notif.directUserId);
      } else if (notif.roomId) {
        openMobileGroupChat(notif.roomId);
      } else if (notif.projectId && projects) {
        const project = projects.find(p => p.id === notif.projectId);
        if (project) {
          openProjectTab(project.id, project.title || '', project.keyColor);
          setActiveTab(project.id);
        }
      }
    } catch (err) {
      console.error('[MobileAI] Notif click error:', err);
    }
  }, [projects, openMobileDm, openMobileGroupChat, openProjectTab, setActiveTab]);

  // ── Universal Chat Bar: # @ suggestions ──
  const [selectedTarget, setSelectedTarget] = useState<SuggestionItem | null>(null);
  const [chatSuggestions, setChatSuggestions] = useState<SuggestionItem[]>([]);
  const [showChatSuggestions, setShowChatSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);

  const brainAgent: SuggestionItem = useMemo(() => ({
    type: 'brain' as const, id: BRAIN_BOT_ID, name: 'Brain AI',
  }), []);

  const allUserSuggestions = useMemo(() => {
    if (!users) return [];
    return users
      .filter(u => u.id !== currentUser?.id && u.id !== BRAIN_BOT_ID)
      .map(u => ({ type: 'user' as const, id: u.id, name: u.name || '', avatar: u.avatar }));
  }, [users, currentUser]);

  const allChannelSuggestions = useMemo(() => {
    const items: SuggestionItem[] = [];
    if (projects) {
      for (const p of projects) {
        if (p.status === 'ACTIVE' || p.status === 'IN_PROGRESS' || p.status === 'PLANNING') {
          const room = chatRooms?.find(r => r.projectId === p.id);
          items.push({ type: 'project', id: p.id, name: p.title || '', keyColor: p.keyColor, roomId: room?.id });
        }
      }
    }
    if (chatRooms) {
      for (const r of chatRooms) {
        if (r.type === 'group') {
          items.push({ type: 'group', id: r.id, name: r.name || 'Group', roomId: r.id });
        }
      }
    }
    return items;
  }, [projects, chatRooms]);

  const handleUniversalInputChange = useCallback((value: string) => {
    setInput(value);
    const words = value.split(' ');
    const lastWord = words[words.length - 1] || '';

    if (lastWord.startsWith('#')) {
      const q = lastWord.slice(1).toLowerCase();
      const f = allChannelSuggestions.filter(s => s.name.toLowerCase().includes(q));
      setChatSuggestions(f);
      setShowChatSuggestions(f.length > 0);
      setSuggestionIndex(-1);
    } else if (lastWord.startsWith('@')) {
      const q = lastWord.slice(1).toLowerCase();
      const f = [brainAgent, ...allUserSuggestions].filter(s => s.name.toLowerCase().includes(q));
      setChatSuggestions(f);
      setShowChatSuggestions(f.length > 0);
      setSuggestionIndex(-1);
    } else {
      setShowChatSuggestions(false);
      setSuggestionIndex(-1);
    }
  }, [allChannelSuggestions, allUserSuggestions, brainAgent]);

  const handleSelectTarget = useCallback((item: SuggestionItem) => {
    setSelectedTarget(item);
    setShowChatSuggestions(false);
    // Remove the #/@ trigger word
    const words = input.split(' ');
    words.pop();
    setInput(words.join(' '));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input]);

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

    // If target is not Brain AI, send to that target and navigate
    const target = selectedTarget;
    if (target && target.type !== 'brain') {
      try {
        if (target.type === 'user') {
          const { sendDirectMessage } = await import('@/services/chatService');
          await sendDirectMessage(currentUser.id, target.id, msg);
          setSelectedTarget(null);
          // Small delay to let DB write propagate before loading chat
          await new Promise(r => setTimeout(r, 300));
          openMobileDm(target.id);
          return;
        } else if (target.roomId) {
          const { sendRoomMessage } = await import('@/services/chatService');
          await sendRoomMessage(target.roomId, currentUser.id, msg);
          setSelectedTarget(null);
          await new Promise(r => setTimeout(r, 300));
          openMobileGroupChat(target.roomId);
          return;
        }
      } catch (err) {
        console.error('[UniversalChat] Send error:', err);
        // Show error in chat
        setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: language === 'ko' ? `메시지 전송 실패: ${(err as Error).message}` : `Message send failed: ${(err as Error).message}`, timestamp: new Date(), revealed: 0 }]);
        return;
      }
    }
    // Clear target (Brain AI or no target = Brain AI)
    setSelectedTarget(null);

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
      const brainService = await import('@/services/brainService');
      const result = await brainService.processMessageWithLLM({
        messageContent: msg,
        userId: currentUser.id,
        directChatUserId: BRAIN_BOT_ID,
        chatMembers: [],
        language,
      });
      const reply = result.llmResponse?.replyMessage || (language === 'ko' ? '처리 완료' : 'Done');
      const brainActions = result.llmResponse?.suggestedActions || [];
      const actions: BrainAction[] = brainActions.map((a: any) => ({
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

      // Auto-execute brain actions (calendar events, todos, etc.)
      if (brainActions.length > 0) {
        const botMsgDbId = (result.message as any)?.id || brainMsgId;
        try {
          const dbActions = await brainService.getActionsByMessage(botMsgDbId);
          for (const action of dbActions) {
            if (action.status === 'pending' || action.status === 'confirmed') {
              try {
                await brainService.executeAction(action.id, currentUser.id);
                // Update action display status
                setMessages(prev => prev.map(m => {
                  if (m.id === brainMsgId && m.actions) {
                    return { ...m, actions: m.actions.map(a =>
                      a.type === action.actionType ? { ...a, status: 'executed' } : a
                    )};
                  }
                  return m;
                }));
              } catch (execErr) {
                console.error('[BrainChat] Action exec failed:', execErr);
              }
            }
          }
        } catch (e) { console.error('[BrainChat] getActionsByMessage failed:', e); }

        // Reload events and todos to reflect changes
        await loadEvents().catch(() => { /* best-effort */ });
        await loadTodos().catch(() => { /* best-effort */ });
      }
    } catch (err: unknown) {
      const errContent = err instanceof Error ? err.message : 'Error';
      setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: errContent, timestamp: new Date(), revealed: 0 }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, currentUser, language]);

  const formatTime = (d: Date) => d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed top-0 left-0 right-0 flex flex-col widget-area-bg overflow-hidden" style={{ height: `${viewH}px` }}>
      {/* ═══ Single scrollable area: cards + messages in one flow ═══ */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col" style={{ overscrollBehavior: 'none' }}>
        {/* ── Profile Card + Updates ── */}
        <div className="shrink-0 px-4 pt-6 pb-2">
          <ProfileCard user={currentUser} language={language} projects={projects} onProjectsClick={() => useWidgetStore.getState().setMobileView('projects')} />
          <div className="mt-4">
            <UpdatesWidget
              notifications={unreadNotifs}
              todayEvents={todayEvents}
              pendingTodos={pendingTodos}
              language={language}
              onNotifClick={handleNotifClick}
              onEventClick={() => useWidgetStore.getState().setMobileView('calendar')}
            />
          </div>
        </div>

        {/* ── Chat messages: same scroll context, fade mask at top ── */}
        <div
          className="flex-1 flex flex-col px-4 relative"
          style={{
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 48px)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 48px)',
          }}
        >
          <div className="space-y-2.5 mt-auto">
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

      {/* ═══ Universal Chat Bar — flex bottom, above nav ═══ */}
      <div
        className="shrink-0 px-4 py-2 pb-[calc(64px+env(safe-area-inset-bottom,0px))]"
      >
        {/* Selected target badge */}
        {selectedTarget && (
          <div className="flex items-center gap-1.5 mb-1.5 px-2">
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
              selectedTarget.type === 'brain' ? 'bg-amber-500/20 text-amber-300' :
              selectedTarget.type === 'user' ? 'bg-blue-500/20 text-blue-300' :
              'bg-emerald-500/20 text-emerald-300'
            )}>
              {selectedTarget.type === 'brain' ? <Sparkles className="w-3 h-3" /> :
               selectedTarget.type === 'user' ? <AtSign className="w-3 h-3" /> :
               <Hash className="w-3 h-3" />}
              {selectedTarget.name}
            </span>
            <button onClick={() => setSelectedTarget(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
        )}

        {/* Autocomplete dropdown (above input) */}
        {showChatSuggestions && chatSuggestions.length > 0 && (
          <div className="mb-1.5 rounded-2xl border border-border/50 bg-popover shadow-lg overflow-hidden max-h-[240px] overflow-y-auto">
            {chatSuggestions.map((item, idx) => (
              <button
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelectTarget(item)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent active:bg-accent/80 transition-colors text-left",
                  idx === suggestionIndex && "bg-accent"
                )}
              >
                {item.type === 'brain' ? (
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                ) : item.type === 'user' ? (
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-[11px] font-bold text-blue-300 overflow-hidden">
                    {item.avatar ? <img src={item.avatar} className="w-7 h-7 rounded-full object-cover" alt="" /> : (item.name || '?').charAt(0)}
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: item.keyColor ? `${item.keyColor}30` : 'rgba(128,128,128,0.15)' }}>
                    <Hash className="w-3.5 h-3.5" style={{ color: item.keyColor || 'rgba(128,128,128,0.6)' }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground/70 truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground/50">
                    {item.type === 'brain' ? 'AI Agent' :
                     item.type === 'user' ? (language === 'ko' ? '개인 메시지' : 'Direct message') :
                     item.type === 'project' ? (language === 'ko' ? '프로젝트' : 'Project') :
                     (language === 'ko' ? '그룹' : 'Group')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full mobile-glass shadow-lg">
          {selectedTarget ? (
            selectedTarget.type === 'brain' ? <Sparkles className="w-4 h-4 text-amber-400 shrink-0" /> :
            selectedTarget.type === 'user' ? <AtSign className="w-4 h-4 text-blue-400 shrink-0" /> :
            <Hash className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Brain className="w-4 h-4 text-violet-500 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => handleUniversalInputChange(e.target.value)}
            onKeyDown={e => {
              if (showChatSuggestions && chatSuggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSuggestionIndex(prev => (prev + 1) % chatSuggestions.length);
                  return;
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSuggestionIndex(prev => prev <= 0 ? chatSuggestions.length - 1 : prev - 1);
                  return;
                } else if (e.key === 'Enter' && suggestionIndex >= 0) {
                  e.preventDefault();
                  handleSelectTarget(chatSuggestions[suggestionIndex]);
                  return;
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setShowChatSuggestions(false);
                  setSuggestionIndex(-1);
                  return;
                }
              }
              if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
            }}
            onFocus={() => { /* no-op: body overflow hidden prevents scroll */ }}
            placeholder={
              selectedTarget
                ? (language === 'ko' ? `${selectedTarget.name}에게 메시지...` : `Message ${selectedTarget.name}...`)
                : (language === 'ko' ? '# 채널  @ 사람  메시지 입력...' : '# channel  @ person  type a message...')
            }
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
