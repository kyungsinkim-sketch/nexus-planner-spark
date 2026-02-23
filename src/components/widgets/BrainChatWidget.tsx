/**
 * BrainChatWidget — Brain AI chat widget with conversation history.
 * Shows scrollable history of user/brain messages with action badges.
 * Input bar at bottom. Auto-scrolls on new messages.
 *
 * The widget's outer div is the drag handle (set by WidgetGrid).
 * The form area stops propagation so input interaction works normally.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Brain, Send, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import * as brainService from '@/services/brainService';
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
  const { currentUser, users, projects, loadEvents, loadTodos, addTodo } = useAppStore();
  const { t } = useTranslation();

  const projectId = context.type === 'project' ? context.projectId : undefined;
  const project = projectId ? projects.find(p => p.id === projectId) : undefined;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing || !currentUser) return;

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

      // Send to LLM for intelligent parsing
      const result = await brainService.processMessageWithLLM({
        messageContent: message,
        projectId: projectId || '',
        userId: currentUser.id,
        chatMembers,
        projectTitle: project?.title,
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
            <span className="text-[10px]">Brain AI</span>
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
                    <span className="text-[9px] font-semibold text-violet-600 dark:text-violet-400">Brain AI</span>
                  </div>
                )}
                <p className="text-xs leading-relaxed" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  {item.content}
                </p>
                {/* Action badges */}
                {item.actions && item.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.actions.map((action, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full
                                   bg-white/80 dark:bg-white/10 border border-border/50
                                   text-[9px] font-medium text-foreground/80"
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
                <span className={`block text-[9px] mt-0.5 ${
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
              <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
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
