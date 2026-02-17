/**
 * TodosWidget — Shows personal todos with creation and completion.
 * Dashboard: all todos. Project: project-specific tasks.
 * Includes a + button for quick todo creation.
 */

import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { CheckCircle2, Circle, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { WidgetDataContext } from '@/types/widget';

const priorityDot: Record<string, string> = {
  HIGH: 'bg-red-500',
  NORMAL: 'bg-blue-500',
  LOW: 'bg-gray-400',
};

function TodosWidget({ context }: { context: WidgetDataContext }) {
  const { personalTodos, currentUser, addTodo, completeTodo } = useAppStore();
  const { t, language } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const locale = language === 'ko' ? 'ko-KR' : 'en-US';

  const todos = useMemo(() => {
    let list = personalTodos.filter(
      (td) =>
        td.assigneeIds?.includes(currentUser?.id || '') ||
        td.requestedById === currentUser?.id,
    );
    if (context.type === 'project' && context.projectId) {
      list = list.filter((td) => td.projectId === context.projectId);
    }
    // Sort: pending first (by dueDate), then completed
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'PENDING' ? -1 : 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
    return list.slice(0, 10);
  }, [personalTodos, currentUser, context]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !currentUser) return;
    await addTodo({
      title: newTitle.trim(),
      assigneeIds: [currentUser.id],
      requestedById: currentUser.id,
      dueDate: newDueDate || new Date().toISOString(),
      priority: 'NORMAL',
      projectId: context.type === 'project' ? context.projectId : undefined,
    });
    toast.success(t('todoCreated'));
    setNewTitle('');
    setNewDueDate('');
    setShowCreate(false);
  };

  const handleToggle = async (todoId: string, currentStatus: string) => {
    if (currentStatus === 'PENDING') {
      await completeTodo(todoId);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header row with + button */}
      <div className="flex justify-end px-1 pb-1 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setShowCreate(true); }}
          className="p-1 rounded hover:bg-white/10 dark:hover:bg-white/10 hover:bg-black/5 transition-colors"
          title={t('newTodo')}
        >
          <Plus className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      </div>

      {/* Todo list */}
      {todos.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground/60">
          <p className="text-sm">{t('noTodosYet')}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            + {t('newTodo')}
          </button>
        </div>
      ) : (
        <div className="space-y-0.5 overflow-y-auto flex-1 min-h-0">
          {todos.map((todo) => {
            const isOverdue =
              todo.status === 'PENDING' && new Date(todo.dueDate) < new Date();
            return (
              <div
                key={todo.id}
                className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                onClick={() => handleToggle(todo.id, todo.status)}
              >
                {todo.status === 'COMPLETED' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 shrink-0 mt-0.5 transition-colors" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        priorityDot[todo.priority] || priorityDot.NORMAL
                      }`}
                    />
                    <p
                      className={`text-sm truncate ${
                        todo.status === 'COMPLETED'
                          ? 'line-through text-muted-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      {todo.title}
                    </p>
                  </div>
                  {todo.dueDate && (
                    <p
                      className={`text-[11px] mt-0.5 ml-3 ${
                        isOverdue
                          ? 'text-red-500 font-medium'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(todo.dueDate).toLocaleDateString(locale, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('newTodo')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('whatNeedsToBeDone')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <Input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t('createTodo')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TodosWidget;
