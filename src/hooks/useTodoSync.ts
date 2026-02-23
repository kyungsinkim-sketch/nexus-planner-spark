/**
 * useTodoSync — Global hook for real-time todo synchronization.
 *
 * Subscribes to Supabase Realtime changes on `personal_todos` table and
 * refreshes the Zustand store so that todos assigned by OTHER users appear
 * without a page reload.
 *
 * Also generates an AppNotification when someone assigns a new todo to the
 * current user.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface TodoRow {
  id: string;
  title: string;
  assignee_ids: string[];
  requested_by_id: string;
  project_id?: string | null;
  due_date: string;
  priority: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  source_task_id?: string | null;
}

export function useTodoSync() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUser = useAppStore((s) => s.currentUser);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (!currentUser) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel('todo_sync_global')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'personal_todos',
        },
        (payload) => {
          const event = payload.eventType; // INSERT | UPDATE | DELETE
          const row = payload.new as TodoRow | null;
          const oldRow = payload.old as { id?: string } | null;

          const store = useAppStore.getState();

          if (event === 'DELETE' && oldRow?.id) {
            // Remove from local state
            const existed = store.personalTodos.find(t => t.id === oldRow.id);
            if (existed) {
              useAppStore.setState({
                personalTodos: store.personalTodos.filter(t => t.id !== oldRow.id),
              });
            }
            return;
          }

          if (!row) return;

          // Check if this todo is relevant to the current user
          const isAssignee = row.assignee_ids?.includes(currentUser.id);
          const isCreator = row.requested_by_id === currentUser.id;
          if (!isAssignee && !isCreator) return;

          // Transform row to PersonalTodo
          const todo = {
            id: row.id,
            title: row.title,
            assigneeIds: row.assignee_ids || [],
            requestedById: row.requested_by_id,
            projectId: row.project_id || undefined,
            dueDate: row.due_date,
            priority: row.priority as 'HIGH' | 'NORMAL' | 'LOW',
            status: row.status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED',
            createdAt: row.created_at,
            completedAt: row.completed_at || undefined,
            sourceTaskId: row.source_task_id || undefined,
          };

          if (event === 'INSERT') {
            // Add if not already present
            const exists = store.personalTodos.some(t => t.id === todo.id);
            if (!exists) {
              useAppStore.setState({
                personalTodos: [todo, ...store.personalTodos],
              });

              // Create notification if assigned to me by someone else
              if (isAssignee && row.requested_by_id !== currentUser.id) {
                const requester = store.users.find(u => u.id === row.requested_by_id);
                store.addAppNotification({
                  type: 'todo',
                  title: requester?.name || '새 할 일',
                  message: `할 일 할당: ${row.title}`,
                  projectId: row.project_id || undefined,
                });
              }
            }
          } else if (event === 'UPDATE') {
            // Update in-place
            const idx = store.personalTodos.findIndex(t => t.id === todo.id);
            if (idx >= 0) {
              const updated = [...store.personalTodos];
              updated[idx] = todo;
              useAppStore.setState({ personalTodos: updated });
            } else {
              // Might be newly assigned to us — add it
              useAppStore.setState({
                personalTodos: [todo, ...store.personalTodos],
              });
            }
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUser?.id]);
}
