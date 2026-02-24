/**
 * useUserStatusRefresh — Periodically refreshes the user list
 * to detect stale work statuses (users who left but still show as AT_WORK).
 *
 * - Runs every 10 minutes while the app is active
 * - loadUsers() → transformUser() applies 30-min stale detection
 * - Users whose last_active_at > 30min are automatically shown as NOT_AT_WORK
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { isSupabaseConfigured } from '@/lib/supabase';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function useUserStatusRefresh() {
  const { currentUser, loadUsers } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured()) return;

    // Initial refresh (in case users changed since login)
    const initialTimer = setTimeout(() => {
      loadUsers();
    }, 5000); // 5 seconds after mount

    // Periodic refresh
    intervalRef.current = setInterval(() => {
      console.log('[UserStatusRefresh] Refreshing user list for stale detection');
      loadUsers();
    }, REFRESH_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentUser?.id]);
}
