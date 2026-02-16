/**
 * Brain AI Service — Client-side API for @brain mention processing
 *
 * Calls Supabase Edge Functions:
 * - brain-process: Sends message to LLM for action extraction
 * - brain-execute: Executes a confirmed action (create todo/event/location)
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { BrainAction, BrainActionStatus } from '@/types/core';

interface ChatMember {
  id: string;
  name: string;
}

interface BrainProcessRequest {
  messageContent: string;
  roomId?: string;
  projectId?: string;
  userId: string;
  chatMembers: ChatMember[];
  projectTitle?: string;
}

interface BrainProcessResponse {
  success: boolean;
  message: Record<string, unknown>;
  actions: Record<string, unknown>[];
  llmResponse: {
    hasAction: boolean;
    replyMessage: string;
    actionCount: number;
  };
}

interface BrainExecuteResponse {
  success: boolean;
  actionId: string;
  executedData: Record<string, unknown>;
}

/**
 * Send a message to the Brain AI for analysis.
 * This triggers the brain-process Edge Function which:
 * 1. Calls Claude LLM to analyze the message
 * 2. Creates a bot chat_message with brain_action_data
 * 3. Creates brain_actions rows for each extracted action
 *
 * The bot message will appear via realtime subscription.
 */
export async function processMessage(
  request: BrainProcessRequest,
): Promise<BrainProcessResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.functions.invoke('brain-process', {
    body: request,
  });

  if (error) {
    console.error('brain-process invocation error:', error);
    throw new Error(`Brain process failed: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Brain process returned unsuccessful response');
  }

  return data as BrainProcessResponse;
}

/**
 * Execute a confirmed brain action.
 * This triggers the brain-execute Edge Function which:
 * 1. Reads the brain_action row
 * 2. Creates the actual entity (todo, event, location)
 * 3. Updates the action status to 'executed'
 */
export async function executeAction(
  actionId: string,
  userId: string,
): Promise<BrainExecuteResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.functions.invoke('brain-execute', {
    body: { actionId, userId },
  });

  if (error) {
    console.error('brain-execute invocation error:', error);
    throw new Error(`Brain execute failed: ${error.message}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Brain execute returned unsuccessful response');
  }

  return data as BrainExecuteResponse;
}

/**
 * Update a brain action's status (confirm or reject).
 * Called directly via Supabase client (no Edge Function needed).
 */
export async function updateActionStatus(
  actionId: string,
  status: BrainActionStatus,
  userId: string,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const updateData: Record<string, unknown> = {
    status,
    confirmed_by: userId,
  };

  if (status === 'rejected') {
    // No execution needed
    updateData.executed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('brain_actions')
    .update(updateData)
    .eq('id', actionId);

  if (error) {
    console.error('Failed to update brain action status:', error);
    throw new Error(`Failed to update action: ${error.message}`);
  }
}

/**
 * Get brain actions for a specific message.
 */
export async function getActionsByMessage(
  messageId: string,
): Promise<BrainAction[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('brain_actions')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch brain actions: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    messageId: row.message_id,
    actionType: row.action_type,
    status: row.status,
    extractedData: row.extracted_data,
    executedData: row.executed_data || undefined,
    confirmedBy: row.confirmed_by || undefined,
    createdAt: row.created_at,
    executedAt: row.executed_at || undefined,
  })) as BrainAction[];
}

/**
 * Detect if a message content contains @brain mention.
 * Returns the message content without the @brain prefix.
 */
export function detectBrainMention(content: string): {
  isBrainMention: boolean;
  cleanContent: string;
} {
  // Match @brain or @Brain at the start of the message
  const brainPattern = /^@brain\s+/i;
  const match = content.match(brainPattern);

  if (match) {
    return {
      isBrainMention: true,
      cleanContent: content.replace(brainPattern, '').trim(),
    };
  }

  return {
    isBrainMention: false,
    cleanContent: content,
  };
}
