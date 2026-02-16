/**
 * TodosWidget — Shows personal todos.
 * Dashboard: all todos. Project: project-specific tasks.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { CheckCircle2, Circle } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function TodosWidget({ context }: { context: WidgetDataContext }) {
  const { personalTodos, currentUser } = useAppStore();

  const todos = useMemo(() => {
    let list = personalTodos.filter((t) => t.assigneeIds?.includes(currentUser?.id || '') || t.requestedById === currentUser?.id);
    if (context.type === 'project' && context.projectId) {
      list = list.filter((t) => t.projectId === context.projectId);
    }
    return list.slice(0, 10);
  }, [personalTodos, currentUser, context]);

  if (todos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        No todos yet
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {todos.map((todo) => (
        <div key={todo.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors">
          {todo.status === 'COMPLETED' ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className={`text-sm truncate ${todo.status === 'COMPLETED' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {todo.title}
            </p>
            {todo.dueDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Due: {new Date(todo.dueDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default TodosWidget;
