/**
 * useInactivityDetector — Detects 30 minutes of inactivity and auto-checks out.
 *
 * Features:
 * - Monitors: mousemove, mousedown, keydown, scroll, touchstart, click
 * - After 30 min idle → auto checkout + set NOT_AT_WORK
 * - On beforeunload → attempt checkout via sendBeacon
 * - Sends heartbeat every 5 min to keep last_active_at fresh
 * - Re-activates when user returns after auto-checkout
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as attendanceService from '@/services/attendanceService';
import * as authService from '@/services/authService';
import { toast } from 'sonner';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useInactivityDetector() {
  const { currentUser, userWorkStatus, setUserWorkStatus } = useAppStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCheckedOutRef = useRef(false);
  const lastHeartbeatRef = useRef(0);

  // Heartbeat: update last_active_at in profiles table
  const sendHeartbeat = useCallback(async () => {
    if (!currentUser || !isSupabaseConfigured()) return;
    // Debounce: don't send more than once per 4 min
    const now = Date.now();
    if (now - lastHeartbeatRef.current < 4 * 60 * 1000) return;
    lastHeartbeatRef.current = now;

    try {
      await authService.sendHeartbeat(currentUser.id);
    } catch {
      // Best effort
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;

    const resetTimer = () => {
      // If previously auto-checked out, re-activate on user activity
      if (hasCheckedOutRef.current) {
        hasCheckedOutRef.current = false;
        console.log('[InactivityDetector] User returned, re-activating');
        // Only re-set to AT_WORK if they were auto-checked-out
        // Don't override if user manually set a different status
        if (userWorkStatus === 'NOT_AT_WORK') {
          setUserWorkStatus('AT_WORK', true); // skip GPS — re-activation after idle
          toast.success('다시 활동이 감지되어 출근 처리되었습니다');
        }
      }

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

    // Activity events to monitor (added mousemove + click for better detection)
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      resetTimer();
      // Also trigger heartbeat on activity (debounced inside sendHeartbeat)
      sendHeartbeat();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetTimer();

    // Send initial heartbeat
    sendHeartbeat();

    // Periodic heartbeat every 5 minutes
    heartbeatRef.current = setInterval(() => {
      if (!hasCheckedOutRef.current) {
        sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    // On page unload, attempt checkout + set NOT_AT_WORK via sendBeacon
    const handleBeforeUnload = () => {
      if (hasCheckedOutRef.current) return;

      if (isSupabaseConfigured()) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
          const today = new Date().toISOString().split('T')[0];
          const now = new Date().toISOString();

          // Checkout via sendBeacon (best effort)
          const attendanceUrl = `${supabaseUrl}/rest/v1/nexus_attendance?user_id=eq.${currentUser.id}&work_date=eq.${today}`;
          const attendanceBlob = new Blob([JSON.stringify({
            check_out_at: now,
            check_out_note: 'Auto checkout (page close)',
            status: 'completed',
          })], { type: 'application/json' });

          // Also set work_status to NOT_AT_WORK via sendBeacon
          const profileUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${currentUser.id}`;
          const profileBlob = new Blob([JSON.stringify({
            work_status: 'NOT_AT_WORK',
          })], { type: 'application/json' });

          try {
            navigator.sendBeacon(attendanceUrl, attendanceBlob);
            navigator.sendBeacon(profileUrl, profileBlob);
          } catch {
            // Best effort
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [currentUser?.id, userWorkStatus]);
}
