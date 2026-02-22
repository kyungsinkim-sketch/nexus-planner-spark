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
 *   - feedback: Submit helpful/unhelpful feedback on a response
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
import { authenticateRequest } from '../_shared/auth.ts';

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
    const { user, supabase } = await authenticateRequest(req);
    const userId = user.id;

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return jsonResponse({ error: 'Missing action' }, 400);
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
          rag_filter?: {
            decision_maker?: string;
            role_tag?: string;
            scope_layer?: string;
          };
        };

        // 2. RAG retrieval with persona-specific filters
        let ragResults: RAGSearchResult[] = [];
        let ragContext = '';

        try {
          const queryEmbedding = await generateEmbedding(query, openaiKey || undefined);

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
            ragContext = buildRAGContext(searchResults, 1200); // More context for persona
            console.log(`[brain-persona] RAG: ${searchResults.length} knowledge items found`);
          }
        } catch (ragErr) {
          console.error('[brain-persona] RAG fetch failed (non-fatal):', ragErr);
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

        // 4. Build system prompt with RAG
        let systemPrompt = persona.system_prompt;
        if (ragContext) {
          systemPrompt += '\n\n' + ragContext;
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
              persona_id: personaId,
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

      // ─── Feedback on persona response ──────────
      case 'feedback': {
        const { queryLogId, feedback } = body;

        if (!queryLogId || !feedback) {
          return jsonResponse({ error: 'Missing queryLogId or feedback' }, 400);
        }

        if (feedback !== 'helpful' && feedback !== 'unhelpful') {
          return jsonResponse({ error: 'feedback must be "helpful" or "unhelpful"' }, 400);
        }

        const { error: updateErr } = await supabase
          .from('persona_query_log')
          .update({ feedback })
          .eq('id', queryLogId)
          .eq('user_id', userId);

        if (updateErr) {
          return jsonResponse({ error: updateErr.message }, 500);
        }

        return jsonResponse({ success: true });
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
