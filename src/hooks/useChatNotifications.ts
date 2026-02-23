/**
 * useChatNotifications — Global hook for:
 * 1. Showing toast popups when new chat messages arrive via Supabase Realtime.
 * 2. Adding messages to the global store so bell-icon (appNotifications) are generated.
 *
 * Shows a bottom-left toast with sender name + message preview.
 * Only fires for messages from OTHER users (not the current user or brain bot).
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
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

          // Skip own messages
          if (msg.user_id === currentUser.id) return;

          // Add to global store (creates appNotification for bell icon if not in active chat)
          // addMessage() handles duplicate prevention and active-chat suppression internally
          const chatMessage = rowToChatMessage(msg);
          useAppStore.getState().addMessage(chatMessage);

          // Check if this message is for the currently active/visible chat — skip toast if so
          const state = useAppStore.getState();
          const ctx = state.activeChatContext;
          if (ctx) {
            const isActive =
              (ctx.type === 'project' && ctx.roomId && msg.room_id === ctx.roomId) ||
              (ctx.type === 'project' && !ctx.roomId && msg.project_id === ctx.id && !msg.room_id) ||
              (ctx.type === 'direct' && (msg.direct_chat_user_id === ctx.id || msg.user_id === ctx.id));
            if (isActive) return; // User is looking at this chat — no toast
          }

          // Skip brain bot and non-text for toast popup (too noisy)
          if (msg.user_id === BRAIN_BOT_USER_ID) return;
          if (msg.message_type && msg.message_type !== 'text') return;

          // Get sender name from store
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
