/**
 * realtimeNotificationService.ts — Central realtime listener for project activity notifications.
 *
 * Subscribes to Supabase Realtime on:
 * - calendar_events (INSERT) → "새 일정이 추가되었습니다"
 * - personal_todos (INSERT) → "새 할 일이 배정되었습니다"
 * - important_notes (INSERT/UPDATE) → "중요 기록이 업데이트되었습니다"
 * - chat_messages (INSERT) for project rooms → already handled by addMessage; skip here
 *
 * Generates AppNotification entries via addAppNotification().
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAppStore } from '@/stores/appStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

let _channel: RealtimeChannel | null = null;
let _channelUserId: string | null = null;

export function startRealtimeNotifications(userId: string): () => void {
  if (!isSupabaseConfigured()) return () => {};

  // Same user already subscribed — return no-op cleanup (keep shared channel alive)
  if (_channel && _channelUserId === userId) return () => {};

  // Different user (account switch) or stale channel — tear down first
  if (_channel) {
    supabase.removeChannel(_channel);
    _channel = null;
    _channelUserId = null;
  }

  _channelUserId = userId;
  const channelName = `activity_notifs_${userId.slice(0, 8)}`;

  _channel = supabase
    .channel(channelName)
    // Calendar events — new invites/events in user's projects
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'calendar_events' },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        // Skip events created by the current user
        if (row.owner_id === userId) return;
        const store = useAppStore.getState();
        const attendeeIds = (row.attendee_ids as string[]) || [];
        const project = store.projects.find(p => p.id === row.project_id);
        // Notify if user is in the project OR is an attendee
        const isInProject = !!project;
        const isAttendee = attendeeIds.includes(userId);
        if (!isInProject && !isAttendee) return;

        // Title fallback: attendee who isn't in the project won't have project lookup
        const notifTitle = project?.title || '캘린더';
        store.addAppNotification({
          type: 'event',
          title: notifTitle,
          message: `📅 새 일정: ${(row.title as string) || '제목 없음'}`,
          projectId: (row.project_id as string) || undefined,
          sourceId: `cal-${row.id}`,
        });
      }
    )
    // Todos — new assignments
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'personal_todos' },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        // Only notify if assigned to the current user by someone else
        const assigneeIds = (row.assignee_ids as string[]) || [];
        if (!assigneeIds.includes(userId)) return; // Not assigned to me
        if (row.requested_by_id === userId) return; // I created it myself
        const store = useAppStore.getState();
        const project = store.projects.find(p => p.id === row.project_id);
        const projectName = project?.title || '';

        store.addAppNotification({
          type: 'todo',
          title: projectName || 'TODO',
          message: `✅ 새 할 일: ${(row.title as string) || (row.content as string) || ''}`.slice(0, 100),
          projectId: row.project_id as string | undefined,
          sourceId: `todo-${row.id}`,
        });
      }
    )
    // Important notes — INSERT: sync local state + notify (project members only)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'important_notes' },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        const store = useAppStore.getState();
        const noteId = row.id as string;
        const projectId = row.project_id as string;

        // Membership guard — only sync/notify for projects the user actually
        // belongs to. SELECT RLS (migration 102) also enforces this server-side
        // so most off-limits broadcasts will never arrive, but the guard keeps
        // client state sane even if realtime and RLS fall out of step.
        const project = store.projects.find(p => p.id === projectId);
        if (!project) return;

        // Sync store (cross-device, cross-tab)
        const existing = store.importantNotes || [];
        if (!existing.some(n => n.id === noteId)) {
          const note = {
            id: noteId,
            projectId: projectId || '',
            title: (row.title as string) || undefined,
            content: (row.content as string) || '',
            sourceMessageId: (row.source_message_id as string) || undefined,
            createdBy: row.created_by as string,
            createdAt: row.created_at as string,
          };
          useAppStore.setState({ importantNotes: [note, ...existing] });
        }

        // Notification: skip if I created it
        if (row.created_by === userId) return;

        store.addAppNotification({
          type: 'todo', // reuse todo type for now
          title: project.title,
          message: `📌 새 중요 기록: ${(row.title as string) || (row.content as string)?.slice(0, 60) || ''}`,
          projectId,
          sourceId: `note-${row.id}`,
        });
      }
    )
    // Important notes — UPDATE: sync local state + notify (project members only)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'important_notes' },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        const store = useAppStore.getState();
        const noteId = row.id as string;
        const projectId = row.project_id as string;

        // Membership guard (see INSERT note above)
        const project = store.projects.find(p => p.id === projectId);
        if (!project) return;

        // Sync store — replace in-place with fresh fields
        const existing = store.importantNotes || [];
        const idx = existing.findIndex(n => n.id === noteId);
        if (idx >= 0) {
          const updated = [...existing];
          updated[idx] = {
            ...updated[idx],
            title: (row.title as string) || undefined,
            content: (row.content as string) || updated[idx].content,
          };
          useAppStore.setState({ importantNotes: updated });
        }

        // Skip notification for the author's own edits. We cannot identify
        // the editor separately because the schema has no `updated_by`
        // column, so co-edits by other members still notify the author —
        // that's acceptable since the author usually wants to know.
        if (row.created_by === userId) return;

        // Supabase broadcasts include a commit_timestamp at the payload
        // level — use it when available so each edit has a unique dedup
        // sourceId, otherwise fall back to wall-clock.
        const commitTs = (payload as { commit_timestamp?: string }).commit_timestamp;
        const updateKey = commitTs || String(Date.now());
        store.addAppNotification({
          type: 'todo',
          title: project.title,
          message: `📝 중요 기록 수정: ${(row.title as string) || (row.content as string)?.slice(0, 60) || ''}`,
          projectId,
          sourceId: `note-update-${row.id}-${updateKey}`,
        });
      }
    )
    // Important notes — DELETE: sync local state (no notification)
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'important_notes' },
      (payload) => {
        // DELETE payloads only include the primary key columns (old.id),
        // not project_id — Supabase strips non-PK columns on delete. We
        // therefore cannot do a membership guard here, but removing by id
        // from local state is always safe: if the id isn't in our state
        // we silently no-op.
        const old = payload.old as Record<string, unknown>;
        const deletedId = old.id as string;
        if (!deletedId) return;
        const store = useAppStore.getState();
        const existing = store.importantNotes || [];
        if (!existing.some(n => n.id === deletedId)) return;
        useAppStore.setState({
          importantNotes: existing.filter(n => n.id !== deletedId),
        });
      }
    )
    .subscribe();

  return () => {
    if (_channel && _channelUserId === userId) {
      supabase.removeChannel(_channel);
      _channel = null;
      _channelUserId = null;
    }
  };
}
