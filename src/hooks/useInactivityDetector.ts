/**
 * useInactivityDetector — Detects 30 minutes of inactivity and auto-checks out.
 *
 * Monitors: mousedown, keydown, scroll, touchstart
 * After 30 min idle → auto checkout + set NOT_AT_WORK
 * On beforeunload → attempt checkout via sendBeacon
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as attendanceService from '@/services/attendanceService';
import { toast } from 'sonner';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function useInactivityDetector() {
  const { currentUser, setUserWorkStatus } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCheckedOutRef = useRef(false);

  useEffect(() => {
    if (!currentUser) return;

    const resetTimer = () => {
      if (hasCheckedOutRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        // 30 minutes of inactivity
        console.log('[InactivityDetector] 30min idle, auto checkout');
        hasCheckedOutRef.current = true;

        setUserWorkStatus('NOT_AT_WORK');

        if (isSupabaseConfigured()) {
          try {
            await attendanceService.checkOut({ note: 'Auto checkout (30min idle)' });
          } catch (e) {
            console.warn('[InactivityDetector] Failed to record checkout:', e);
          }
        }

        toast.info('30분간 활동이 없어 자동으로 퇴근 처리되었습니다');
      }, INACTIVITY_TIMEOUT_MS);
    };

    // Activity events to monitor
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Start initial timer
    resetTimer();

    // On page unload, attempt checkout
    const handleBeforeUnload = () => {
      if (hasCheckedOutRef.current) return;

      if (isSupabaseConfigured()) {
        // Use sendBeacon for reliable delivery on page close
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const today = new Date().toISOString().split('T')[0];
          const now = new Date().toISOString();

          // Note: sendBeacon with Supabase REST API
          const url = `${supabaseUrl}/rest/v1/nexus_attendance?user_id=eq.${currentUser.id}&work_date=eq.${today}`;
          const blob = new Blob([JSON.stringify({
            check_out_at: now,
            check_out_note: 'Auto checkout (page close)',
            status: 'completed',
          })], { type: 'application/json' });

          // sendBeacon doesn't support custom headers well, so this is best-effort
          try {
            navigator.sendBeacon(url, blob);
          } catch {
            // Best effort, ignore errors
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentUser?.id]);
}
