/**
 * TodosWidget — Shows personal todos with creation and completion.
 * Dashboard: all todos. Project: project-specific tasks.
 * The + button lives in the WidgetContainer titlebar (via headerActions).
 * Global state `todoCreateDialogOpen` triggers the create dialog.
 * Supports multi-user assignment via UserSearchInput and priority selection.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { CheckCircle2, Circle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserSearchInput } from '@/components/ui/user-search-input';
import { toast } from 'sonner';
import type { WidgetDataContext } from '@/types/widget';
import type { User } from '@/types/core';

const priorityDot: Record<string, string> = {
  HIGH: 'bg-red-500',
  NORMAL: 'bg-blue-500',
  LOW: 'bg-gray-400',
};

const PRIORITIES = ['HIGH', 'NORMAL', 'LOW'] as const;

function TodosWidget({ context }: { context: WidgetDataContext }) {
  const {
    personalTodos, currentUser, users, projects,
    addTodo, completeTodo,
    todoCreateDialogOpen, setTodoCreateDialogOpen,
  } = useAppStore();
  const { t, language } = useTranslation();

  // Create dialog state
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'HIGH' | 'NORMAL' | 'LOW'>('NORMAL');
  const [selectedAssignees, setSelectedAssignees] = useState<User[]>([]);

  const locale = language === 'ko' ? 'ko-KR' : 'en-US';

  // Determine available users for assignment (project team or all users)
  const projectId = context.type === 'project' ? context.projectId : undefined;
  const project = projectId ? projects.find(p => p.id === projectId) : undefined;

  const availableUsers = useMemo(() => {
    if (project?.teamMemberIds?.length) {
      return users.filter(u => project.teamMemberIds.includes(u.id));
    }
    return users;
  }, [users, project]);

  // Reset form when dialog opens
  useEffect(() => {
    if (todoCreateDialogOpen) {
      setNewTitle('');
      setNewDueDate('');
      setNewPriority('NORMAL');
      setSelectedAssignees(currentUser ? [currentUser] : []);
    }
  }, [todoCreateDialogOpen, currentUser]);

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

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !currentUser) return;
    const assigneeIds = selectedAssignees.length > 0
      ? selectedAssignees.map(u => u.id)
      : [currentUser.id];
    await addTodo({
      title: newTitle.trim(),
      assigneeIds,
      requestedById: currentUser.id,
      dueDate: newDueDate || new Date().toISOString(),
      priority: newPriority,
      projectId: context.type === 'project' ? context.projectId : undefined,
    });
    toast.success(t('todoCreated'));
    setTodoCreateDialogOpen(false);
  }, [newTitle, newDueDate, newPriority, selectedAssignees, currentUser, context, addTodo, setTodoCreateDialogOpen, t]);

  const handleToggle = async (todoId: string, currentStatus: string) => {
    if (currentStatus === 'PENDING') {
      await completeTodo(todoId);
    }
  };

  const handleAddAssignee = useCallback((user: User) => {
    setSelectedAssignees(prev => {
      if (prev.find(u => u.id === user.id)) return prev;
      return [...prev, user];
    });
  }, []);

  const handleRemoveAssignee = useCallback((userId: string) => {
    setSelectedAssignees(prev => prev.filter(u => u.id !== userId));
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Todo list */}
      {todos.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground/60">
          <p className="text-sm">{t('noTodosYet')}</p>
          <button
            onClick={() => setTodoCreateDialogOpen(true)}
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

      {/* Enhanced Create Dialog with assignee + priority */}
      <Dialog open={todoCreateDialogOpen} onOpenChange={setTodoCreateDialogOpen}>
        <DialogContent className="sm:max-w-md" onMouseDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('newTodo')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Title */}
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

            {/* Assignees (multi-select) */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('assignees')}
              </label>
              <UserSearchInput
                users={availableUsers}
                selectedUsers={selectedAssignees}
                onSelect={handleAddAssignee}
                onRemove={handleRemoveAssignee}
                placeholder={t('searchUsers')}
                multiple
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('dueDate')}
              </label>
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('priority')}
              </label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPriority(p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      newPriority === p
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-transparent border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${priorityDot[p]}`} />
                    {p === 'HIGH' ? t('high') : p === 'NORMAL' ? t('normal') : t('low')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTodoCreateDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()}>
              {t('createTodo')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TodosWidget;
