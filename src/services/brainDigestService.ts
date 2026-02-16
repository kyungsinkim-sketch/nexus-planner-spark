/**
 * Brain Digest Service — Client-side API for passive intelligence features
 *
 * Calls Supabase Edge Functions:
 * - brain-digest: Triggers batch conversation analysis
 * - brain-context: Gets project intelligence snapshot
 *
 * Also queries directly:
 * - chat_digests: Recent conversation analysis results
 * - brain_activity_log: AI transparency log
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  ChatDigest,
  ProjectInsightsData,
  BrainActivityLogEntry,
  DigestContent,
} from '@/types/core';

/**
 * Extract a readable error message from Supabase FunctionsHttpError.
 */
async function extractFunctionError(error: unknown): Promise<string> {
  try {
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
 * Get recent digests for a project.
 */
export async function getProjectDigests(
  projectId: string,
  options?: { limit?: number; digestType?: string },
): Promise<ChatDigest[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  let query = supabase
    .from('chat_digests')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 20);

  if (options?.digestType) {
    query = query.eq('digest_type', options.digestType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch digests: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    roomId: row.room_id || undefined,
    projectId: row.project_id || undefined,
    digestType: row.digest_type,
    content: row.content as DigestContent,
    messageRangeStart: row.message_range_start,
    messageRangeEnd: row.message_range_end,
    messageCount: row.message_count,
    modelUsed: row.model_used || undefined,
    confidence: row.confidence || undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at || undefined,
  })) as ChatDigest[];
}

/**
 * Get project intelligence snapshot.
 * Calls brain-context Edge Function which handles caching.
 */
export async function getProjectContext(
  projectId: string,
  forceRefresh?: boolean,
): Promise<ProjectInsightsData> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.functions.invoke('brain-context', {
    body: { projectId, forceRefresh },
  });

  if (error) {
    const detail = await extractFunctionError(error);
    console.error('brain-context error:', detail);
    throw new Error(`Failed to get project context: ${detail}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to get project context');
  }

  return data.snapshot as ProjectInsightsData;
}

/**
 * Manually trigger digest processing for a specific room.
 */
export async function triggerDigest(
  roomId: string,
  projectId?: string,
): Promise<{ processed: number }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.functions.invoke('brain-digest', {
    body: { roomId, projectId, messageThreshold: 1 }, // Low threshold for manual trigger
  });

  if (error) {
    const detail = await extractFunctionError(error);
    console.error('brain-digest error:', detail);
    throw new Error(`Failed to trigger digest: ${detail}`);
  }

  return { processed: data?.processed || 0 };
}

/**
 * Get AI activity log for transparency.
 */
export async function getActivityLog(
  projectId: string,
  limit?: number,
): Promise<BrainActivityLogEntry[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('brain_activity_log')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit || 10);

  if (error) {
    throw new Error(`Failed to fetch activity log: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    activityType: row.activity_type,
    roomId: row.room_id || undefined,
    projectId: row.project_id || undefined,
    details: row.details || undefined,
    createdAt: row.created_at,
  })) as BrainActivityLogEntry[];
}
