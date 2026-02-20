/**
 * RAG Service — Frontend interface for the personalized knowledge base.
 *
 * Three-tier knowledge system:
 *   1. Personal Brain: Individual judgment patterns, preferences, decision styles
 *   2. Team Brain: Project-level patterns, recurring risks, collaboration dynamics
 *   3. Role Brain: Role-specific thinking structures (CD budget sense, PD scheduling)
 *
 * Knowledge is invisible to users — it's an "AI 파트너" that learns automatically.
 * This service provides:
 *   - RAG context retrieval for Brain AI enhancement
 *   - Knowledge base statistics for admin/settings views
 *   - Manual knowledge management (rare)
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────

export interface RAGSearchResult {
  id: string;
  summary: string;
  type: string;
  similarity: number;
}

export interface RAGContextResult {
  context: string;
  results: RAGSearchResult[];
}

export interface KnowledgeStats {
  stats: {
    personal: number;
    team: number;
    role: number;
    global: number;
    total: number;
  };
  typeBreakdown: Record<string, number>;
  recentQueries: Array<{
    query_text: string;
    result_count: number;
    top_similarity: number | null;
    created_at: string;
  }>;
}

export interface KnowledgeItem {
  id: string;
  content: string;
  summary: string | null;
  knowledge_type: string;
  scope: string;
  source_type: string;
  confidence: number;
  role_tag: string | null;
  created_at: string;
  usage_count: number;
}

// ─── Helper ─────────────────────────────────────────

async function ragCall<T>(
  functionName: string,
  action: string,
  userId: string,
  params: Record<string, unknown> = {},
): Promise<{ success: boolean; data?: T; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { userId, action, ...params },
    });

    if (error) {
      console.error(`[RAG] ${action} error:`, error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, data: data as T };
  } catch (err) {
    console.error(`[RAG] ${action} exception:`, err);
    return { success: false, error: (err as Error).message };
  }
}

// ─── RAG Context for Brain AI ───────────────────────

/**
 * Get RAG context string for injection into Brain AI system prompt.
 * This is the primary way RAG enhances Brain responses.
 *
 * Called automatically by brainService before sending messages.
 */
export async function getRAGContext(
  userId: string,
  query: string,
  projectId?: string,
  roleTag?: string,
): Promise<string> {
  const result = await ragCall<RAGContextResult>('rag-query', 'getContext', userId, {
    query,
    scope: 'all',
    projectId,
    roleTag,
    maxChars: 800,
  });

  return result.success && result.data ? result.data.context : '';
}

/**
 * Semantic search across the knowledge base.
 * For manual search in admin/settings views.
 */
export async function searchKnowledge(
  userId: string,
  query: string,
  options?: {
    scope?: 'personal' | 'team' | 'role' | 'all';
    projectId?: string;
    roleTag?: string;
    limit?: number;
  },
): Promise<RAGSearchResult[]> {
  const result = await ragCall<{ results: RAGSearchResult[] }>('rag-query', 'search', userId, {
    query,
    scope: options?.scope || 'all',
    projectId: options?.projectId,
    roleTag: options?.roleTag,
    limit: options?.limit || 10,
  });

  return result.success && result.data ? result.data.results : [];
}

// ─── Knowledge Base Stats ───────────────────────────

/**
 * Get knowledge base statistics for the current user.
 * Shows scope breakdown, type distribution, and recent queries.
 */
export async function getKnowledgeStats(userId: string): Promise<KnowledgeStats | null> {
  const result = await ragCall<KnowledgeStats>('rag-query', 'getStats', userId);
  return result.success ? result.data || null : null;
}

// ─── Manual Ingestion Triggers ──────────────────────

/**
 * Trigger knowledge extraction from a chat digest.
 * Usually called automatically after brain-digest completes.
 */
export async function ingestDigest(
  userId: string,
  digestId: string,
  digest: Record<string, unknown>,
  projectId?: string,
  projectTitle?: string,
): Promise<{ itemsCreated: number }> {
  const result = await ragCall<{ itemsCreated: number }>('rag-ingest', 'ingestDigest', userId, {
    digestId,
    digest,
    projectId,
    projectTitle,
  });

  return result.success && result.data ? result.data : { itemsCreated: 0 };
}

/**
 * Trigger batch processing of unprocessed digests.
 */
export async function batchProcessKnowledge(
  userId: string,
  limit: number = 10,
): Promise<{ processed: number; itemsCreated: number }> {
  const result = await ragCall<{ processed: number; itemsCreated: number }>(
    'rag-ingest', 'batchProcess', userId, { limit },
  );

  return result.success && result.data ? result.data : { processed: 0, itemsCreated: 0 };
}

// ─── Feedback ───────────────────────────────────────

/**
 * Record whether RAG results were helpful.
 * Improves future retrieval quality.
 */
export async function submitRAGFeedback(
  userId: string,
  queryLogId: string,
  wasHelpful: boolean,
): Promise<boolean> {
  const result = await ragCall('rag-query', 'feedback', userId, { queryLogId, wasHelpful });
  return result.success;
}

// ─── Knowledge Management (Admin) ───────────────────

/**
 * Get knowledge items for the user (paginated).
 * For admin/settings view.
 */
export async function getKnowledgeItems(
  userId: string,
  options?: {
    scope?: string;
    knowledgeType?: string;
    limit?: number;
    offset?: number;
  },
): Promise<KnowledgeItem[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    let query = supabase
      .from('knowledge_items')
      .select('id, content, summary, knowledge_type, scope, source_type, confidence, role_tag, created_at, usage_count')
      .eq('is_active', true)
      .or(`user_id.eq.${userId},scope.in.(team,role,global)`)
      .order('created_at', { ascending: false });

    if (options?.scope) {
      query = query.eq('scope', options.scope);
    }
    if (options?.knowledgeType) {
      query = query.eq('knowledge_type', options.knowledgeType);
    }

    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) {
      console.error('[RAG] getKnowledgeItems error:', error);
      return [];
    }

    return (data || []) as KnowledgeItem[];
  } catch (err) {
    console.error('[RAG] getKnowledgeItems exception:', err);
    return [];
  }
}

/**
 * Deactivate a knowledge item (soft delete).
 */
export async function deactivateKnowledgeItem(
  userId: string,
  itemId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('knowledge_items')
    .update({ is_active: false })
    .eq('id', itemId)
    .eq('user_id', userId);

  return !error;
}
