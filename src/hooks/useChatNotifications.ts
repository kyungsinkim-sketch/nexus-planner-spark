/**
 * useChatNotifications — Global hook for showing toast popups when
 * new chat messages arrive via Supabase Realtime.
 *
 * Shows a bottom-left toast with sender name + message preview.
 * Only fires for messages from OTHER users (not the current user or brain bot).
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/appStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { BRAIN_BOT_USER_ID } from '@/types/core';
import { playNotificationSound } from '@/services/notificationSoundService';

interface MessageRow {
  id: string;
  user_id: string;
  content: string;
  message_type: string;
  project_id?: string;
  room_id?: string;
  direct_chat_user_id?: string;
  created_at: string;
}

export function useChatNotifications() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const { currentUser } = useAppStore.getState();
    if (!currentUser) return;

    // Subscribe to ALL chat_messages INSERT events
    const channel = supabase
      .channel('global_chat_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const msg = payload.new as MessageRow;

          // Skip own messages and brain bot messages
          if (msg.user_id === currentUser.id) return;
          if (msg.user_id === BRAIN_BOT_USER_ID) return;
          // Skip non-text messages (file uploads, brain actions, etc.)
          if (msg.message_type && msg.message_type !== 'text') return;

          // Get sender name from store
          const state = useAppStore.getState();
          const sender = state.getUserById(msg.user_id);
          const senderName = sender?.name || '알 수 없는 사용자';

          // Determine context label
          let contextLabel = '';
          if (msg.project_id) {
            const project = state.projects.find(p => p.id === msg.project_id);
            contextLabel = project ? project.title : '';
          } else if (msg.direct_chat_user_id) {
            contextLabel = '1:1 대화';
          }

          // Preview: truncate message
          const preview = msg.content.length > 60
            ? msg.content.slice(0, 60) + '…'
            : msg.content;

          // Show toast notification (bottom-left via position override)
          toast(senderName, {
            description: `${contextLabel ? `[${contextLabel}] ` : ''}${preview}`,
            duration: 5000,
            position: 'bottom-left',
            icon: '💬',
          });

          // Play notification sound
          if (state.notificationSoundEnabled) {
            playNotificationSound('message');
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
  }, []);
}
