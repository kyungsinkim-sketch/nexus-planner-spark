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

export function startRealtimeNotifications(userId: string): () => void {
  if (!isSupabaseConfigured() || _channel) return () => {};

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
        const project = store.projects.find(p => p.id === row.project_id);
        if (!project) return; // Only notify for projects user is part of

        store.addAppNotification({
          type: 'event',
          title: project.title,
          message: `📅 새 일정: ${(row.title as string) || '제목 없음'}`,
          projectId: row.project_id as string,
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
        if (row.user_id !== userId) return; // Not assigned to me
        if (row.created_by === userId) return; // I created it myself
        const store = useAppStore.getState();
        const project = store.projects.find(p => p.id === row.project_id);
        const projectName = project?.title || '';

        store.addAppNotification({
          type: 'todo',
          title: projectName || 'TODO',
          message: `✅ 새 할 일: ${(row.title as string) || (row.content as string) || ''}`.slice(0, 100),
          projectId: row.project_id as string | undefined,
        });
      }
    )
    // Important notes — updates by others
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'important_notes' },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row.created_by === userId) return;
        const store = useAppStore.getState();
        const project = store.projects.find(p => p.id === row.project_id);
        if (!project) return;

        store.addAppNotification({
          type: 'todo', // reuse todo type for now
          title: project.title,
          message: `📌 새 중요 기록: ${(row.title as string) || (row.content as string)?.slice(0, 60) || ''}`,
          projectId: row.project_id as string,
        });
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'important_notes' },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row.updated_by === userId || row.created_by === userId) return;
        const store = useAppStore.getState();
        const project = store.projects.find(p => p.id === row.project_id);
        if (!project) return;

        store.addAppNotification({
          type: 'todo',
          title: project.title,
          message: `📝 중요 기록 수정: ${(row.title as string) || (row.content as string)?.slice(0, 60) || ''}`,
          projectId: row.project_id as string,
        });
      }
    )
    .subscribe();

  return () => {
    if (_channel) {
      supabase.removeChannel(_channel);
      _channel = null;
    }
  };
}
