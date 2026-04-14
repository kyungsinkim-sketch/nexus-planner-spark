/**
 * useBrainBriefing — Ensures today's Brain AI briefing is persisted in the
 * user's Brain DM chat, and shows a toast popup for the first access per day.
 *
 * Persistence is handled by `brainBriefingService.ensureTodaysBriefing`,
 * which is idempotent at the DB level — calling it multiple times or from
 * multiple devices never creates duplicate rows. The localStorage flag here
 * is solely for toast-dedup: we don't want to nag the user with the popup
 * on every remount, but the chat row itself should exist regardless.
 */

import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { showBrainPopup } from '@/components/brain/BrainPopupToast';
import {
  ensureTodaysBriefing,
  getTodayKstDateKey,
} from '@/services/brainBriefingService';

export function useBrainBriefing() {
  const currentUser = useAppStore((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser?.id) return;

    // Delay so events/todos have time to load into the store.
    const timer = setTimeout(async () => {
      const state = useAppStore.getState();
      const events = state.getMyEvents?.() || state.events || [];
      const todos = state.personalTodos || [];
      const notifications = state.appNotifications || [];

      // Persist today's briefing as a Brain→user DM (idempotent). We pass
      // the raw events list — the service handles KST-day filtering and
      // "owned by / attended by" scoping itself.
      const { text } = await ensureTodaysBriefing(currentUser, {
        language: state.language,
        events,
        todos,
        notifications,
      });

      // Toast popup: only show once per day per device.
      const todayKey = getTodayKstDateKey();
      const storageKey = `brain_briefing_toast_${currentUser.id}`;
      const lastShown = localStorage.getItem(storageKey);
      if (lastShown === todayKey) return;

      const firstName = currentUser.name?.split(' ')[0] || '';
      const kstHour = parseInt(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'Asia/Seoul',
          hour: 'numeric',
          hour12: false,
        }),
        10,
      );
      const greeting = kstHour < 12 ? '좋은 아침' : kstHour < 18 ? '좋은 오후' : '좋은 저녁';

      showBrainPopup({
        id: `briefing_${todayKey}`,
        title: `${greeting}, ${firstName}님!`,
        message: text,
        source: 'briefing',
      });

      localStorage.setItem(storageKey, todayKey);
    }, 3000);

    return () => clearTimeout(timer);
    // Intentionally key on currentUser?.id only — the rest of the currentUser
    // object (name, language) is snapshotted inside the timer via getState().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);
}
