/**
 * notificationSyncService.ts — Cross-device notification read/dismiss sync.
 *
 * When a notification is read on one device (iOS / Web / macOS Desktop),
 * the read state is written to `notification_read_state` in Supabase.
 * All other devices subscribe to Realtime INSERTs on that table and
 * locally mark the notification as read, making it disappear from their UI.
 *
 * Flow:
 *   Device A reads notif → syncNotificationRead() → Supabase INSERT
 *   → Realtime broadcast → Device B, C receive → onRead callback → local state update
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getPlatform } from '@/lib/platform';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppNotificationType } from '@/types/core';

// ─── Types ──────────────────────────────────────────

interface ReadStateRow {
  id: string;
  user_id: string;
  notification_id: string;
  notification_type: string;
  source_id: string | null;
  project_id: string | null;
  room_id: string | null;
  read_at: string;
  read_on_platform: string | null;
}

export interface NotificationReadEvent {
  notificationId: string;
  notificationType: AppNotificationType;
  sourceId?: string;
  projectId?: string;
  roomId?: string;
  readAt: string;
  readOnPlatform?: string;
}

// ─── Module state ───────────────────────────────────

let _channel: RealtimeChannel | null = null;
let _userId: string | null = null;
let _syncing = false;

/**
 * Flag to suppress sync-back when processing a remote read event.
 * Prevents infinite loops: read → sync → realtime → read → sync → …
 */
let _suppressSync = false;

export function isSyncSuppressed(): boolean {
  return _suppressSync;
}

// ─── Start Sync ─────────────────────────────────────

/**
 * Start cross-device notification sync.
 *
 * 1. Fetches recent read states (last 24h) from Supabase → reconciles local state
 * 2. Subscribes to Realtime INSERTs on `notification_read_state` → fires `onRead` callback
 *
 * @param userId     Authenticated user's UUID
 * @param onRead     Called when a single notification is read on another device
 * @param onBulkRead Called when multiple notifications are read (initial reconciliation)
 */
export async function startNotificationSync(
  userId: string,
  onRead: (event: NotificationReadEvent) => void,
  onBulkRead?: (events: NotificationReadEvent[]) => void,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (_channel) return; // Already running

  _userId = userId;

  // 1. Initial reconciliation — fetch read states from last 24 hours
  try {
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const { data, error } = await supabase
      .from('notification_read_state')
      .select('*')
      .eq('user_id', userId)
      .gte('read_at', since.toISOString())
      .order('read_at', { ascending: false })
      .limit(500);

    if (!error && data && data.length > 0) {
      const events = data.map(rowToEvent);
      // Suppress sync during reconciliation (these are already in DB)
      _suppressSync = true;
      try {
        if (onBulkRead) {
          onBulkRead(events);
        } else {
          events.forEach(onRead);
        }
      } finally {
        _suppressSync = false;
      }
      console.log(`[NotifSync] Reconciled ${data.length} read states from last 24h`);
    }
  } catch (error) {
    console.error('[NotifSync] Initial reconciliation failed:', error);
  }

  // 2. Subscribe to Realtime INSERTs
  _channel = supabase
    .channel(`notif-read-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notification_read_state',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as ReadStateRow;

        // Ignore events from this platform (we already handled it locally)
        const myPlatform = getPlatformShort();
        if (row.read_on_platform === myPlatform) return;

        const event = rowToEvent(row);
        // Suppress sync-back (this is already in DB via another device)
        _suppressSync = true;
        try {
          onRead(event);
        } finally {
          _suppressSync = false;
        }

        console.log(`[NotifSync] Remote read: ${event.notificationId} from ${row.read_on_platform}`);
      },
    )
    .subscribe();

  console.log('[NotifSync] Realtime subscription started');
}

// ─── Sync Read ──────────────────────────────────────

/**
 * Sync a single notification read event to Supabase.
 * Called from appStore.markAppNotificationRead().
 */
export async function syncNotificationRead(
  userId: string,
  notificationId: string,
  notificationType: AppNotificationType,
  sourceId?: string,
  projectId?: string,
  roomId?: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (_suppressSync) return; // Prevent sync-back loops

  try {
    await supabase
      .from('notification_read_state')
      .upsert(
        {
          user_id: userId,
          notification_id: notificationId,
          notification_type: notificationType,
          source_id: sourceId || null,
          project_id: projectId || null,
          room_id: roomId || null,
          read_at: new Date().toISOString(),
          read_on_platform: getPlatformShort(),
        },
        { onConflict: 'user_id,notification_id' },
      );
  } catch (error) {
    console.error('[NotifSync] syncNotificationRead failed:', error);
  }
}

/**
 * Sync bulk notification read events to Supabase.
 * Called from appStore.markAllAppNotificationsRead().
 */
export async function syncBulkNotificationRead(
  userId: string,
  notifications: Array<{
    id: string;
    type: AppNotificationType;
    sourceId?: string;
    projectId?: string;
    roomId?: string;
  }>,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (_suppressSync) return;
  if (notifications.length === 0) return;

  const platform = getPlatformShort();
  const now = new Date().toISOString();

  // Batch insert in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < notifications.length; i += CHUNK_SIZE) {
    const chunk = notifications.slice(i, i + CHUNK_SIZE);
    try {
      await supabase
        .from('notification_read_state')
        .upsert(
          chunk.map((n) => ({
            user_id: userId,
            notification_id: n.id,
            notification_type: n.type,
            source_id: n.sourceId || null,
            project_id: n.projectId || null,
            room_id: n.roomId || null,
            read_at: now,
            read_on_platform: platform,
          })),
          { onConflict: 'user_id,notification_id' },
        );
    } catch (error) {
      console.error(`[NotifSync] Bulk sync chunk ${i} failed:`, error);
    }
  }
}

// ─── Stop Sync ──────────────────────────────────────

/**
 * Stop cross-device notification sync (on sign-out).
 */
export function stopNotificationSync(): void {
  if (_channel) {
    supabase.removeChannel(_channel);
    _channel = null;
  }
  _userId = null;
  _suppressSync = false;
  console.log('[NotifSync] Stopped');
}

// ─── Helpers ────────────────────────────────────────

function rowToEvent(row: ReadStateRow): NotificationReadEvent {
  return {
    notificationId: row.notification_id,
    notificationType: row.notification_type as AppNotificationType,
    sourceId: row.source_id || undefined,
    projectId: row.project_id || undefined,
    roomId: row.room_id || undefined,
    readAt: row.read_at,
    readOnPlatform: row.read_on_platform || undefined,
  };
}

function getPlatformShort(): string {
  const p = getPlatform();
  if (p === 'mobile') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    return 'ios';
  }
  if (p === 'desktop') return 'macos';
  return 'web';
}
