import { useState, useMemo, useCallback } from 'react';
import { PersonalTodo, TodoPriority, User } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserSearchInput } from '@/components/ui/user-search-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Calendar, Users, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';

interface TodosTabProps {
  projectId: string;
}

const priorityColors: Record<TodoPriority, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  NORMAL: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  MEDIUM: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  LOW: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700',
};

export function TodosTab({ projectId }: TodosTabProps) {
  const { t } = useTranslation();
  const {
    users,
    currentUser,
    personalTodos,
    getUserById,
    addTodo,
    completeTodo,
    updateTodo,
    deleteTodo,
    addEvent,
  } = useAppStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignees, setNewAssignees] = useState<User[]>([]);
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('09:00');
  const [newPriority, setNewPriority] = useState<TodoPriority>('NORMAL');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // Filter todos for this project from real store data
  const projectTodos = useMemo(() => {
    return personalTodos
      .filter((td) => td.projectId === projectId)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'PENDING' ? -1 : 1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [personalTodos, projectId]);

  const filteredTodos = useMemo(() => {
    return projectTodos.filter((todo) => {
      if (filter === 'pending') return todo.status === 'PENDING';
      if (filter === 'completed') return todo.status === 'COMPLETED';
      return true;
    });
  }, [projectTodos, filter]);

  const pendingCount = projectTodos.filter((t) => t.status === 'PENDING').length;
  const completedCount = projectTodos.filter((t) => t.status === 'COMPLETED').length;

  const handleToggleTodo = useCallback(async (todoId: string) => {
    const todo = personalTodos.find(t => t.id === todoId);
    if (!todo) return;
    try {
      if (todo.status === 'PENDING') {
        await completeTodo(todoId);
      } else {
        await updateTodo(todoId, { status: 'PENDING', completedAt: undefined });
      }
      toast.success(t('todoUpdated'));
    } catch (err) {
      console.error('[TodosTab] Toggle error:', err);
      toast.error(t('todoUpdateFailed'));
    }
  }, [personalTodos, completeTodo, updateTodo, t]);

  const handleDeleteTodo = useCallback(async (todoId: string) => {
    try {
      await deleteTodo(todoId);
      toast.success(t('todoDeleted'));
    } catch (err) {
      console.error('[TodosTab] Delete error:', err);
    }
  }, [deleteTodo, t]);

  const handleAddAssignee = (user: User) => {
    if (!newAssignees.find(u => u.id === user.id)) {
      setNewAssignees([...newAssignees, user]);
    }
  };

  const handleRemoveAssignee = (userId: string) => {
    setNewAssignees(newAssignees.filter(u => u.id !== userId));
  };

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTitle.trim() || !currentUser) {
      toast.error(t('pleaseEnterTitle'));
      return;
    }

    const assigneeIds = newAssignees.length > 0
      ? newAssignees.map(u => u.id)
      : [currentUser.id];

    const dueDateTime = newDueDate
      ? `${newDueDate}T${newDueTime}:00`
      : new Date(Date.now() + 86400000).toISOString();

    try {
      await addTodo({
        title: newTitle.trim(),
        assigneeIds,
        requestedById: currentUser.id,
        projectId,
        dueDate: dueDateTime,
        priority: newPriority,
        status: 'PENDING',
      });

      // If due date is set, create calendar events for each assignee
      if (newDueDate) {
        for (const assigneeId of assigneeIds) {
          await addEvent({
            id: `event-todo-${Date.now()}-${assigneeId}`,
            title: newTitle.trim(),
            type: 'TODO',
            startAt: dueDateTime,
            endAt: dueDateTime,
            projectId,
            ownerId: assigneeId,
            source: 'PAULUS',
          });
        }
      }

      const assigneeNames = newAssignees.map(u => u.name).join(', ');
      toast.success(t('todoCreated'), {
        description: newAssignees.length > 0
          ? `${t('assignedTo')} ${assigneeNames}`
          : undefined,
      });

      // Reset form
      setNewTitle('');
      setNewAssignees([]);
      setNewDueDate('');
      setNewDueTime('09:00');
      setNewPriority('NORMAL');
      setShowNewModal(false);
    } catch (err) {
      console.error('[TodosTab] Create error:', err);
      toast.error(t('todoCreateFailed'));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            {t('all')} ({projectTodos.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            {t('pending')} ({pendingCount})
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilter('completed')}
          >
            {t('completed')} ({completedCount})
          </Button>
        </div>
        <Button onClick={() => setShowNewModal(true)} variant="glass-accent" className="gap-2">
          <Plus className="w-4 h-4" />
          {t('newTodo')}
        </Button>
      </div>

      {/* Todo List */}
      <Card className="divide-y divide-border">
        {filteredTodos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>{t('noTodosFound')}</p>
          </div>
        ) : (
          filteredTodos.map((todo) => {
            const assignees = (todo.assigneeIds || []).map(id => getUserById(id)).filter(Boolean) as User[];
            const requester = getUserById(todo.requestedById);
            const isOverdue = new Date(todo.dueDate) < new Date() && todo.status === 'PENDING';

            return (
              <div
                key={todo.id}
                className={`flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 ${
                  todo.status === 'COMPLETED' ? 'opacity-60' : ''
                }`}
              >
                <Checkbox
                  checked={todo.status === 'COMPLETED'}
                  onCheckedChange={() => handleToggleTodo(todo.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium ${
                        todo.status === 'COMPLETED' ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {todo.title}
                    </span>
                    <Badge variant="outline" className={priorityColors[todo.priority] || priorityColors.NORMAL}>
                      {todo.priority}
                    </Badge>
                    {isOverdue && (
                      <Badge variant="destructive">{t('overdue')}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(todo.dueDate)}
                    </span>
                    {assignees.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <div className="flex items-center -space-x-2">
                          {assignees.slice(0, 3).map((assignee) => (
                            <Avatar key={assignee.id} className="w-5 h-5 border-2 border-background">
                              <AvatarFallback className="text-[8px]">
                                {getInitials(assignee.name)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {assignees.length > 3 && (
                            <span className="ml-2 text-xs">+{assignees.length - 3}</span>
                          )}
                        </div>
                        <span className="ml-1">
                          {assignees.length === 1
                            ? assignees[0].name
                            : `${assignees[0].name} ${t('andNMore').replace('{n}', String(assignees.length - 1))}`}
                        </span>
                      </span>
                    )}
                    {requester && !todo.assigneeIds?.includes(requester.id) && (
                      <span className="text-xs">
                        {t('requestedBy')} {requester.name}
                      </span>
                    )}
                  </div>
                </div>
                {/* Delete button — only for requester */}
                {currentUser && todo.requestedById === currentUser.id && (
                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                    title={t('delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </Card>

      {/* New Todo Modal */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('newTodo')}</DialogTitle>
            <DialogDescription>
              {t('createTodoDescription')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTodo} className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="todo-title">{t('title')}</Label>
              <Input
                id="todo-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('whatNeedsToBeDone')}
                autoFocus
              />
            </div>

            {/* Assignees (Multiple) */}
            <div className="space-y-2">
              <Label>{t('assignTo')}</Label>
              <UserSearchInput
                users={users}
                selectedUsers={newAssignees}
                onSelect={handleAddAssignee}
                onRemove={handleRemoveAssignee}
                placeholder={t('searchTeamMembers')}
                multiple={true}
              />
              <p className="text-xs text-muted-foreground">
                {t('leaveEmptyToAssignToYourself')}
              </p>
            </div>

            {/* Due Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="todo-date">{t('dueDate')}</Label>
                <Input
                  id="todo-date"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="todo-time">{t('time')}</Label>
                <Input
                  id="todo-time"
                  type="time"
                  value={newDueTime}
                  onChange={(e) => setNewDueTime(e.target.value)}
                />
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label>{t('priority')}</Label>
              <Select value={newPriority} onValueChange={(value) => setNewPriority(value as TodoPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">{t('low')}</SelectItem>
                  <SelectItem value="NORMAL">{t('normal')}</SelectItem>
                  <SelectItem value="HIGH">{t('high')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setShowNewModal(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="glass-accent" className="gap-2">
                <Plus className="w-4 h-4" />
                {t('createTodo')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
