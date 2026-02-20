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
          threshold = 0.3,
          limit: searchLimit = 5,
        } = body;

        if (!query) {
          return jsonResponse({ error: 'Missing query' }, 400);
        }

        // Generate query embedding
        const queryEmbedding = await generateEmbedding(query, openaiKey);

        // Call the search_knowledge RPC function
        const { data: results, error: searchError } = await supabase.rpc('search_knowledge', {
          query_embedding: JSON.stringify(queryEmbedding),
          search_scope: scope,
          search_user_id: userId,
          search_project_id: projectId || null,
          search_role_tag: roleTag || null,
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

        // Increment usage count for retrieved items
        if (items.length > 0) {
          for (const item of items) {
            await supabase
              .from('knowledge_items')
              .update({
                usage_count: supabase.rpc ? undefined : 0, // Can't increment directly, use raw SQL
                last_used_at: new Date().toISOString(),
              })
              .eq('id', item.id);
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

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('RAG query error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
