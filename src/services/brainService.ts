/**
 * Brain AI Service — Client-side API for @ai mention processing
 *
 * Processing modes:
 * 1. **LLM** (processMessageWithLLM) — Primary. Claude Haiku via brain-process Edge Function.
 * 2. **Local Regex** (processMessageLocally) — Legacy fallback. Korean pattern matching.
 *
 * Execution:
 * - brain-execute: Executes a confirmed action (create todo/event/location)
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { BrainAction, BrainActionStatus } from '@/types/core';
import { parseMessageWithRegex } from './koreanParser';

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
 * Extract a readable error message from Supabase FunctionsHttpError.
 */
async function extractFunctionError(error: unknown): Promise<string> {
  try {
    // FunctionsHttpError has a context property with the Response
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      return body?.error || body?.message || JSON.stringify(body);
    }
  } catch {
    // ignore
  }
  return (error as Error)?.message || 'Unknown error';
}

/**
 * Process a message locally using Korean regex pattern matching.
 * Auto-parses ALL project chat messages (no @ai trigger required).
 *
 * Flow:
 * 1. koreanParser.parseMessageWithRegex() extracts actions client-side
 * 2. If no actions found → silently return (no bot message, no noise)
 * 3. If actions found → calls brain-create-action Edge Function (creates bot message + brain_actions)
 * 4. Bot message arrives via realtime subscription
 */
export async function processMessageLocally(
  request: BrainProcessRequest,
): Promise<BrainProcessResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  // 1. Parse with regex
  const parseResult = parseMessageWithRegex(
    request.messageContent,
    request.chatMembers,
    request.projectId,
  );

  // 2. If no actions found, return silently — don't create bot messages for
  //    normal conversation. This is critical for auto-parse mode.
  if (!parseResult.hasAction || parseResult.actions.length === 0) {
    return {
      success: true,
      message: {},
      actions: [],
      llmResponse: {
        hasAction: false,
        replyMessage: '',
        actionCount: 0,
      },
    };
  }

  // 3. Actions found — send to Edge Function to create bot message + brain_actions
  const { data, error } = await supabase.functions.invoke('brain-create-action', {
    body: {
      replyMessage: parseResult.replyMessage,
      actions: parseResult.actions.map((a) => ({
        type: a.type,
        confidence: a.confidence,
        data: a.data,
      })),
      roomId: request.roomId,
      projectId: request.projectId,
      userId: request.userId,
    },
  });

  if (error) {
    const detail = await extractFunctionError(error);
    console.error('brain-create-action error detail:', detail);
    throw new Error(`Brain AI failed: ${detail}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Brain create-action returned unsuccessful response');
  }

  return data as BrainProcessResponse;
}

/**
 * Send a message to the Brain AI for LLM analysis.
 * Reserved for passive intelligence / complex queries.
 * Uses the brain-process Edge Function → Claude Haiku.
 */
export async function processMessageWithLLM(
  request: BrainProcessRequest,
): Promise<BrainProcessResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.functions.invoke('brain-process', {
    body: request,
  });

  if (error) {
    const detail = await extractFunctionError(error);
    console.error('brain-process error detail:', detail);
    throw new Error(`Brain AI failed: ${detail}`);
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
    const detail = await extractFunctionError(error);
    console.error('brain-execute error detail:', detail);
    throw new Error(`Brain execute failed: ${detail}`);
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
 * Prepare message content for Brain AI processing.
 * Strips @ai prefix if present, but always returns isBrainMention: true
 * since all messages are now auto-parsed.
 */
export function detectBrainMention(content: string): {
  isBrainMention: boolean;
  cleanContent: string;
} {
  // Strip @ai prefix if user explicitly typed it (backward compat)
  const brainPattern = /^@ai\s+/i;
  const match = content.match(brainPattern);

  return {
    isBrainMention: true, // Always true — all messages are auto-parsed
    cleanContent: match ? content.replace(brainPattern, '').trim() : content,
  };
}
