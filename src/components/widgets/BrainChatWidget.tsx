/**
 * BrainChatWidget — Brain AI chat widget with conversation history.
 * Shows scrollable history of user/brain messages with action badges.
 * Input bar at bottom. Auto-scrolls on new messages.
 *
 * The widget's outer div is the drag handle (set by WidgetGrid).
 * The form area stops propagation so input interaction works normally.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Brain, Send, Loader2, CheckCircle2, Clock, XCircle, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import * as brainService from '@/services/brainService';
import { renderBrainMessage } from '@/lib/formatBrainMessage';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { WidgetDataContext } from '@/types/widget';

interface BrainHistoryAction {
  type: string;
  title: string;
  status: string;
}

interface BrainHistoryItem {
  id: string;
  type: 'user' | 'brain';
  content: string;
  timestamp: string;
  actions?: BrainHistoryAction[];
}

function BrainChatWidget({ context }: { context: WidgetDataContext }) {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<BrainHistoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false); // Ref-based guard to prevent concurrent submissions
  const { currentUser, users, projects, loadEvents, loadTodos, addTodo } = useAppStore();
  const { t, language } = useTranslation();

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const historyLoadedRef = useRef(false);

  const projectId = context.type === 'project' ? context.projectId : undefined;
  const project = projectId ? projects.find(p => p.id === projectId) : undefined;

  const BRAIN_BOT_ID = '00000000-0000-0000-0000-000000000099';

  // Load recent Brain AI DM history from DB on mount
  useEffect(() => {
    if (historyLoadedRef.current || !currentUser?.id) return;
    historyLoadedRef.current = true;
    (async () => {
      try {
        const { getDirectMessages } = await import('@/services/chatService');
        const msgs = await getDirectMessages(currentUser.id, BRAIN_BOT_ID);
        if (msgs.length > 0) {
          const recent = msgs.slice(-10);
          const items: BrainHistoryItem[] = recent.map(m => ({
            id: m.id,
            type: m.userId === BRAIN_BOT_ID ? 'brain' as const : 'user' as const,
            content: m.content,
            timestamp: m.createdAt,
          }));
          setHistory(prev => {
            // Preserve briefing message if it exists (keep at end for visibility)
            const briefing = prev.find(h => h.id?.startsWith('briefing_'));
            return briefing ? [...items, briefing] : items;
          });
        }
      } catch (err) {
        console.error('[BrainWidget] Failed to load DM history:', err);
      }
    })();
  }, [currentUser?.id]);

  // ── Morning Briefing: generate once per day on first access ──
  useEffect(() => {
    if (!currentUser?.id) return;
    
    const todayKey = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    const storageKey = `briefing_${currentUser.id}`;
    const lastBriefing = localStorage.getItem(storageKey);
    console.log('[Briefing] Desktop check:', { todayKey, storageKey, lastBriefing, match: lastBriefing === todayKey });
    if (lastBriefing === todayKey) return;

    const timer = setTimeout(() => {
      console.log('[Briefing] Desktop generating...');
      try {
        const state = useAppStore.getState();
        const myEvents = state.getMyEvents();
        const myTodos = state.personalTodos || [];
        const unreadNotifs = state.appNotifications.filter(n => !n.read);

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const kstHour = today.getUTCHours() + 9;

        const todayEvents = myEvents.filter(e => e.startAt?.split('T')[0] === todayStr);
        const myId = currentUser.id;
        const pendingTodos = myTodos.filter(t => {
          const s = (t as any).status?.toUpperCase?.() || '';
          if (s === 'COMPLETED' || s === 'DONE' || s === 'CANCELLED') return false;
          // Only include todos assigned to me (exclude todos I requested for others)
          if (!t.assigneeIds?.includes(myId)) return false;
          return true;
        });
        const dueTodayTodos = pendingTodos.filter(t => t.dueDate?.split('T')[0] === todayStr);
        const unreadChats = unreadNotifs.filter(n => n.type === 'chat');

        const name = currentUser.name?.split(' ')[0] || '';
        const greeting = (kstHour < 12) ? '🌅 Good Morning' : (kstHour < 18) ? '☀️ Good Afternoon' : '🌙 Good Evening';
        const isKo = language === 'ko';

        let briefing = `${greeting}, ${name}${isKo ? '님' : ''}!\n\n`;

        if (todayEvents.length > 0) {
          briefing += `📅 ${isKo ? '오늘 일정' : "Today's Schedule"} (${todayEvents.length}${isKo ? '건' : ''})\n`;
          // Deduplicate by title+time
          const seen = new Set<string>();
          const uniqueEvents = todayEvents.filter(e => {
            const key = `${e.title}|${e.startAt}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          uniqueEvents.sort((a, b) => (a.startAt || '').localeCompare(b.startAt || ''));
          for (const e of uniqueEvents.slice(0, 5)) {
            const time = e.startAt ? new Date(e.startAt).toLocaleTimeString(isKo ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul', hour12: !isKo }) : '';
            briefing += `• ${time} ${e.title}\n`;
          }
          briefing += '\n';
        } else {
          briefing += `📅 ${isKo ? '오늘 예정된 일정이 없습니다.' : 'No events scheduled for today.'}\n\n`;
        }

        if (pendingTodos.length > 0) {
          briefing += `✅ ${isKo ? '할 일' : 'To-dos'} (${pendingTodos.length}${isKo ? '건' : ''}`;
          if (dueTodayTodos.length > 0) briefing += `, ${isKo ? '오늘 마감' : 'due today'} ${dueTodayTodos.length}${isKo ? '건' : ''}`;
          briefing += ')\n';
          for (const t of (dueTodayTodos.length > 0 ? dueTodayTodos : pendingTodos).slice(0, 5)) {
            briefing += `• ${t.title}\n`;
          }
          briefing += '\n';
        }

        if (unreadChats.length > 0) {
          briefing += `💬 ${isKo ? `읽지 않은 메시지 ${unreadChats.length}건` : `${unreadChats.length} unread message(s)`}\n\n`;
        }

        briefing += isKo ? '오늘도 좋은 하루 보내세요! 궁금한 게 있으면 언제든 물어보세요 😊' : 'Have a great day! Feel free to ask me anything 😊';

        console.log('[Briefing] Text ready, length:', briefing.length);
        setHistory(prev => {
          if (prev.some(h => h.id === `briefing_${todayStr}`)) return prev;
          console.log('[Briefing] Added to history!');
          return [...prev, {
            id: `briefing_${todayStr}`,
            type: 'brain' as const,
            content: briefing,
            timestamp: new Date().toISOString(),
          }];
        });

        localStorage.setItem(storageKey, todayKey);
      } catch (err) {
        console.error('[Briefing] Failed:', err);
      }
    }, 2000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Web Speech API voice recognition
  const toggleVoice = useCallback(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(t('voiceNotSupported'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event: any) => {
      console.warn('[Voice] Recognition error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
      if (event.error === 'not-allowed') {
        toast.error(t('micPermissionRequired'));
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing || !currentUser) return;
    // Ref-based guard: prevent double submission even if React state hasn't flushed yet
    if (processingRef.current) return;
    processingRef.current = true;

    const message = input.trim();
    setInput('');

    // Push user message to history
    const userItem: BrainHistoryItem = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setHistory(prev => [...prev, userItem]);

    setProcessing(true);

    try {
      // Build chat members from project team or all users
      const memberIds = project?.teamMemberIds || [];
      const chatMembers = memberIds.length > 0
        ? memberIds
            .map(id => users.find(u => u.id === id))
            .filter(Boolean)
            .map(u => ({ id: u!.id, name: u!.name }))
        : users.map(u => ({ id: u.id, name: u.name }));

      // Ensure current user is included
      if (!chatMembers.find(m => m.id === currentUser.id)) {
        chatMembers.push({ id: currentUser.id, name: currentUser.name });
      }

      // Build calendar & todo context for Brain AI (same as Brain DM path)
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // KST YYYY-MM-DD
      const weekLater = new Date(now.getTime() + 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      const { events: allEvents, personalTodos: allTodos } = useAppStore.getState();

      const upcomingEvents = allEvents
        .filter(e => {
          const d = new Date(e.startAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
          const inRange = d >= todayStr && d <= weekLater;
          const isMine = e.ownerId === currentUser.id || e.attendeeIds?.includes(currentUser.id) || e.createdBy === currentUser.id;
          return inRange && isMine;
        })
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .slice(0, 15)
        .map(e => {
          const kstDate = new Date(e.startAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
          const kstTime = new Date(e.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul', hour12: false });
          return `- ${kstDate} ${kstTime} ${e.title}${e.location ? ` (${e.location})` : ''}`;
        })
        .join('\n');

      const pendingTodos = allTodos
        .filter(t => t.status === 'PENDING' &&
          (t.assigneeIds?.includes(currentUser.id) || t.requestedById === currentUser.id))
        .slice(0, 10)
        .map(t => `- ${t.title}${t.dueDate ? ` (마감: ${t.dueDate.slice(0, 10)})` : ''}`)
        .join('\n');

      const dataContext = [
        upcomingEvents ? `[📅 내 일정 (${todayStr} ~ ${weekLater})]\n${upcomingEvents}` : '',
        pendingTodos ? `[✅ 내 할 일]\n${pendingTodos}` : '',
      ].filter(Boolean).join('\n\n');

      const contextualMessage = dataContext
        ? `${dataContext}\n\n[Current request]\n${message}`
        : message;

      // Send to LLM for intelligent parsing
      const result = await brainService.processMessageWithLLM({
        messageContent: contextualMessage,
        projectId: projectId || '',
        userId: currentUser.id,
        chatMembers,
        projectTitle: project?.title,
        language,
      });

      // Auto-execute all pending actions from widget (skip manual confirm)
      const actions = result.actions || [];
      let createdEvent = false;
      let createdTodo = false;
      const historyActions: BrainHistoryAction[] = [];

      for (const action of actions) {
        const actionId = (action as { id?: string }).id;
        if (!actionId) continue;

        const act = action as Record<string, unknown>;
        const actionType = (act.action_type || act.actionType) as string || 'unknown';
        const extracted = (act.extracted_data || act.extractedData) as Record<string, unknown> | undefined;
        const actionTitle = (extracted?.title as string) || message.slice(0, 30);

        try {
          await brainService.updateActionStatus(actionId, 'confirmed', currentUser.id);
          const execResult = await brainService.executeAction(actionId, currentUser.id);
          const dataType = (execResult.executedData as { type?: string })?.type;
          if (dataType === 'event') createdEvent = true;
          if (dataType === 'todo') createdTodo = true;
          historyActions.push({ type: actionType, title: actionTitle, status: 'executed' });
        } catch (err) {
          console.error('[BrainWidget] Failed to auto-execute action:', actionId, err);
          // Mock mode fallback: create todo locally from action's extracted data
          if (!isSupabaseConfigured()) {
            if (actionType === 'create_todo' && extracted) {
              await addTodo({
                title: (extracted.title as string) || 'Untitled',
                assigneeIds: (extracted.assigneeIds as string[]) || [currentUser.id],
                dueDate: (extracted.dueDate as string) || new Date().toISOString(),
                priority: (extracted.priority as 'HIGH' | 'NORMAL' | 'LOW') || 'NORMAL',
                projectId: (extracted.projectId as string) || projectId,
              });
              createdTodo = true;
              historyActions.push({ type: actionType, title: actionTitle, status: 'executed' });
              console.log('[BrainWidget] Mock fallback: todo created locally');
            } else {
              historyActions.push({ type: actionType, title: actionTitle, status: 'failed' });
            }
          } else {
            historyActions.push({ type: actionType, title: actionTitle, status: 'failed' });
          }
        }
      }

      // Push brain response to history
      const brainItem: BrainHistoryItem = {
        id: `brain_${Date.now()}`,
        type: 'brain',
        content: result.llmResponse?.replyMessage || (createdEvent || createdTodo ? 'Done!' : 'Processed.'),
        timestamp: new Date().toISOString(),
        actions: historyActions.length > 0 ? historyActions : undefined,
      };
      setHistory(prev => [...prev, brainItem]);

      // Show result
      if (createdEvent || createdTodo) {
        const parts: string[] = [];
        if (createdEvent) parts.push('Event');
        if (createdTodo) parts.push('Todo');
        toast.success(`${parts.join(' & ')} created!`);
      }

      // Refresh data immediately + retries for DB replication lag
      if (createdEvent) await loadEvents();
      if (createdTodo) {
        await loadTodos();
        // Smart dedup: remove duplicate todos with same title
        const { personalTodos, deleteTodo: delTodo } = useAppStore.getState();
        for (const action of actions) {
          const act = action as Record<string, unknown>;
          const extracted = (act.extracted_data || act.extractedData) as Record<string, unknown> | undefined;
          const todoTitle = (extracted?.title as string) || '';
          if (todoTitle) {
            const dupes = personalTodos.filter(td => td.title === todoTitle);
            if (dupes.length > 1) {
              const sorted = [...dupes].sort((a, b) =>
                new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
              );
              for (let d = 1; d < sorted.length; d++) {
                await delTodo(sorted[d].id);
                console.log(`[BrainWidget] Dedup: removed older todo "${sorted[d].title}" (${sorted[d].id})`);
              }
            }
          }
        }
        for (let retry = 1; retry <= 2; retry++) {
          if (!processingRef.current) break; // Abort retries if a new request started or unmounted
          await new Promise(r => setTimeout(r, 1000));
          await loadTodos().catch(() => {});
        }
      }
    } catch (error) {
      console.error('Brain AI processing failed:', error);
      toast.error('Brain AI processing failed');

      // Push error response to history
      const errorItem: BrainHistoryItem = {
        id: `brain_err_${Date.now()}`,
        type: 'brain',
        content: 'Processing failed. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setHistory(prev => [...prev, errorItem]);
    } finally {
      processingRef.current = false;
      setProcessing(false);
      inputRef.current?.focus();
    }
  }, [input, processing, currentUser, users, projects, project, projectId, loadEvents, loadTodos, addTodo]);

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const getActionStatusIcon = (status: string) => {
    switch (status) {
      case 'executed':
        return <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-2.5 h-2.5 text-red-500" />;
      default:
        return <Clock className="w-2.5 h-2.5 text-amber-500" />;
    }
  };

  const getActionTypeLabel = (type: string) => {
    switch (type) {
      case 'create_todo': return 'Todo';
      case 'create_event': return 'Event';
      case 'update_event': return 'Event Update';
      case 'create_board_task': return 'Board Task';
      case 'share_location': return 'Location';
      default: return 'Action';
    }
  };

  return (
    <div className="flex flex-col h-full w-full glass-widget rounded-xl overflow-hidden">
      {/* Scrollable history area */}
      <div
        ref={scrollRef}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2"
      >
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-1.5">
            <Brain className="w-5 h-5 text-violet-400/50" />
            <span className="text-xs font-medium">Brain AI</span>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className={`flex ${item.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-1.5 ${
                  item.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-violet-50 dark:bg-violet-950/40 border border-violet-200/50 dark:border-violet-800/50 text-foreground'
                }`}
              >
                {item.type === 'brain' && (
                  <div className="flex items-center gap-1 mb-0.5">
                    <Brain className="w-2.5 h-2.5 text-violet-500" />
                    <span className="typo-chat-name text-violet-600 dark:text-violet-400">Brain AI</span>
                  </div>
                )}
                <p className="typo-chat-message leading-relaxed whitespace-pre-wrap" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  {item.type === 'brain' ? renderBrainMessage(item.content) : item.content}
                </p>
                {/* Action badges */}
                {item.actions && item.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.actions.map((action, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                                   bg-white/80 dark:bg-white/10 border border-border/50
                                   text-xs font-medium font-medium text-foreground/80"
                      >
                        {getActionStatusIcon(action.status)}
                        <span>{getActionTypeLabel(action.type)}</span>
                        {action.title && (
                          <span className="truncate max-w-[80px] text-muted-foreground">
                            {action.title}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                <span className={`block typo-caption mt-0.5 ${
                  item.type === 'user' ? 'text-white/60' : 'text-muted-foreground/60'
                }`}>
                  {formatTime(item.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
        {/* Processing indicator */}
        {processing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                            bg-violet-50 dark:bg-violet-950/40 border border-violet-200/50 dark:border-violet-800/50">
              <Loader2 className="w-3 h-3 text-violet-500 animate-spin" />
              <span className="text-xs font-medium text-violet-600 dark:text-violet-400 font-medium">
                Brain AI is thinking...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input bar at bottom */}
      <div className="shrink-0 px-3 py-2 border-t border-border/30">
        <form
          onSubmit={handleSubmit}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5"
        >
          <Brain className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('brainAIPlaceholder')}
            disabled={processing}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg
                       bg-transparent border-0 text-xs
                       placeholder:text-muted-foreground/50
                       focus:outline-none
                       disabled:opacity-50"
          />
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
            title={isListening ? t('voiceListening') : t('voiceCommand')}
          >
            {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          </button>
          <button
            type="submit"
            disabled={processing || !input.trim()}
            className="p-1.5 rounded-lg bg-violet-500 text-white hover:bg-violet-600
                       disabled:opacity-40 disabled:hover:bg-violet-500
                       transition-colors shrink-0"
          >
            {processing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default BrainChatWidget;
