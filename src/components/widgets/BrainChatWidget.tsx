/**
 * BrainChatWidget — Minimal Brain AI search bar widget.
 * Completely frameless: no glass container, no title bar.
 * Just a search input bar with Brain icon + send button.
 *
 * The widget's outer div is the drag handle (set by WidgetGrid).
 * The form area stops propagation so input interaction works normally.
 */

import { useState, useRef, useCallback } from 'react';
import { Brain, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import * as brainService from '@/services/brainService';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { WidgetDataContext } from '@/types/widget';

function BrainChatWidget({ context }: { context: WidgetDataContext }) {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { currentUser, users, projects, loadEvents, loadTodos, addTodo } = useAppStore();
  const { t } = useTranslation();

  const projectId = context.type === 'project' ? context.projectId : undefined;
  const project = projectId ? projects.find(p => p.id === projectId) : undefined;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing || !currentUser) return;

    const message = input.trim();
    setInput('');
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

      for (const action of actions) {
        const actionId = (action as { id?: string }).id;
        if (!actionId) continue;

        try {
          await brainService.updateActionStatus(actionId, 'confirmed', currentUser.id);
          const execResult = await brainService.executeAction(actionId, currentUser.id);
          const dataType = (execResult.executedData as { type?: string })?.type;
          if (dataType === 'event') createdEvent = true;
          if (dataType === 'todo') createdTodo = true;
        } catch (err) {
          console.error('[BrainWidget] Failed to auto-execute action:', actionId, err);
          // Mock mode fallback: create todo locally from action's extracted data
          if (!isSupabaseConfigured()) {
            const act = action as Record<string, unknown>;
            const actionType = act.action_type || act.actionType;
            const extracted = (act.extracted_data || act.extractedData) as Record<string, unknown> | undefined;
            if (actionType === 'create_todo' && extracted) {
              await addTodo({
                title: (extracted.title as string) || 'Untitled',
                assigneeIds: (extracted.assigneeIds as string[]) || [currentUser.id],
                dueDate: (extracted.dueDate as string) || new Date().toISOString(),
                priority: (extracted.priority as 'HIGH' | 'NORMAL' | 'LOW') || 'NORMAL',
                projectId: (extracted.projectId as string) || projectId,
              });
              createdTodo = true;
              console.log('[BrainWidget] Mock fallback: todo created locally');
            }
          }
        }
      }

      // Show result
      if (createdEvent || createdTodo) {
        const parts: string[] = [];
        if (createdEvent) parts.push('Event');
        if (createdTodo) parts.push('Todo');
        toast.success(`${parts.join(' & ')} created!`);
      } else if (result.llmResponse?.replyMessage) {
        toast.info(result.llmResponse.replyMessage.slice(0, 100));
      } else {
        toast.success('Brain AI processed.');
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
    } finally {
      setProcessing(false);
      inputRef.current?.focus();
    }
  }, [input, processing, currentUser, users, projects, project, projectId, loadEvents, loadTodos, addTodo]);

  return (
    <div className="flex items-center h-full w-full px-3 gap-2.5
                    glass-widget rounded-xl">
      <Brain className="w-4 h-4 text-violet-500 shrink-0" />
      {/* Stop mousedown propagation so input/button clicks don't trigger drag */}
      <form
        onSubmit={handleSubmit}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex flex-1 items-center gap-1.5 min-w-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('brainAIPlaceholder')}
          disabled={processing}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg
                     bg-transparent border-0 text-sm
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
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </form>
    </div>
  );
}

export default BrainChatWidget;
