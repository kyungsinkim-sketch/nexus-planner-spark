/**
 * useChatNotifications — Global hook for:
 * 1. Adding messages to the global store so bell-icon (appNotifications) are generated.
 * 2. OS native notifications are triggered by addAppNotification() in appStore.
 *
 * Only fires for messages from OTHER users (not the current user or brain bot).
 * Toast popups removed — notifications shown only in navbar bell + OS native.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { BRAIN_BOT_USER_ID } from '@/types/core';
import type { ChatMessage, ChatMessageType } from '@/types/core';

interface MessageRow {
  id: string;
  user_id: string;
  content: string;
  message_type: string;
  project_id?: string;
  room_id?: string;
  direct_chat_user_id?: string;
  created_at: string;
  brain_action_data?: Record<string, unknown>;
  persona_response_data?: Record<string, unknown>;
  attachment_id?: string;
  location_data?: Record<string, unknown>;
  schedule_data?: Record<string, unknown>;
  decision_data?: Record<string, unknown>;
}

/** Map Supabase row to ChatMessage for store injection */
function rowToChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    messageType: (row.message_type || 'text') as ChatMessageType,
    projectId: row.project_id || '',
    roomId: row.room_id || undefined,
    directChatUserId: row.direct_chat_user_id || undefined,
    createdAt: row.created_at,
    brainActionData: row.brain_action_data || undefined,
    personaResponseData: row.persona_response_data || undefined,
    attachmentId: row.attachment_id || undefined,
    locationData: row.location_data as ChatMessage['locationData'],
    scheduleData: row.schedule_data as ChatMessage['scheduleData'],
    decisionData: row.decision_data as ChatMessage['decisionData'],
  };
}

export function useChatNotifications() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUser = useAppStore((s) => s.currentUser);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (!currentUser) return;

    // Clean up any previous channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

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
          console.log('[ChatNotif] Realtime INSERT received:', { id: msg.id, from: msg.user_id, dm: msg.direct_chat_user_id, room: msg.room_id, content: msg.content?.slice(0, 30) });

          // Skip own messages
          if (msg.user_id === currentUser.id) {
            console.log('[ChatNotif] Skipped: own message');
            return;
          }

          // Skip brain bot DM messages from the global subscription — they are loaded
          // through getDirectMessages() when the DM is opened, which scopes by
          // conversation pair. This prevents cross-user AI response leakage.
          if (msg.user_id === BRAIN_BOT_USER_ID && msg.direct_chat_user_id) return;

          const state = useAppStore.getState();

          // ── DM: only notify if I'm part of this conversation ──
          if (msg.direct_chat_user_id) {
            // DM is between msg.user_id and msg.direct_chat_user_id
            const myId = currentUser.id;
            const isMyDm = msg.user_id === myId || msg.direct_chat_user_id === myId;
            if (!isMyDm) return; // Not my DM — skip
          }

          // ── Project chat: only notify if I'm a member of this project ──
          if (msg.project_id) {
            const project = state.projects.find(p => p.id === msg.project_id);
            if (!project) return; // Not in this project — skip
          }

          // ── Group chat: only notify if I'm a member of this room ──
          if (msg.room_id && !msg.project_id && !msg.direct_chat_user_id) {
            const groupRooms = state.getGroupRooms();
            const isMember = groupRooms.some(r => r.id === msg.room_id);
            if (!isMember) return; // Not in this group chat — skip
          }

          // Add to global store (creates appNotification for bell icon if not in active chat)
          // addMessage() handles duplicate prevention and active-chat suppression internally
          const chatMessage = rowToChatMessage(msg);
          console.log('[ChatNotif] Adding to store:', { id: chatMessage.id, existing: useAppStore.getState().messages.some(m => m.id === chatMessage.id) });
          useAppStore.getState().addMessage(chatMessage);

          // addMessage() internally creates appNotification for the bell icon
          // and triggers OS native notification via sendNotificationIfBackground()
          // No toast popup — notification shown only in navbar bell + OS native.
        },
      )
      .subscribe((status) => {
        console.log('[ChatNotif] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUser?.id]);
}
