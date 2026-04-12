/**
 * useBrainBriefing — Shows a Brain AI briefing popup on first access each day.
 * Desktop equivalent of the mobile MobileAIChatView morning briefing.
 * Uses sonner toast.custom() via BrainPopupToast.
 */

import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { showBrainPopup } from '@/components/brain/BrainPopupToast';

export function useBrainBriefing() {
  const currentUser = useAppStore((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser?.id) return;

    // Check if already shown today
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const storageKey = `brain_briefing_desktop_${currentUser.id}`;
    const lastShown = localStorage.getItem(storageKey);
    if (lastShown === todayKey) return;

    // Delay to let data load first
    const timer = setTimeout(() => {
      const state = useAppStore.getState();
      const myEvents = state.getMyEvents?.() || state.events || [];
      const myTodos = state.personalTodos || [];

      // Filter today's events (KST)
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
      const todayEvents = myEvents.filter(e => {
        const eDate = new Date(e.startAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        return eDate === todayStr;
      });

      // Pending todos — only todos assigned to current user
      const myId = currentUser.id;
      const pendingTodos = myTodos.filter(t => {
        const s = (t.status || '').toUpperCase();
        if (s === 'COMPLETED' || s === 'DONE' || s === 'CANCELLED') return false;
        // Only include todos assigned to me (exclude todos I requested for others)
        const isAssignee = t.assigneeIds?.includes(myId);
        if (!isAssignee) return false;
        return true;
      });

      const dueTodayTodos = pendingTodos.filter(t => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) === todayStr;
      });

      // Build briefing message
      const lang = state.language || 'ko';
      const name = currentUser.name?.split(' ')[0] || '';
      const kstHour = parseInt(new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }), 10);
      const greeting = kstHour < 12 ? '좋은 아침' : kstHour < 18 ? '좋은 오후' : '좋은 저녁';

      let message = '';
      if (lang === 'ko') {
        if (todayEvents.length > 0) {
          const eventList = todayEvents
            .sort((a, b) => a.startAt.localeCompare(b.startAt))
            .slice(0, 3)
            .map(e => {
              const time = new Date(e.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul', hour12: false });
              return `${time} ${e.title}`;
            })
            .join(', ');
          message += `📅 오늘 일정 ${todayEvents.length}건: ${eventList}`;
          if (todayEvents.length > 3) message += ` 외 ${todayEvents.length - 3}건`;
        } else {
          message += '📅 오늘 예정된 일정이 없습니다.';
        }

        if (pendingTodos.length > 0) {
          message += `\n✅ 할 일 ${pendingTodos.length}건`;
          if (dueTodayTodos.length > 0) message += ` (오늘 마감 ${dueTodayTodos.length}건)`;
        }
      } else {
        if (todayEvents.length > 0) {
          message += `📅 ${todayEvents.length} event(s) today`;
        } else {
          message += '📅 No events scheduled today.';
        }
        if (pendingTodos.length > 0) {
          message += `\n✅ ${pendingTodos.length} pending todo(s)`;
        }
      }

      showBrainPopup({
        id: `briefing_${todayStr}`,
        title: `${greeting}, ${name}님!`,
        message,
        source: 'briefing',
      });

      localStorage.setItem(storageKey, todayKey);
    }, 3000); // 3s delay for data loading

    return () => clearTimeout(timer);
  }, [currentUser?.id]);
}
