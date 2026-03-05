/**
 * decision-thread-link — Auto-link related decisions into threads.
 *
 * When a new decision knowledge_item is created, this function:
 * 1. Searches for similar existing decision items via embedding similarity
 * 2. If similar items belong to a thread → add new item to that thread
 * 3. If similar items exist but no thread → create thread and link all
 * 4. If no similar items → create a new single-item thread
 * 5. Uses Claude to generate/update thread title and summary
 *
 * Called by: voice-call-ingest, brain-digest (after decision item creation)
 * Request: { userId, knowledgeItemId, projectId? }
 * Response: { threadId, action: 'joined'|'created'|'standalone', linkedItems }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateOrFallback } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3-lite';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const SIMILARITY_THRESHOLD = 0.78; // minimum cosine similarity to consider "related"
const MAX_CANDIDATES = 10;

// ─── Helpers ─────────────────────────────────────────

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ─── Get embedding for text ──────────────────────────

async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: VOYAGE_MODEL }),
  });

  if (!resp.ok) {
    throw new Error(`Voyage API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.data[0].embedding;
}

// ─── Generate thread title/summary with Claude ──────

async function generateThreadMeta(
  items: Array<{ content: string; source_type: string; created_at: string }>,
  anthropicKey: string,
): Promise<{ title: string; summary: string; category: string }> {
  const itemsText = items.map((item, i) =>
    `[${i + 1}] (${item.source_type}, ${item.created_at.split('T')[0]})\n${item.content}`
  ).join('\n\n');

  const resp = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: `You summarize decision threads for a Korean creative production company.
Given related decision items from different sources (meetings, emails, chats), generate:
1. A concise Korean title (max 30 chars) summarizing the decision topic
2. A Korean summary (2-3 sentences) of the full decision arc
3. A category from: scope_change, timeline_change, budget_change, quality_tradeoff, resource_allocation, client_negotiation, creative_direction, risk_mitigation, team_conflict, vendor_selection, process_change, other

Return JSON only: { "title": "...", "summary": "...", "category": "..." }`,
      messages: [{ role: 'user', content: `다음 관련 의사결정 항목들을 분석해주세요:\n\n${itemsText}` }],
    }),
  });

  if (!resp.ok) {
    console.warn('[decision-thread-link] Claude meta generation failed:', resp.status);
    return { title: '의사결정 스레드', summary: '', category: 'other' };
  }

  const data = await resp.json();
  const text = data.content?.[0]?.text || '{}';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { title: '의사결정 스레드', summary: '', category: 'other' };
  } catch {
    return { title: '의사결정 스레드', summary: '', category: 'other' };
  }
}

// ─── Determine role in thread ────────────────────────

function inferRole(sourceType: string, isFirst: boolean): string {
  if (isFirst) return 'trigger';
  switch (sourceType) {
    case 'voice_recording':
    case 'phone_call':
      return 'discussion';
    case 'gmail':
      return 'followup';
    case 'chat_digest':
    case 'flow_chat_log':
      return 'discussion';
    case 'decision_log':
      return 'resolution';
    default:
      return 'context';
  }
}

// ─── Main Handler ────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId: bodyUserId, knowledgeItemId, projectId } = await req.json();
    const { userId: jwtUserId } = await authenticateOrFallback(req);
    const userId = jwtUserId || bodyUserId;

    if (!userId || !knowledgeItemId) {
      return jsonResponse({ error: 'Missing userId or knowledgeItemId' }, 400);
    }

    const voyageKey = Deno.env.get('VOYAGE_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!voyageKey || !anthropicKey) {
      return jsonResponse({ error: 'API keys not configured' }, 500);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── 1. Fetch the new knowledge item ─────────────

    const { data: newItem, error: fetchErr } = await supabase
      .from('knowledge_items')
      .select('id, content, summary, embedding_v2, source_type, source_id, knowledge_type, decision_context, created_at')
      .eq('id', knowledgeItemId)
      .single();

    if (fetchErr || !newItem) {
      return jsonResponse({ error: 'Knowledge item not found' }, 404);
    }

    // Only process decision-related items
    const decisionTypes = ['decision_pattern', 'decision_log', 'schedule_change', 'budget_judgment'];
    if (!decisionTypes.includes(newItem.knowledge_type) && !newItem.decision_context) {
      return jsonResponse({ 
        threadId: null, 
        action: 'skipped', 
        reason: 'Not a decision item' 
      });
    }

    // ─── 2. Check if already in a thread ─────────────

    const { data: existingLink } = await supabase
      .from('decision_thread_items')
      .select('thread_id')
      .eq('knowledge_item_id', knowledgeItemId)
      .limit(1);

    if (existingLink && existingLink.length > 0) {
      return jsonResponse({
        threadId: existingLink[0].thread_id,
        action: 'already_linked',
      });
    }

    // ─── 3. Find similar decision items ──────────────

    // Get or compute embedding
    let embedding: number[];
    if (newItem.embedding_v2) {
      embedding = typeof newItem.embedding_v2 === 'string'
        ? JSON.parse(newItem.embedding_v2)
        : newItem.embedding_v2;
    } else {
      embedding = await getEmbedding(newItem.content, voyageKey);
    }

    // Search for similar decision items from same user (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: searchErr } = await supabase
      .from('knowledge_items')
      .select('id, content, summary, embedding_v2, source_type, source_id, knowledge_type, decision_context, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('id', knowledgeItemId)
      .gte('created_at', ninetyDaysAgo)
      .in('knowledge_type', decisionTypes)
      .limit(50);

    if (searchErr) {
      console.error('[decision-thread-link] Search error:', searchErr.message);
      return jsonResponse({ error: 'Search failed' }, 500);
    }

    // Compute similarities
    const scored = (candidates || [])
      .filter(c => c.embedding_v2)
      .map(c => {
        const cEmb = typeof c.embedding_v2 === 'string' ? JSON.parse(c.embedding_v2) : c.embedding_v2;
        return { ...c, similarity: cosineSimilarity(embedding, cEmb) };
      })
      .filter(c => c.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_CANDIDATES);

    console.log(`[decision-thread-link] Found ${scored.length} similar items (threshold: ${SIMILARITY_THRESHOLD})`);

    // ─── 4. Link to existing thread or create new ────

    if (scored.length === 0) {
      // No similar items → create standalone thread
      const meta = await generateThreadMeta(
        [{ content: newItem.content, source_type: newItem.source_type, created_at: newItem.created_at }],
        anthropicKey,
      );

      const { data: thread, error: createErr } = await supabase
        .from('decision_threads')
        .insert({
          user_id: userId,
          project_id: projectId || null,
          title: meta.title,
          summary: meta.summary,
          status: 'open',
          decision_category: meta.category,
        })
        .select('id')
        .single();

      if (createErr || !thread) {
        console.error('[decision-thread-link] Thread create error:', createErr?.message);
        return jsonResponse({ error: 'Failed to create thread' }, 500);
      }

      await supabase.from('decision_thread_items').insert({
        thread_id: thread.id,
        knowledge_item_id: knowledgeItemId,
        sequence_no: 0,
        role_in_thread: 'trigger',
      });

      return jsonResponse({
        threadId: thread.id,
        action: 'created',
        linkedItems: 1,
        title: meta.title,
      });
    }

    // Check if any similar items already belong to a thread
    const similarIds = scored.map(s => s.id);
    const { data: existingThreadLinks } = await supabase
      .from('decision_thread_items')
      .select('thread_id, knowledge_item_id')
      .in('knowledge_item_id', similarIds);

    const threadIds = [...new Set((existingThreadLinks || []).map(l => l.thread_id))];

    if (threadIds.length > 0) {
      // Join existing thread (pick the one with most linked similar items)
      const threadCounts = threadIds.map(tid => ({
        threadId: tid,
        count: (existingThreadLinks || []).filter(l => l.thread_id === tid).length,
      }));
      const bestThread = threadCounts.sort((a, b) => b.count - a.count)[0];

      // Get current max sequence_no
      const { data: maxSeq } = await supabase
        .from('decision_thread_items')
        .select('sequence_no')
        .eq('thread_id', bestThread.threadId)
        .order('sequence_no', { ascending: false })
        .limit(1);

      const nextSeq = (maxSeq?.[0]?.sequence_no ?? -1) + 1;

      await supabase.from('decision_thread_items').insert({
        thread_id: bestThread.threadId,
        knowledge_item_id: knowledgeItemId,
        sequence_no: nextSeq,
        role_in_thread: inferRole(newItem.source_type, false),
      });

      // Also link unlinked similar items to same thread
      const linkedItemIds = new Set((existingThreadLinks || []).map(l => l.knowledge_item_id));
      const unlinkedSimilar = scored.filter(s => !linkedItemIds.has(s.id));
      
      for (let i = 0; i < unlinkedSimilar.length; i++) {
        await supabase.from('decision_thread_items').upsert({
          thread_id: bestThread.threadId,
          knowledge_item_id: unlinkedSimilar[i].id,
          sequence_no: nextSeq + 1 + i,
          role_in_thread: inferRole(unlinkedSimilar[i].source_type, false),
        }, { onConflict: 'thread_id,knowledge_item_id' });
      }

      // Update thread summary with all items
      const { data: allThreadItems } = await supabase
        .from('decision_thread_items')
        .select('knowledge_item_id')
        .eq('thread_id', bestThread.threadId);

      const allItemIds = (allThreadItems || []).map(ti => ti.knowledge_item_id);
      const { data: allItems } = await supabase
        .from('knowledge_items')
        .select('content, source_type, created_at')
        .in('id', allItemIds)
        .order('created_at', { ascending: true });

      if (allItems && allItems.length > 1) {
        const meta = await generateThreadMeta(allItems, anthropicKey);
        await supabase
          .from('decision_threads')
          .update({
            title: meta.title,
            summary: meta.summary,
            decision_category: meta.category,
          })
          .eq('id', bestThread.threadId);
      }

      return jsonResponse({
        threadId: bestThread.threadId,
        action: 'joined',
        linkedItems: 1 + unlinkedSimilar.length,
      });
    }

    // Similar items exist but none in a thread → create new thread with all
    const allRelatedItems = [
      { content: newItem.content, source_type: newItem.source_type, created_at: newItem.created_at },
      ...scored.map(s => ({ content: s.content, source_type: s.source_type, created_at: s.created_at })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const meta = await generateThreadMeta(allRelatedItems, anthropicKey);

    const { data: thread, error: createErr } = await supabase
      .from('decision_threads')
      .insert({
        user_id: userId,
        project_id: projectId || null,
        title: meta.title,
        summary: meta.summary,
        status: scored.length > 0 ? 'open' : 'open',
        decision_category: meta.category,
      })
      .select('id')
      .single();

    if (createErr || !thread) {
      console.error('[decision-thread-link] Thread create error:', createErr?.message);
      return jsonResponse({ error: 'Failed to create thread' }, 500);
    }

    // Sort all items chronologically and assign roles
    const sortedItems = [
      { id: knowledgeItemId, source_type: newItem.source_type, created_at: newItem.created_at },
      ...scored.map(s => ({ id: s.id, source_type: s.source_type, created_at: s.created_at })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (let i = 0; i < sortedItems.length; i++) {
      await supabase.from('decision_thread_items').insert({
        thread_id: thread.id,
        knowledge_item_id: sortedItems[i].id,
        sequence_no: i,
        role_in_thread: inferRole(sortedItems[i].source_type, i === 0),
      });
    }

    return jsonResponse({
      threadId: thread.id,
      action: 'created',
      linkedItems: sortedItems.length,
      title: meta.title,
    });

  } catch (err) {
    console.error('[decision-thread-link] Error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
