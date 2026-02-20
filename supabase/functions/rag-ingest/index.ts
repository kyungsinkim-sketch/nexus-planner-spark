/**
 * rag-ingest — Knowledge extraction and embedding pipeline.
 *
 * Processes various sources to extract knowledge items and generate embeddings.
 * This function is called:
 *   1. After brain-digest completes (automatic)
 *   2. After brain-execute confirms actions (automatic)
 *   3. After project completion reviews (automatic)
 *   4. Manually for batch re-processing
 *
 * Actions:
 *   - ingestDigest: Extract knowledge from a chat digest
 *   - ingestAction: Extract knowledge from a brain action
 *   - ingestReview: Extract knowledge from a peer review
 *   - batchProcess: Process all pending sources
 *   - reembed: Re-generate embeddings for items without them
 *
 * Request body: { action: string, ...params }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  generateEmbedding,
  extractKnowledgeFromDigest,
  extractKnowledgeFromAction,
  extractKnowledgeFromReview,
  type KnowledgeItem,
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
    const { action } = body;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';

    switch (action) {
      // ─── Ingest from chat digest ─────────────────
      case 'ingestDigest': {
        const { digestId, digest, projectId, userId, projectTitle, teamMembers } = body;

        // Check if already processed
        const { data: existing } = await supabase
          .from('knowledge_extraction_log')
          .select('id')
          .eq('source_type', 'chat_digest')
          .eq('source_id', digestId)
          .maybeSingle();

        if (existing) {
          return jsonResponse({ success: true, message: 'Already processed', itemsCreated: 0 });
        }

        // Mark as processing
        await supabase.from('knowledge_extraction_log').insert({
          source_type: 'chat_digest',
          source_id: digestId,
          user_id: userId,
          project_id: projectId,
          status: 'processing',
        });

        try {
          // Extract knowledge items
          const items = await extractKnowledgeFromDigest(
            digest,
            { projectId, userId, projectTitle, teamMembers },
            anthropicKey,
          );

          // Generate embeddings and insert
          let created = 0;
          for (const item of items) {
            try {
              const embedding = await generateEmbedding(item.content, openaiKey);

              await supabase.from('knowledge_items').insert({
                ...item,
                source_id: digestId,
                embedding: JSON.stringify(embedding),
              });
              created++;
            } catch (err) {
              console.warn('Failed to insert knowledge item:', err);
            }
          }

          // Mark as completed
          await supabase
            .from('knowledge_extraction_log')
            .update({ status: 'completed', items_created: created, completed_at: new Date().toISOString() })
            .eq('source_type', 'chat_digest')
            .eq('source_id', digestId);

          return jsonResponse({ success: true, itemsCreated: created });
        } catch (err) {
          await supabase
            .from('knowledge_extraction_log')
            .update({ status: 'failed', error_message: (err as Error).message })
            .eq('source_type', 'chat_digest')
            .eq('source_id', digestId);
          throw err;
        }
      }

      // ─── Ingest from brain action ────────────────
      case 'ingestAction': {
        const { actionId, actionType, actionData, actionStatus, userId, projectId } = body;

        const item = extractKnowledgeFromAction(
          { type: actionType, data: actionData, status: actionStatus },
          userId,
          projectId,
        );

        if (!item) {
          return jsonResponse({ success: true, itemsCreated: 0, message: 'No extractable knowledge' });
        }

        try {
          const embedding = await generateEmbedding(item.content, openaiKey);

          await supabase.from('knowledge_items').insert({
            ...item,
            source_id: actionId,
            embedding: JSON.stringify(embedding),
          });

          return jsonResponse({ success: true, itemsCreated: 1 });
        } catch (err) {
          console.warn('Failed to insert action knowledge:', err);
          return jsonResponse({ success: false, error: (err as Error).message });
        }
      }

      // ─── Ingest from peer review ─────────────────
      case 'ingestReview': {
        const { reviewerId, revieweeId, rating, comment, projectId } = body;

        const items = extractKnowledgeFromReview({
          reviewerId,
          revieweeId,
          rating,
          comment,
          projectId,
        });

        let created = 0;
        for (const item of items) {
          try {
            const embedding = await generateEmbedding(item.content, openaiKey);

            await supabase.from('knowledge_items').insert({
              ...item,
              embedding: JSON.stringify(embedding),
            });
            created++;
          } catch (err) {
            console.warn('Failed to insert review knowledge:', err);
          }
        }

        return jsonResponse({ success: true, itemsCreated: created });
      }

      // ─── Batch process pending digests ───────────
      case 'batchProcess': {
        const { limit: batchLimit } = body;
        const maxItems = batchLimit || 10;

        // Find unprocessed digests
        const { data: digests } = await supabase
          .from('chat_digests')
          .select('id, digest_type, content, room_id, project_id, user_id')
          .order('created_at', { ascending: false })
          .limit(maxItems * 2);

        if (!digests?.length) {
          return jsonResponse({ success: true, processed: 0, message: 'No digests to process' });
        }

        // Filter out already processed
        const digestIds = digests.map(d => d.id);
        const { data: processed } = await supabase
          .from('knowledge_extraction_log')
          .select('source_id')
          .eq('source_type', 'chat_digest')
          .in('source_id', digestIds);

        const processedIds = new Set((processed || []).map(p => p.source_id));
        const unprocessed = digests.filter(d => !processedIds.has(d.id)).slice(0, maxItems);

        let totalCreated = 0;
        for (const digest of unprocessed) {
          try {
            // Parse digest content
            const content = typeof digest.content === 'string' ? JSON.parse(digest.content) : digest.content;

            const digestData = {
              decisions: content.items?.filter((i: Record<string, string>) => digest.digest_type === 'decisions') || [],
              actionItems: content.items?.filter((i: Record<string, string>) => digest.digest_type === 'action_items') || [],
              risks: content.items?.filter((i: Record<string, string>) => digest.digest_type === 'risks') || [],
              summary: content.summary || '',
            };

            const items = await extractKnowledgeFromDigest(
              digestData,
              { projectId: digest.project_id, userId: digest.user_id },
              anthropicKey,
            );

            // Insert items with embeddings
            for (const item of items) {
              try {
                const embedding = await generateEmbedding(item.content, openaiKey);
                await supabase.from('knowledge_items').insert({
                  ...item,
                  source_id: digest.id,
                  embedding: JSON.stringify(embedding),
                });
                totalCreated++;
              } catch (insertErr) {
                console.warn('Insert failed:', insertErr);
              }
            }

            // Log completion
            await supabase.from('knowledge_extraction_log').upsert({
              source_type: 'chat_digest',
              source_id: digest.id,
              user_id: digest.user_id,
              project_id: digest.project_id,
              status: 'completed',
              items_created: items.length,
              completed_at: new Date().toISOString(),
            }, { onConflict: 'source_type,source_id' });
          } catch (err) {
            console.warn(`Failed to process digest ${digest.id}:`, err);
            await supabase.from('knowledge_extraction_log').upsert({
              source_type: 'chat_digest',
              source_id: digest.id,
              status: 'failed',
              error_message: (err as Error).message,
            }, { onConflict: 'source_type,source_id' });
          }
        }

        return jsonResponse({
          success: true,
          processed: unprocessed.length,
          itemsCreated: totalCreated,
        });
      }

      // ─── Re-embed items without embeddings ───────
      case 'reembed': {
        const { limit: reembedLimit } = body;
        const max = reembedLimit || 50;

        const { data: items } = await supabase
          .from('knowledge_items')
          .select('id, content')
          .is('embedding', null)
          .eq('is_active', true)
          .limit(max);

        if (!items?.length) {
          return jsonResponse({ success: true, updated: 0 });
        }

        let updated = 0;
        for (const item of items) {
          try {
            const embedding = await generateEmbedding(item.content, openaiKey);
            await supabase
              .from('knowledge_items')
              .update({ embedding: JSON.stringify(embedding) })
              .eq('id', item.id);
            updated++;
          } catch (err) {
            console.warn(`Failed to embed item ${item.id}:`, err);
          }
        }

        return jsonResponse({ success: true, updated });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('RAG ingest error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
