/**
 * RAG Pattern Service — Personal decision pattern analysis.
 *
 * Analyzes accumulated knowledge_items to extract higher-level
 * decision patterns per user (e.g., "예산에 보수적", "리스크 회피 성향").
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { UserDecisionPattern, KnowledgeDomain } from '@/types/knowledge-ontology';

// ─── Types ──────────────────────────────────────────

export interface PatternAnalysisResult {
  success: boolean;
  patternsFound?: number;
  upserted?: number;
  analyzedItems?: number;
  skipped?: boolean;
  message?: string;
}

// ─── Edge Function Caller ────────────────────────────

async function callPatternEdge<T>(
  action: string,
  userId: string,
  params?: Record<string, unknown>,
): Promise<{ success: boolean; data?: T; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('rag-pattern-analysis', {
      body: { action, userId, ...params },
    });

    if (error) {
      console.error(`[PatternService] ${action} error:`, error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as T };
  } catch (err) {
    console.error(`[PatternService] ${action} exception:`, err);
    return { success: false, error: (err as Error).message };
  }
}

// ─── Public API ──────────────────────────────────────

/**
 * Trigger pattern analysis for a user.
 * Rate-limited to once per 24 hours.
 */
export async function analyzeUserPatterns(
  userId: string,
  limit: number = 20,
): Promise<PatternAnalysisResult> {
  const result = await callPatternEdge<PatternAnalysisResult>('analyze', userId, { limit });
  return result.success && result.data
    ? result.data
    : { success: false, message: result.error };
}

/**
 * Get existing decision patterns for a user.
 */
export async function getUserPatterns(
  userId: string,
): Promise<UserDecisionPattern[]> {
  const result = await callPatternEdge<{ patterns: UserDecisionPattern[] }>('getPatterns', userId);

  if (!result.success || !result.data?.patterns) return [];

  // Map snake_case DB columns to camelCase
  return result.data.patterns.map((p: Record<string, unknown>) => ({
    id: p.id as string,
    userId: (p.user_id || p.userId) as string,
    knowledgeDomain: (p.knowledge_domain || p.knowledgeDomain) as KnowledgeDomain,
    patternType: (p.pattern_type || p.patternType) as string,
    patternSummary: (p.pattern_summary || p.patternSummary) as string | undefined,
    evidenceItemIds: (p.evidence_item_ids || p.evidenceItemIds || []) as string[],
    confidence: (p.confidence || 0.5) as number,
    sampleCount: (p.sample_count || p.sampleCount || 1) as number,
    createdAt: (p.created_at || p.createdAt) as string,
    updatedAt: (p.updated_at || p.updatedAt) as string,
  }));
}
