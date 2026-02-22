/**
 * rag-query — Semantic search over the knowledge base.
 *
 * Retrieves relevant knowledge items based on query similarity
 * with scope-based filtering (personal, team, role).
 *
 * This is called by:
 *   1. brain-process — to inject RAG context into LLM prompts
 *   2. Frontend — for manual knowledge search
 *   3. Brain AI — for personalized suggestions
 *
 * Actions:
 *   - search: Semantic similarity search
 *   - getContext: Build a RAG context string for LLM injection
 *   - getStats: Get knowledge base statistics for a user
 *   - feedback: Record whether a result was helpful
 *
 * Request body: { action: string, userId: string, ...params }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  generateEmbedding,
  buildRAGContext,
  type RAGSearchResult,
} from '../_shared/rag-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!action || !userId) {
      return jsonResponse({ error: 'Missing action or userId' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';

    switch (action) {
      // ─── Semantic search ─────────────────────────
      case 'search': {
        const {
          query,
          scope = 'all',
          projectId,
          roleTag,
          knowledgeType,
          threshold = 0.3,
          limit: searchLimit = 5,
        } = body;

        if (!query) {
          return jsonResponse({ error: 'Missing query' }, 400);
        }

        // Generate query embedding
        const queryEmbedding = await generateEmbedding(query, openaiKey);

        // Call search_knowledge_v2 with hybrid scoring
        const { data: results, error: searchError } = await supabase.rpc('search_knowledge_v2', {
          query_embedding: JSON.stringify(queryEmbedding),
          search_scope: scope,
          search_user_id: userId,
          search_project_id: projectId || null,
          search_role_tag: roleTag || null,
          search_knowledge_type: knowledgeType || null,
          match_threshold: threshold,
          match_count: searchLimit,
        });

        if (searchError) {
          console.error('Search RPC error:', searchError);
          return jsonResponse({ error: searchError.message }, 500);
        }

        const items = (results || []) as RAGSearchResult[];

        // Log the query
        await supabase.from('rag_query_log').insert({
          user_id: userId,
          query_text: query,
          query_embedding: JSON.stringify(queryEmbedding),
          scope,
          project_id: projectId || null,
          retrieved_item_ids: items.map(i => i.id),
          result_count: items.length,
          top_similarity: items.length > 0 ? items[0].similarity : null,
        });

        // Increment usage count for retrieved items (via RPC for atomic increment)
        if (items.length > 0) {
          try {
            await supabase.rpc('increment_knowledge_usage', {
              item_ids: items.map((i: { id: string }) => i.id),
            });
          } catch (usageErr) {
            console.warn('Failed to increment usage count (non-fatal):', usageErr);
          }
        }

        return jsonResponse({
          results: items,
          count: items.length,
        });
      }

      // ─── Get RAG context for LLM injection ──────
      case 'getContext': {
        const {
          query,
          scope = 'all',
          projectId,
          roleTag,
          maxChars = 800,
        } = body;

        if (!query) {
          return jsonResponse({ context: '', results: [] });
        }

        const queryEmbedding = await generateEmbedding(query, openaiKey);

        const { data: results } = await supabase.rpc('search_knowledge', {
          query_embedding: JSON.stringify(queryEmbedding),
          search_scope: scope,
          search_user_id: userId,
          search_project_id: projectId || null,
          search_role_tag: roleTag || null,
          match_threshold: 0.3,
          match_count: 5,
        });

        const items = (results || []) as RAGSearchResult[];
        const context = buildRAGContext(items, maxChars);

        return jsonResponse({
          context,
          results: items.map(i => ({
            id: i.id,
            summary: i.summary || i.content.slice(0, 100),
            type: i.knowledge_type,
            similarity: i.similarity,
          })),
        });
      }

      // ─── Knowledge base statistics ──────────────
      case 'getStats': {
        const { projectId } = body;

        // Count by scope
        const { data: scopeCounts } = await supabase
          .from('knowledge_items')
          .select('scope')
          .eq('is_active', true)
          .or(`user_id.eq.${userId},scope.in.(team,role,global)`);

        const stats = {
          personal: 0,
          team: 0,
          role: 0,
          global: 0,
          total: 0,
        };

        for (const item of (scopeCounts || [])) {
          const scope = item.scope as keyof typeof stats;
          if (scope in stats) stats[scope]++;
          stats.total++;
        }

        // Count by type
        const { data: typeCounts } = await supabase
          .from('knowledge_items')
          .select('knowledge_type')
          .eq('is_active', true)
          .eq('user_id', userId);

        const typeBreakdown: Record<string, number> = {};
        for (const item of (typeCounts || [])) {
          typeBreakdown[item.knowledge_type] = (typeBreakdown[item.knowledge_type] || 0) + 1;
        }

        // Recent queries
        const { data: recentQueries } = await supabase
          .from('rag_query_log')
          .select('query_text, result_count, top_similarity, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        return jsonResponse({
          stats,
          typeBreakdown,
          recentQueries: recentQueries || [],
        });
      }

      // ─── Feedback on search results ─────────────
      case 'feedback': {
        const { queryLogId, wasHelpful } = body;

        if (!queryLogId) {
          return jsonResponse({ error: 'Missing queryLogId' }, 400);
        }

        await supabase
          .from('rag_query_log')
          .update({ was_helpful: wasHelpful })
          .eq('id', queryLogId)
          .eq('user_id', userId);

        return jsonResponse({ success: true });
      }

      // ─── Diagnostics — full RAG system status ────
      case 'diagnose': {
        const results: Record<string, unknown> = {};

        // 1. knowledge_items stats
        const { count: kiTotal } = await supabase
          .from('knowledge_items')
          .select('*', { count: 'exact', head: true });

        const { data: kiByType } = await supabase
          .from('knowledge_items')
          .select('knowledge_type');

        const { data: kiByRole } = await supabase
          .from('knowledge_items')
          .select('role_tag')
          .not('role_tag', 'is', null);

        const { count: kiNoEmbed } = await supabase
          .from('knowledge_items')
          .select('*', { count: 'exact', head: true })
          .is('embedding', null);

        const typeDist: Record<string, number> = {};
        for (const r of (kiByType || [])) {
          typeDist[r.knowledge_type] = (typeDist[r.knowledge_type] || 0) + 1;
        }
        const roleDist: Record<string, number> = {};
        for (const r of (kiByRole || [])) {
          roleDist[r.role_tag] = (roleDist[r.role_tag] || 0) + 1;
        }

        results.knowledge_items = {
          total: kiTotal || 0,
          by_type: typeDist,
          by_role: roleDist,
          no_embedding: kiNoEmbed || 0,
        };

        // 2. rag_query_log stats
        const { count: qlTotal } = await supabase
          .from('rag_query_log')
          .select('*', { count: 'exact', head: true });

        const { data: qlFeedback } = await supabase
          .from('rag_query_log')
          .select('was_helpful, top_similarity');

        let helpfulTrue = 0, helpfulFalse = 0, helpfulNull = 0;
        let simSum = 0, simCount = 0;
        for (const r of (qlFeedback || [])) {
          if (r.was_helpful === true) helpfulTrue++;
          else if (r.was_helpful === false) helpfulFalse++;
          else helpfulNull++;
          if (r.top_similarity != null) {
            simSum += r.top_similarity;
            simCount++;
          }
        }

        results.rag_query_log = {
          total: qlTotal || 0,
          helpful_true: helpfulTrue,
          helpful_false: helpfulFalse,
          helpful_null: helpfulNull,
          avg_top_similarity: simCount > 0 ? +(simSum / simCount).toFixed(4) : null,
        };

        // 3. project_context_snapshots
        const { count: snapTotal } = await supabase
          .from('project_context_snapshots')
          .select('*', { count: 'exact', head: true });

        const { count: snapExpired } = await supabase
          .from('project_context_snapshots')
          .select('*', { count: 'exact', head: true })
          .lt('expires_at', new Date().toISOString());

        results.project_context_snapshots = {
          total: snapTotal || 0,
          expired: snapExpired || 0,
        };

        // 4. brain_processing_queue
        const { data: bpqData } = await supabase
          .from('brain_processing_queue')
          .select('status, pending_message_count');

        const bpqByStatus: Record<string, number> = {};
        let pendingTotal = 0;
        for (const r of (bpqData || [])) {
          bpqByStatus[r.status] = (bpqByStatus[r.status] || 0) + 1;
          if (r.pending_message_count) pendingTotal += r.pending_message_count;
        }

        results.brain_processing_queue = {
          by_status: bpqByStatus,
          pending_message_count: pendingTotal,
        };

        return jsonResponse(results);
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('RAG query error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
