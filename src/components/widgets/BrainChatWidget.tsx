/**
 * BrainChatWidget — Minimal Brain AI search bar widget.
 * Frameless: just a search input + send button. No widget frame needed.
 *
 * Sends messages to Brain AI (brain-process) via Cmd+Enter logic.
 * Works in both dashboard and project contexts.
 */

import { useState, useRef, useCallback } from 'react';
import { Brain, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import * as brainService from '@/services/brainService';
import type { WidgetDataContext } from '@/types/widget';

function BrainChatWidget({ context }: { context: WidgetDataContext }) {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { currentUser, users, loadEvents, loadTodos } = useAppStore();
  const { t } = useTranslation();

  const projectId = context.type === 'project' ? context.projectId : undefined;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing || !currentUser) return;

    const message = input.trim();
    setInput('');
    setProcessing(true);

    try {
      // Gather chat members (all users for dashboard, project members for project context)
      const chatMembers = users.map((u) => ({ id: u.id, name: u.name }));

      // Use LLM path (same as Cmd+Enter in chat)
      await brainService.processMessageWithLLM({
        messageContent: message,
        roomId: '', // No specific chat room
        projectId: projectId || '',
        userId: currentUser.id,
        chatMembers,
        projectTitle: undefined,
      });

      toast.success('Brain AI processed your request');

      // Refresh data
      setTimeout(async () => {
        await loadEvents();
        await loadTodos();
      }, 500);
    } catch (error) {
      console.error('Brain AI processing failed:', error);
      toast.error('Brain AI processing failed');
    } finally {
      setProcessing(false);
      inputRef.current?.focus();
    }
  }, [input, processing, currentUser, users, projectId, loadEvents, loadTodos]);

  return (
    <div className="flex items-center h-full px-2 py-1 gap-2">
      <Brain className="w-4 h-4 text-violet-500 shrink-0" />
      <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-1.5 min-w-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('brainAIPlaceholder')}
          disabled={processing}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-white/10 dark:bg-white/5
                     border border-border/50 text-sm
                     placeholder:text-muted-foreground/50
                     focus:outline-none focus:ring-1 focus:ring-violet-500/50 focus:border-violet-500/50
                     disabled:opacity-50 transition-colors"
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
