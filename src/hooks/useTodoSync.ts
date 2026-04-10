/**
 * useTodoSync — Global hook for real-time todo + event invite synchronization.
 *
 * Subscribes to Supabase Realtime changes on `personal_todos` and
 * `calendar_events` tables via a single channel.
 *
 * Features:
 * - Refreshes Zustand store on todo INSERT/UPDATE/DELETE
 * - Shows Brain popup when someone assigns a new todo
 * - Shows Brain popup when someone invites user to a calendar event
 * - Fallback: on mount, queries recent event invites in case Realtime missed them
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { showBrainPopup } from '@/components/brain/BrainPopupToast';

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

interface EventRow {
  id: string;
  title: string;
  owner_id: string;
  attendee_ids?: string[] | null;
  start_at: string;
  end_at?: string;
  location?: string;
  type?: string;
  project_id?: string | null;
  created_at: string;
}

/** Track event IDs we've already shown popups for (persists across re-renders) */
const shownEventPopups = new Set<string>();

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

    // ── Single channel for both todo + event subscriptions ──
    const channel = supabase
      .channel('brain_sync_global')
      // ─── personal_todos subscription ───
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'personal_todos',
        },
        (payload) => {
          const event = payload.eventType;
          const row = payload.new as TodoRow | null;
          const oldRow = payload.old as { id?: string } | null;

          const store = useAppStore.getState();

          if (event === 'DELETE' && oldRow?.id) {
            const existed = store.personalTodos.find(t => t.id === oldRow.id);
            if (existed) {
              useAppStore.setState({
                personalTodos: store.personalTodos.filter(t => t.id !== oldRow.id),
              });
            }
            return;
          }

          if (!row) return;

          const isAssignee = row.assignee_ids?.includes(currentUser.id);
          const isCreator = row.requested_by_id === currentUser.id;
          if (!isAssignee && !isCreator) return;

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
            const exists = store.personalTodos.some(t => t.id === todo.id);
            if (!exists) {
              useAppStore.setState({
                personalTodos: [todo, ...store.personalTodos],
              });

              if (isAssignee && row.requested_by_id !== currentUser.id) {
                const requester = store.users.find(u => u.id === row.requested_by_id);
                const requesterName = requester?.name || '팀원';
                store.addAppNotification({
                  type: 'todo',
                  title: requesterName,
                  message: `할 일 할당: ${row.title}`,
                  projectId: row.project_id || undefined,
                });

                showBrainPopup({
                  id: `todo_${row.id}`,
                  title: `${requesterName}님의 요청`,
                  message: row.title + (row.due_date ? ` (마감: ${row.due_date.slice(0, 10)})` : ''),
                  source: 'todo_assignment',
                  fromUserName: requesterName,
                  actionLabel: '확인',
                  onAccept: () => {},
                });
              }
            }
          } else if (event === 'UPDATE') {
            const idx = store.personalTodos.findIndex(t => t.id === todo.id);
            if (idx >= 0) {
              const updated = [...store.personalTodos];
              updated[idx] = todo;
              useAppStore.setState({ personalTodos: updated });
            } else {
              useAppStore.setState({
                personalTodos: [todo, ...store.personalTodos],
              });
            }
          }
        },
      )
      // ─── calendar_events subscription (event invites) ───
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calendar_events',
        },
        (payload) => {
          const row = payload.new as EventRow | null;
          if (!row) return;

          // Skip events I created myself
          if (row.owner_id === currentUser.id) return;

          // Only show popup if I'm in attendee_ids
          const isAttendee = row.attendee_ids?.includes(currentUser.id);
          if (!isAttendee) return;

          // Skip if already shown
          if (shownEventPopups.has(row.id)) return;
          shownEventPopups.add(row.id);

          handleEventInvitePopup(row, currentUser.id);
        },
      )
      .subscribe((status, err) => {
        console.log(`[BrainSync] channel status: ${status}`, err ? `error: ${err.message}` : '');
      });

    channelRef.current = channel;

    // ── Fallback: check for recent event invites we might have missed ──
    loadMissedEventInvites(currentUser.id);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUser?.id]);
}

/**
 * Show Brain popup + app notification for an event invite.
 */
function handleEventInvitePopup(row: EventRow, currentUserId: string) {
  const store = useAppStore.getState();
  const creator = store.users.find(u => u.id === row.owner_id);
  const creatorName = creator?.name || '팀원';

  const kstTime = new Date(row.start_at).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul', hour12: false,
  });
  const kstDate = new Date(row.start_at).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', timeZone: 'Asia/Seoul',
  });

  showBrainPopup({
    id: `event_${row.id}`,
    title: `${creatorName}님의 미팅 요청`,
    message: `${row.title}\n${kstDate} ${kstTime}${row.location ? ` · ${row.location}` : ''}`,
    source: 'event_request',
    fromUserName: creatorName,
    actionLabel: '확인',
    onAccept: () => {},
  });

  store.addAppNotification({
    type: 'event',
    title: creatorName,
    message: `미팅 초대: ${row.title} (${kstDate} ${kstTime})`,
    projectId: row.project_id || undefined,
  });
}

/**
 * Fallback: query recent calendar events (last 2 hours) where user is an attendee.
 * Shows popups for any events the Realtime subscription might have missed.
 */
async function loadMissedEventInvites(userId: string) {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: recentEvents, error } = await supabase
      .from('calendar_events')
      .select('*')
      .contains('attendee_ids', [userId])
      .neq('owner_id', userId)
      .gte('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('[BrainSync] Failed to load missed event invites:', error.message);
      return;
    }

    if (recentEvents && recentEvents.length > 0) {
      console.log(`[BrainSync] Found ${recentEvents.length} recent event invite(s) to check`);
      for (const row of recentEvents) {
        if (shownEventPopups.has(row.id)) continue;
        shownEventPopups.add(row.id);
        handleEventInvitePopup(row as EventRow, userId);
      }
    }
  } catch (err) {
    console.warn('[BrainSync] loadMissedEventInvites error:', err);
  }
}
