/**
 * Chat Reaction Service — Supabase CRUD for message emoji reactions.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ChatReaction } from '@/types/core';

interface ReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

/** Fetch reactions for a set of message IDs, grouped by emoji */
export async function getReactionsForMessages(messageIds: string[]): Promise<Record<string, ChatReaction[]>> {
  if (!isSupabaseConfigured() || messageIds.length === 0) return {};

  const { data, error } = await supabase
    .from('chat_reactions')
    .select('*')
    .in('message_id', messageIds);

  if (error) {
    console.error('[Reactions] fetch error:', error);
    return {};
  }

  // Group by message_id, then by emoji
  const result: Record<string, ChatReaction[]> = {};
  for (const row of (data || []) as ReactionRow[]) {
    if (!result[row.message_id]) result[row.message_id] = [];
    const existing = result[row.message_id].find(r => r.emoji === row.emoji);
    if (existing) {
      existing.userIds.push(row.user_id);
    } else {
      result[row.message_id].push({ emoji: row.emoji, userIds: [row.user_id] });
    }
  }
  return result;
}

/** Toggle a reaction — add if not exists, remove if exists */
export async function toggleReaction(messageId: string, userId: string, emoji: string): Promise<'added' | 'removed'> {
  if (!isSupabaseConfigured()) return 'added';

  // Check if exists
  const { data: existing } = await supabase
    .from('chat_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from('chat_reactions').delete().eq('id', existing.id);
    return 'removed';
  } else {
    await supabase.from('chat_reactions').insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    });
    return 'added';
  }
}
