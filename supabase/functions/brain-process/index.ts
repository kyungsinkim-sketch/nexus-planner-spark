// Brain Process Edge Function
// Analyzes a chat message using Claude LLM and creates a bot response with extracted actions.
// Supports real-time weather data injection via Open-Meteo API (free, no key).
// Fetches recent conversation history for multi-turn context (resolves "그때", "거기", etc.).
//
// Flow:
//   1. Client sends { messageContent, roomId, projectId, userId, chatMembers }
//   2. Create Supabase client + fetch recent chat history for context
//   3. Detect weather intent (using combined conversation context) → fetch Open-Meteo forecast
//   4. Edge Function calls Claude API with conversation history + optional weather context
//   5. Creates a bot chat_message with type='brain_action'
//   6. Creates brain_actions rows for each extracted action
//   7. Returns the bot message + actions to client

import { analyzeMessage, RateLimitError } from '../_shared/llm-client.ts';
import type { ConversationMessage } from '../_shared/llm-client.ts';
import type { ProcessRequest } from '../_shared/brain-types.ts';
import { detectWeatherIntent, resolveLocation, fetchWeatherForecast, formatWeatherContext } from '../_shared/weather-client.ts';
import { authenticateRequest } from '../_shared/auth.ts';

const BRAIN_BOT_USER_ID = '00000000-0000-0000-0000-000000000099';
const HISTORY_LIMIT = 4; // Fetch last N messages for context (minimized to stay under 10k tokens/min)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 0. JWT Authentication — userId comes from verified token
    const { user: authUser, supabase } = await authenticateRequest(req);

    // 1. Validate API key
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      console.error('ANTHROPIC_API_KEY not found in env');
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Parse request
    let body: ProcessRequest;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('Failed to parse request body:', parseErr);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // userId comes from JWT, not request body (prevents spoofing)
    const userId = authUser.id;
    const { messageContent, roomId, projectId, directChatUserId, chatMembers, projectTitle } = body;

    if (!messageContent || !chatMembers) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messageContent, chatMembers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Processing @ai message from user ${userId}: "${messageContent.substring(0, 100)}"`);

    // 4. Fetch recent chat history for multi-turn context
    //    This allows the LLM to understand references like "그때", "거기", "그 일정"
    let conversationHistory: ConversationMessage[] = [];
    let recentMessagesText = ''; // Combined text for weather intent scanning
    try {
      let query = supabase
        .from('chat_messages')
        .select('user_id, content, message_type, created_at')
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT);

      // Filter by room, project, or DM context
      if (directChatUserId) {
        // DM: load messages between the two users (+ bot messages)
        query = query.or(
          `and(user_id.eq.${userId},direct_chat_user_id.eq.${directChatUserId}),` +
          `and(user_id.eq.${directChatUserId},direct_chat_user_id.eq.${userId}),` +
          `and(user_id.eq.${BRAIN_BOT_USER_ID},direct_chat_user_id.in.(${userId},${directChatUserId}))`
        );
      } else if (roomId) {
        query = query.eq('room_id', roomId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data: recentMsgs, error: histErr } = await query;

      if (!histErr && recentMsgs && recentMsgs.length > 0) {
        // Reverse to chronological order (oldest first)
        const chronological = [...recentMsgs].reverse();

        // Build LLM conversation history
        // Map: user messages → role=user, brain bot messages → role=assistant
        for (const msg of chronological) {
          if (!msg.content) continue;

          if (msg.user_id === BRAIN_BOT_USER_ID) {
            // Brain bot responses
            conversationHistory.push({ role: 'assistant', content: msg.content });
          } else {
            // User messages
            conversationHistory.push({ role: 'user', content: msg.content });
          }
        }

        // Collect all text for weather context scanning
        recentMessagesText = chronological
          .map((m) => m.content || '')
          .join(' ');

        console.log(`Loaded ${chronological.length} recent messages for context`);
      }
    } catch (historyErr) {
      console.error('Failed to load chat history (non-fatal):', historyErr);
      // Continue without history
    }

    // Ensure valid multi-turn: messages must alternate user/assistant
    // Claude API requires alternating roles, so merge consecutive same-role messages
    conversationHistory = mergeConsecutiveRoles(conversationHistory);

    // 5. Detect weather intent — scan BOTH current message AND recent conversation
    let weatherContext: string | undefined;
    try {
      // First try current message
      let weatherIntent = detectWeatherIntent(messageContent);

      // If current message has weather keywords but no date/location,
      // scan recent messages for context (e.g., "그때 날씨" → find date from prior msg)
      if (weatherIntent) {
        console.log('Weather intent from current message:', JSON.stringify(weatherIntent));
      } else if (hasWeatherKeyword(messageContent)) {
        // Check combined context — current message has weather words but detector
        // couldn't find date/location. Try scanning recent conversation.
        const combinedText = recentMessagesText + ' ' + messageContent;
        weatherIntent = detectWeatherIntent(combinedText);
        if (weatherIntent) {
          console.log('Weather intent from conversation context:', JSON.stringify(weatherIntent));
        }
      }

      if (weatherIntent) {
        const location = await resolveLocation(weatherIntent.locationHint);
        if (location && weatherIntent.dateHint) {
          console.log(`Fetching weather for ${location.resolvedName} (${location.lat}, ${location.lon}) on ${weatherIntent.dateHint}`);
          const forecast = await fetchWeatherForecast(
            location.lat, location.lon, weatherIntent.dateHint, location.resolvedName,
          );
          if (forecast) {
            weatherContext = formatWeatherContext(forecast);
            console.log('Weather data fetched successfully');
          } else {
            weatherContext = `\n## 날씨 데이터\n요청하신 날짜(${weatherIntent.dateHint})의 날씨 데이터를 가져올 수 없습니다. Open-Meteo 예보는 최대 16일 후까지만 제공됩니다. 해당 날짜가 가까워지면 다시 확인해주세요.`;
          }
        }
      }
    } catch (weatherErr) {
      console.error('Weather fetch failed (non-fatal):', weatherErr);
      // Continue without weather data — non-fatal error
    }

    // 5.5. Fetch RAG context — personalized knowledge from the knowledge base
    let ragContext: string | undefined;
    try {
      const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
      if (openaiKey || true) {
        // Import RAG client dynamically
        const { generateEmbedding, buildRAGContext } = await import('../_shared/rag-client.ts');
        const queryEmbedding = await generateEmbedding(messageContent, openaiKey || undefined);

        // Search across all scopes (personal + team + role)
        const { data: ragResults } = await supabase.rpc('search_knowledge_v2', {
          query_embedding: JSON.stringify(queryEmbedding),
          search_scope: 'all',
          search_user_id: userId,
          search_project_id: projectId || null,
          search_role_tag: null,
          search_knowledge_type: null,
          match_threshold: 0.35,
          match_count: 3,
        });

        if (ragResults && ragResults.length > 0) {
          ragContext = buildRAGContext(ragResults, 600);
          console.log(`RAG: found ${ragResults.length} relevant knowledge items`);
        }
      }
    } catch (ragErr) {
      console.error('RAG context fetch failed (non-fatal):', ragErr);
      // Continue without RAG — non-fatal error
    }

    // Combine weather + RAG context
    const combinedContext = [weatherContext, ragContext].filter(Boolean).join('') || undefined;

    // 6. Call Claude LLM (with conversation history + optional weather/RAG context)
    let llmResponse;
    try {
      llmResponse = await analyzeMessage(body, anthropicKey, combinedContext, conversationHistory);
      console.log('LLM response:', JSON.stringify({ hasAction: llmResponse.hasAction, actionCount: llmResponse.actions?.length }));
    } catch (llmErr) {
      console.error('LLM call failed:', llmErr);
      // Forward 429 rate limit status to client so it can show appropriate UI
      const statusCode = llmErr instanceof RateLimitError ? 429 : 502;
      return new Response(
        JSON.stringify({ error: `LLM call failed: ${(llmErr as Error).message}` }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 7. Build brain_action_data for the bot message
    const brainActionData = {
      hasAction: llmResponse.hasAction,
      replyMessage: llmResponse.replyMessage,
      actions: llmResponse.actions || [],
    };

    // 8. Insert bot chat message
    const messageInsert: Record<string, unknown> = {
      user_id: BRAIN_BOT_USER_ID,
      content: llmResponse.replyMessage,
      message_type: 'brain_action',
      brain_action_data: brainActionData,
    };

    // Set room, project, or DM context
    if (directChatUserId) {
      // DM chat — set direct_chat_user_id to triggering user so they can see it via RLS
      messageInsert.direct_chat_user_id = userId;
    } else if (roomId) {
      messageInsert.room_id = roomId;
      if (projectId) {
        messageInsert.project_id = projectId;
      } else {
        // Look up the project_id from the room
        const { data: room } = await supabase
          .from('chat_rooms')
          .select('project_id')
          .eq('id', roomId)
          .single();
        if (room) {
          messageInsert.project_id = room.project_id;
        }
      }
    } else if (projectId) {
      messageInsert.project_id = projectId;
    }

    console.log('Inserting bot message with keys:', Object.keys(messageInsert));

    const { data: botMessage, error: msgError } = await supabase
      .from('chat_messages')
      .insert(messageInsert)
      .select()
      .single();

    if (msgError) {
      console.error('Failed to insert bot message:', JSON.stringify(msgError));
      return new Response(
        JSON.stringify({ error: `Failed to insert bot message: ${msgError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 9. Insert brain_actions rows (one per extracted action)
    const insertedActions: Array<Record<string, unknown>> = [];

    // Resolve project_id for enriching extracted_data
    const resolvedProjectId = messageInsert.project_id || projectId || null;

    if (llmResponse.hasAction && llmResponse.actions && llmResponse.actions.length > 0) {
      for (const action of llmResponse.actions) {
        // Merge projectId into extracted_data so brain-execute
        // can create events/todos with the correct project_id
        const enrichedData = {
          ...(action.data || {}),
          projectId: (action.data as Record<string, unknown>)?.projectId || resolvedProjectId,
        };

        const { data: actionRow, error: actionError } = await supabase
          .from('brain_actions')
          .insert({
            message_id: botMessage.id,
            action_type: action.type,
            status: 'pending',
            extracted_data: enrichedData,
          })
          .select()
          .single();

        if (actionError) {
          console.error('Failed to insert brain_action:', JSON.stringify(actionError));
        } else {
          insertedActions.push(actionRow);
        }
      }
    }

    // 10. Return response
    return new Response(
      JSON.stringify({
        success: true,
        message: botMessage,
        actions: insertedActions,
        llmResponse: {
          hasAction: llmResponse.hasAction,
          replyMessage: llmResponse.replyMessage,
          actionCount: llmResponse.actions?.length || 0,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    if (error instanceof Response) return error; // Auth error
    console.error('brain-process unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

/**
 * Merge consecutive messages with the same role to satisfy Claude API requirements.
 * Claude requires alternating user/assistant messages.
 */
function mergeConsecutiveRoles(messages: ConversationMessage[]): ConversationMessage[] {
  if (messages.length === 0) return [];

  const merged: ConversationMessage[] = [];
  for (const msg of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      // Merge into previous message
      last.content += '\n' + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }

  // Claude requires the first message to be 'user'. If it starts with 'assistant', drop it.
  while (merged.length > 0 && merged[0].role === 'assistant') {
    merged.shift();
  }

  // Claude requires the last message before our new user message to be 'assistant'.
  // If the last message in history is 'user', it will merge with our new message naturally.
  // But we should trim trailing user messages since we'll add the current one.
  while (merged.length > 0 && merged[merged.length - 1].role === 'user') {
    // Keep the last user message as part of context — analyzeMessage appends the new one
    // But if there are two consecutive user messages at the end, merge them
    break;
  }

  return merged;
}

/**
 * Quick check if a message contains weather-related keywords,
 * even without full date/location extraction.
 */
function hasWeatherKeyword(text: string): boolean {
  const keywords = [
    '날씨', '기온', '온도', '바람', '풍속', '시정', '가시거리',
    '강수', '습도', '체감', '예보', '기상', 'weather', 'forecast',
    '비 올', '눈 올', '맑', '흐림', '우천',
  ];
  return keywords.some((kw) => text.includes(kw));
}
