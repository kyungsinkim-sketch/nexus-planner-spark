/**
 * brain-persona — AI Persona query Edge Function.
 *
 * Handles @pablo (and future persona) mentions in chat.
 * Fetches persona system prompt from ai_personas table,
 * retrieves RAG context from knowledge_items,
 * calls Claude Sonnet for CEO-perspective advice,
 * and inserts the response as a persona_response chat message.
 *
 * Actions:
 *   - query: Process a persona query (question → RAG → LLM → response)
 *   - feedback: Submit helpful/unhelpful feedback on a response (+ confidence adjustment)
 *   - analyze_txt: Analyze uploaded TXT chat log → extract knowledge → store in DB
 *
 * Differs from brain-process:
 *   - Uses Claude Sonnet (not Haiku) for quality
 *   - Free-form text response (not structured JSON actions)
 *   - Logs to persona_query_log (not brain_actions)
 *   - CEO-specific RAG filtering (role_tag = 'CEO')
 */

import {
  generateEmbedding,
  buildRAGContext,
  type RAGSearchResult,
} from '../_shared/rag-client.ts';
import { authenticateRequest, authenticateOrFallback, createServiceClient } from '../_shared/auth.ts';

const BRAIN_BOT_USER_ID = '00000000-0000-0000-0000-000000000099';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const HISTORY_LIMIT = 4;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;

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

// ─── Conversation history helpers ───────────────────

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

function mergeConsecutiveRoles(messages: ConversationMessage[]): ConversationMessage[] {
  if (messages.length === 0) return [];

  const merged: ConversationMessage[] = [];
  for (const msg of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n' + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }

  // Claude requires the first message to be 'user'
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift();
  }

  return merged;
}

// ─── Claude API call ────────────────────────────────

async function callClaude(
  systemPrompt: string,
  messages: ConversationMessage[],
  config: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
  anthropicKey: string,
): Promise<string> {
  const model = config.model || 'claude-sonnet-4-20250514';
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens || 2048;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[brain-persona] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (response.status === 429) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error('Rate limit exceeded');
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
    return textBlock?.text || '';
  }

  throw new Error('All retries exhausted');
}

// ─── Main handler ───────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return jsonResponse({ error: 'Missing action' }, 400);
    }

    // backfill_embeddings uses service client, no user auth needed
    let userId: string;
    let supabase: ReturnType<typeof createServiceClient>;
    if (action === 'backfill_embeddings') {
      const fallback = await authenticateOrFallback(req);
      userId = fallback.userId || '00000000-0000-0000-0000-000000000099';
      supabase = fallback.supabase;
    } else {
      const auth = await authenticateRequest(req);
      userId = auth.user.id;
      supabase = auth.supabase;
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';

    switch (action) {
      // ─── Query a persona ───────────────────────
      case 'query': {
        const {
          personaId,
          query,
          projectId,
          roomId,
          directChatUserId,
        } = body;

        if (!personaId || !query) {
          return jsonResponse({ error: 'Missing personaId or query' }, 400);
        }

        if (!anthropicKey) {
          return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
        }

        const startTime = Date.now();
        console.log(`[brain-persona] Query from ${userId}: "${query.substring(0, 100)}"`);

        // 1. Fetch persona (supports both UUID id and string name)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(personaId);
        let personaQuery = supabase
          .from('ai_personas')
          .select('*')
          .eq('is_active', true);

        if (isUUID) {
          personaQuery = personaQuery.eq('id', personaId);
        } else {
          personaQuery = personaQuery.eq('name', personaId);
        }

        const { data: persona, error: personaErr } = await personaQuery.single();

        if (personaErr || !persona) {
          return jsonResponse({ error: 'Persona not found or inactive' }, 404);
        }

        const config = (persona.config || {}) as {
          model?: string;
          temperature?: number;
          max_tokens?: number;
          dialectic_mode?: boolean;
          rag_filter?: {
            decision_maker?: string;
            role_tag?: string;
            scope_layer?: string;
          };
        };

        // 2a. RAG retrieval with persona-specific filters
        let ragResults: RAGSearchResult[] = [];
        let ragContext = '';
        let queryEmbedding: number[] | null = null;

        try {
          queryEmbedding = await generateEmbedding(query, openaiKey || undefined);

          const ragFilter = config.rag_filter || {};

          const { data: searchResults } = await supabase.rpc('search_knowledge_v2', {
            query_embedding: JSON.stringify(queryEmbedding),
            search_scope: 'all',
            search_user_id: userId,
            search_project_id: projectId || null,
            search_role_tag: ragFilter.role_tag || null,
            search_knowledge_type: null,
            match_threshold: 0.30,
            match_count: 5,
          });

          if (searchResults && searchResults.length > 0) {
            ragResults = searchResults;
            ragContext = buildRAGContext(searchResults, 1200);
            console.log(`[brain-persona] RAG: ${searchResults.length} knowledge items found`);
          }
        } catch (ragErr) {
          console.error('[brain-persona] RAG fetch failed (non-fatal):', ragErr);
        }

        // 2b. 정반합 RAG: 반론/리스크 관점 검색 (dialectic_mode일 때만)
        let dialecticContext = '';
        if (config.dialectic_mode && queryEmbedding) {
          try {
            const ragFilter = config.rag_filter || {};
            const { data: dialecticResults } = await supabase.rpc('search_knowledge_dialectic', {
              query_embedding: JSON.stringify(queryEmbedding),
              search_user_id: userId,
              search_project_id: projectId || null,
              search_role_tag: ragFilter.role_tag || null,
              opposing_tags: ['risk', 'constraint', 'client_concern'],
              match_threshold: 0.25,
              match_count: 3,
            });

            if (dialecticResults && dialecticResults.length > 0) {
              dialecticContext = '\n\n## 반론 근거 (Devil\'s Advocate Knowledge)\n';
              for (const item of dialecticResults) {
                dialecticContext += `- [${item.dialectic_tag}] ${item.summary || item.content.slice(0, 120)} (신뢰도: ${(item.confidence * 100).toFixed(0)}%)\n`;
              }
              console.log(`[brain-persona] Dialectic RAG: ${dialecticResults.length} opposing items found`);
            }
          } catch (dialecticErr) {
            console.error('[brain-persona] Dialectic RAG failed (non-fatal):', dialecticErr);
          }
        }

        // 2c. 개인 컨텍스트: 이 사용자의 패턴 검색
        let personalContext = '';
        if (queryEmbedding) {
          try {
            const { data: personalResults } = await supabase.rpc('search_knowledge_v2', {
              query_embedding: JSON.stringify(queryEmbedding),
              search_scope: 'personal',
              search_user_id: userId,
              match_threshold: 0.35,
              match_count: 3,
            });

            if (personalResults && personalResults.length > 0) {
              personalContext = '\n\n## 이 사용자의 개인 패턴\n';
              for (const item of personalResults) {
                personalContext += `- ${item.summary || item.content.slice(0, 120)}\n`;
              }
              console.log(`[brain-persona] Personal RAG: ${personalResults.length} items found`);
            }
          } catch (personalErr) {
            console.error('[brain-persona] Personal RAG failed (non-fatal):', personalErr);
          }
        }

        // 3. Fetch conversation history
        let conversationHistory: ConversationMessage[] = [];
        try {
          let histQuery = supabase
            .from('chat_messages')
            .select('user_id, content, message_type, created_at')
            .order('created_at', { ascending: false })
            .limit(HISTORY_LIMIT);

          if (directChatUserId) {
            histQuery = histQuery.or(
              `and(user_id.eq.${userId},direct_chat_user_id.eq.${directChatUserId}),` +
              `and(user_id.eq.${directChatUserId},direct_chat_user_id.eq.${userId}),` +
              `user_id.eq.${BRAIN_BOT_USER_ID}`
            );
          } else if (roomId) {
            histQuery = histQuery.eq('room_id', roomId);
          } else if (projectId) {
            histQuery = histQuery.eq('project_id', projectId);
          }

          const { data: recentMsgs } = await histQuery;

          if (recentMsgs && recentMsgs.length > 0) {
            const chronological = [...recentMsgs].reverse();
            for (const msg of chronological) {
              if (!msg.content) continue;
              if (msg.user_id === BRAIN_BOT_USER_ID) {
                conversationHistory.push({ role: 'assistant', content: msg.content });
              } else {
                conversationHistory.push({ role: 'user', content: msg.content });
              }
            }
            conversationHistory = mergeConsecutiveRoles(conversationHistory);
          }
        } catch (histErr) {
          console.error('[brain-persona] History fetch failed (non-fatal):', histErr);
        }

        // 4. Build system prompt with RAG + dialectic + personal context
        let systemPrompt = persona.system_prompt;
        if (ragContext) {
          systemPrompt += '\n\n' + ragContext;
        }
        if (dialecticContext) {
          systemPrompt += dialecticContext;
        }
        if (personalContext) {
          systemPrompt += personalContext;
        }

        // 5. Build messages: history + current query
        const messages: ConversationMessage[] = [
          ...conversationHistory,
          { role: 'user', content: query },
        ];

        // Ensure valid alternation
        const validMessages = mergeConsecutiveRoles(messages);

        // 6. Call Claude
        let responseText: string;
        try {
          responseText = await callClaude(
            systemPrompt,
            validMessages,
            {
              model: config.model,
              temperature: config.temperature,
              maxTokens: config.max_tokens,
            },
            anthropicKey,
          );
        } catch (llmErr) {
          console.error('[brain-persona] LLM call failed:', llmErr);
          const status = (llmErr as Error).message.includes('Rate limit') ? 429 : 502;
          return jsonResponse({ error: `LLM call failed: ${(llmErr as Error).message}` }, status);
        }

        const responseTimeMs = Date.now() - startTime;

        // 7. Log to persona_query_log
        let queryLogId: string | null = null;
        try {
          const { data: logRow } = await supabase
            .from('persona_query_log')
            .insert({
              persona_id: persona.id, // Use UUID from fetched row, not input string
              user_id: userId,
              project_id: projectId || null,
              query,
              response: responseText,
              rag_context: ragResults.length > 0 ? {
                items: ragResults.map(r => ({
                  id: r.id,
                  summary: r.summary || r.content.slice(0, 120),
                  type: r.knowledge_type,
                  similarity: r.similarity,
                })),
              } : null,
              response_time_ms: responseTimeMs,
            })
            .select('id')
            .single();

          queryLogId = logRow?.id || null;
        } catch (logErr) {
          console.error('[brain-persona] Query log insert failed (non-fatal):', logErr);
        }

        // 8. Insert bot chat message
        const personaResponseData = {
          personaId,
          personaName: persona.display_name,
          response: responseText,
          ragContext: ragResults.length > 0 ? ragResults.map(r => ({
            id: r.id,
            summary: r.summary || r.content.slice(0, 120),
            type: r.knowledge_type,
            similarity: r.similarity,
          })) : undefined,
          queryLogId,
        };

        const messageInsert: Record<string, unknown> = {
          user_id: BRAIN_BOT_USER_ID,
          content: responseText,
          message_type: 'persona_response',
          persona_response_data: personaResponseData,
        };

        // Set room/project/DM context
        if (directChatUserId) {
          messageInsert.direct_chat_user_id = userId;
        } else if (roomId) {
          messageInsert.room_id = roomId;
          if (projectId) {
            messageInsert.project_id = projectId;
          } else {
            const { data: room } = await supabase
              .from('chat_rooms')
              .select('project_id')
              .eq('id', roomId)
              .single();
            if (room) messageInsert.project_id = room.project_id;
          }
        } else if (projectId) {
          messageInsert.project_id = projectId;
        }

        const { data: botMessage, error: msgErr } = await supabase
          .from('chat_messages')
          .insert(messageInsert)
          .select()
          .single();

        if (msgErr) {
          console.error('[brain-persona] Bot message insert failed:', msgErr);
          return jsonResponse({ error: `Failed to insert message: ${msgErr.message}` }, 500);
        }

        console.log(`[brain-persona] Response sent in ${responseTimeMs}ms (${ragResults.length} RAG items)`);

        return jsonResponse({
          success: true,
          message: botMessage,
          queryLogId,
          personaResponse: {
            personaId,
            personaName: persona.display_name,
            response: responseText,
            ragResultCount: ragResults.length,
          },
        });
      }

      // ─── Feedback on persona response (+ RAG confidence loop) ──
      case 'feedback': {
        const { queryLogId, feedback } = body;

        if (!queryLogId || !feedback) {
          return jsonResponse({ error: 'Missing queryLogId or feedback' }, 400);
        }

        if (feedback !== 'helpful' && feedback !== 'unhelpful') {
          return jsonResponse({ error: 'feedback must be "helpful" or "unhelpful"' }, 400);
        }

        // 1. Update persona_query_log
        const { error: updateErr } = await supabase
          .from('persona_query_log')
          .update({ feedback })
          .eq('id', queryLogId)
          .eq('user_id', userId);

        if (updateErr) {
          return jsonResponse({ error: updateErr.message }, 500);
        }

        // 2. Adjust confidence of referenced knowledge_items
        let adjustedCount = 0;
        try {
          const { data: logRow } = await supabase
            .from('persona_query_log')
            .select('rag_context')
            .eq('id', queryLogId)
            .single();

          const ragCtx = logRow?.rag_context as { items?: Array<{ id: string }> } | null;
          const itemIds = ragCtx?.items?.map(i => i.id) || [];

          if (itemIds.length > 0) {
            // helpful → confidence +0.02 (max 1.0), usage_count +1
            // unhelpful → confidence -0.03 (min 0.1)
            const delta = feedback === 'helpful' ? 0.02 : -0.03;
            const minConf = 0.1;
            const maxConf = 1.0;

            for (const itemId of itemIds) {
              const { data: item } = await supabase
                .from('knowledge_items')
                .select('confidence, usage_count')
                .eq('id', itemId)
                .single();

              if (item) {
                const newConf = Math.min(maxConf, Math.max(minConf, (item.confidence || 0.5) + delta));
                const updatePayload: Record<string, unknown> = { confidence: newConf };
                if (feedback === 'helpful') {
                  updatePayload.usage_count = (item.usage_count || 0) + 1;
                }
                await supabase
                  .from('knowledge_items')
                  .update(updatePayload)
                  .eq('id', itemId);
                adjustedCount++;
              }
            }
          }
        } catch (adjErr) {
          console.error('[brain-persona] Confidence adjustment failed (non-fatal):', adjErr);
        }

        console.log(`[brain-persona] Feedback: ${feedback} on ${queryLogId}, adjusted ${adjustedCount} items`);
        return jsonResponse({ success: true, adjustedCount });
      }

      // ─── Analyze uploaded TXT chat log ──────────
      case 'analyze_txt': {
        const { content: txtContent, fileName, projectId } = body;

        if (!txtContent) {
          return jsonResponse({ error: 'Missing content (TXT text)' }, 400);
        }

        if (!anthropicKey) {
          return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
        }

        const startTime = Date.now();
        console.log(`[brain-persona] analyze_txt: ${fileName || 'unknown'}, ${txtContent.length} chars`);

        // 1. Chunk the text (max ~6000 tokens ≈ 12000 chars per chunk)
        const MAX_CHUNK_CHARS = 12000;
        const OVERLAP_CHARS = 500;
        const chunks: string[] = [];
        let offset = 0;
        while (offset < txtContent.length) {
          const end = Math.min(offset + MAX_CHUNK_CHARS, txtContent.length);
          chunks.push(txtContent.slice(offset, end));
          offset = end - OVERLAP_CHARS;
          if (end >= txtContent.length) break;
        }

        console.log(`[brain-persona] Split into ${chunks.length} chunks`);

        // 2. Analyze each chunk with Claude
        const extractionPrompt = `You are a knowledge extraction engine for a Korean creative production company (파울러스/Re-Be).
Analyze the following chat conversation and extract reusable CEO decision patterns and team collaboration insights.

Output a JSON array of knowledge items. Each item:
{
  "content": "Clear, reusable pattern statement in Korean (50-200 chars)",
  "knowledge_type": "deal_decision|budget_decision|payment_tracking|recurring_risk|creative_direction|budget_judgment|stakeholder_alignment|schedule_change|collaboration_pattern|communication_style|workflow|preference|judgment|domain_expertise|feedback_pattern|lesson_learned|context",
  "role_tag": "CEO|PD|EDITOR|DIRECTOR|WRITER|DESIGNER|MANAGER|PRODUCER|null",
  "scope_layer": "strategy|operations|execution|culture",
  "decision_maker": "speaker name or null",
  "outcome": "confirmed|tentative|rejected|null",
  "confidence": 0.0-1.0,
  "relevance_score": 0.0-1.0
}

Rules:
- Extract PATTERNS not specific events (e.g., "예산 변경 시 팀 전체 합의 필요" not "12/15 예산 변경함")
- Each item must be standalone and reusable
- confidence = how generalizable, relevance_score = how important
- Focus on CEO decision-making patterns, budget/deal logic, team dynamics
- Max 8 items per chunk
- Always respond with valid JSON array only (no markdown fences)
- Return [] if no extractable patterns`;

        interface ExtractedItem {
          content: string;
          knowledge_type: string;
          role_tag?: string;
          scope_layer?: string;
          decision_maker?: string;
          outcome?: string;
          confidence: number;
          relevance_score: number;
        }

        const allItems: ExtractedItem[] = [];

        for (let i = 0; i < chunks.length; i++) {
          try {
            const chunkResult = await callClaude(
              extractionPrompt,
              [{ role: 'user', content: `[파일: ${fileName || '대화록'}] [청크 ${i + 1}/${chunks.length}]\n\n${chunks[i]}` }],
              { model: 'claude-sonnet-4-20250514', temperature: 0.2, maxTokens: 2048 },
              anthropicKey,
            );

            // Parse JSON (handle markdown fences)
            let jsonText = chunkResult.trim();
            if (jsonText.startsWith('```')) {
              jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }
            // Remove trailing commas
            jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');

            const parsed = JSON.parse(jsonText);
            if (Array.isArray(parsed)) {
              allItems.push(...parsed.filter((item: ExtractedItem) => item.content && item.confidence >= 0.5));
            }
            console.log(`[brain-persona] Chunk ${i + 1}: extracted ${Array.isArray(parsed) ? parsed.length : 0} items`);
          } catch (chunkErr) {
            console.error(`[brain-persona] Chunk ${i + 1} extraction failed:`, chunkErr);
          }
        }

        if (allItems.length === 0) {
          return jsonResponse({
            success: true,
            message: '추출할 패턴이 없습니다.',
            itemCount: 0,
            timeMs: Date.now() - startTime,
          });
        }

        // 3. Deduplicate (simple content similarity)
        const uniqueItems: ExtractedItem[] = [];
        for (const item of allItems) {
          const isDup = uniqueItems.some(existing => {
            const a = existing.content.replace(/\s+/g, '');
            const b = item.content.replace(/\s+/g, '');
            // Simple overlap check
            const shorter = a.length < b.length ? a : b;
            const longer = a.length < b.length ? b : a;
            return longer.includes(shorter) || shorter.length > 20 && longer.includes(shorter.slice(0, Math.floor(shorter.length * 0.7)));
          });
          if (!isDup) uniqueItems.push(item);
        }

        console.log(`[brain-persona] Deduped: ${allItems.length} → ${uniqueItems.length} items`);

        // 4. Generate embeddings and insert into knowledge_items
        let insertedCount = 0;
        for (const item of uniqueItems) {
          try {
            const embedding = await generateEmbedding(item.content, openaiKey || undefined);

            const { error: insertErr } = await supabase
              .from('knowledge_items')
              .insert({
                user_id: userId,
                scope: 'team',
                content: item.content,
                summary: item.content.slice(0, 200),
                knowledge_type: item.knowledge_type || 'context',
                source_type: 'flow_chat_log',
                role_tag: item.role_tag || null,
                confidence: item.confidence,
                relevance_score: item.relevance_score || 0.5,
                is_active: true,
                scope_layer: item.scope_layer || 'operations',
                decision_maker: item.decision_maker || null,
                outcome: item.outcome || null,
                source_context: {
                  file_name: fileName,
                  analyzed_at: new Date().toISOString(),
                  analyzed_by: userId,
                  chunk_count: chunks.length,
                },
                embedding: JSON.stringify(embedding),
              });

            if (!insertErr) {
              insertedCount++;
            } else {
              console.warn(`[brain-persona] Insert failed for item:`, insertErr.message);
            }
          } catch (itemErr) {
            console.error(`[brain-persona] Item processing failed:`, itemErr);
          }
        }

        const timeMs = Date.now() - startTime;
        console.log(`[brain-persona] analyze_txt complete: ${insertedCount}/${uniqueItems.length} items in ${timeMs}ms`);

        return jsonResponse({
          success: true,
          message: `${fileName || '대화록'}에서 ${insertedCount}개 지식 패턴을 추출·저장했습니다.`,
          itemCount: insertedCount,
          totalExtracted: allItems.length,
          afterDedup: uniqueItems.length,
          chunkCount: chunks.length,
          timeMs,
        });
      }

      // ─── Backfill embeddings for knowledge_items ──
      case 'backfill_embeddings': {
        const openaiKeyForBackfill = Deno.env.get('OPENAI_API_KEY') || '';
        const serviceClient = createServiceClient();

        const batchSize = body.batchSize || 20;
        const forceAll = body.force === true; // force=true → regenerate ALL embeddings (not just NULL)

        let query = serviceClient
          .from('knowledge_items')
          .select('id, content')
          .eq('is_active', true);

        if (!forceAll) {
          query = query.is('embedding', null);
        }

        const { data: items, error: fetchErr } = await query.limit(batchSize);

        if (fetchErr) {
          return jsonResponse({ error: `Fetch failed: ${fetchErr.message}` }, 500);
        }

        if (!items || items.length === 0) {
          return jsonResponse({ success: true, message: 'No items need embedding backfill', updated: 0 });
        }

        console.log(`[brain-persona] backfill_embeddings: ${items.length} items to process (force=${forceAll}, openaiKey=${openaiKeyForBackfill ? 'present' : 'MISSING'})`);

        let updatedCount = 0;
        const errors: string[] = [];

        for (const item of items) {
          try {
            const embedding = await generateEmbedding(item.content, openaiKeyForBackfill || undefined);

            const { error: updateErr } = await serviceClient
              .from('knowledge_items')
              .update({ embedding: JSON.stringify(embedding) })
              .eq('id', item.id);

            if (updateErr) {
              errors.push(`${item.id}: ${updateErr.message}`);
            } else {
              updatedCount++;
            }
          } catch (embErr) {
            errors.push(`${item.id}: ${(embErr as Error).message}`);
          }
        }

        console.log(`[brain-persona] backfill_embeddings: ${updatedCount}/${items.length} updated`);

        return jsonResponse({
          success: true,
          message: `${updatedCount}/${items.length} embeddings generated (force=${forceAll})`,
          updated: updatedCount,
          total: items.length,
          hasOpenAIKey: !!openaiKeyForBackfill,
          errors: errors.length > 0 ? errors : undefined,
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    if (err instanceof Response) return err; // Auth error
    console.error('[brain-persona] Unexpected error:', err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
