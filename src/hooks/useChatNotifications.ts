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

          // Skip own messages
          if (msg.user_id === currentUser.id) return;

          // Skip brain bot DM messages from the global subscription — they are loaded
          // through getDirectMessages() when the DM is opened, which scopes by
          // conversation pair. This prevents cross-user AI response leakage.
          if (msg.user_id === BRAIN_BOT_USER_ID && msg.direct_chat_user_id) return;

          // Add to global store (creates appNotification for bell icon if not in active chat)
          // addMessage() handles duplicate prevention and active-chat suppression internally
          const chatMessage = rowToChatMessage(msg);
          useAppStore.getState().addMessage(chatMessage);

          // addMessage() internally creates appNotification for the bell icon
          // and triggers OS native notification via sendNotificationIfBackground()
          // No toast popup — notification shown only in navbar bell + OS native.
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
  }, [currentUser?.id]);
}
