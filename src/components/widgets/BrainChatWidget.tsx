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
      const chatMembers = users.map((u) => ({ id: u.id, name: u.name }));

      await brainService.processMessageWithLLM({
        messageContent: message,
        roomId: '',
        projectId: projectId || '',
        userId: currentUser.id,
        chatMembers,
        projectTitle: undefined,
      });

      toast.success('Brain AI processed your request');

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
