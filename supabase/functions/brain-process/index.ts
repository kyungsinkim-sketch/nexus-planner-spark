// Brain Process Edge Function
// Analyzes a chat message using Claude LLM and creates a bot response with extracted actions.
// Supports real-time weather data injection via Open-Meteo API (free, no key).
//
// Flow:
//   1. Client sends { messageContent, roomId, projectId, userId, chatMembers }
//   2. Detect weather intent → fetch Open-Meteo forecast if applicable
//   3. Edge Function calls Claude API with optional weather context
//   4. Creates a bot chat_message with type='brain_action'
//   5. Creates brain_actions rows for each extracted action
//   6. Returns the bot message + actions to client

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { analyzeMessage } from '../_shared/llm-client.ts';
import type { ProcessRequest } from '../_shared/brain-types.ts';
import { detectWeatherIntent, resolveLocation, fetchWeatherForecast, formatWeatherContext } from '../_shared/weather-client.ts';

const BRAIN_BOT_USER_ID = '00000000-0000-0000-0000-000000000099';

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

    const { messageContent, roomId, projectId, userId, chatMembers, projectTitle } = body;

    if (!messageContent || !userId || !chatMembers) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messageContent, userId, chatMembers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Processing @ai message from user ${userId}: "${messageContent.substring(0, 100)}"`);

    // 3. Detect weather intent and fetch real data if needed
    let weatherContext: string | undefined;
    try {
      const weatherIntent = detectWeatherIntent(messageContent);
      if (weatherIntent) {
        console.log('Weather intent detected:', JSON.stringify(weatherIntent));
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
            weatherContext = `\n## 날씨 데이터\n요청하신 날짜(${weatherIntent.dateHint})의 날씨 데이터를 가져올 수 없습니다. Open-Meteo 예보는 최대 16일 후까지만 제공됩니다. 해당 날짜가 16일 이상 후라면 날짜가 가까워지면 다시 확인하시기 바랍니다.`;
          }
        }
      }
    } catch (weatherErr) {
      console.error('Weather fetch failed (non-fatal):', weatherErr);
      // Continue without weather data — non-fatal error
    }

    // 4. Call Claude LLM (with optional weather context)
    let llmResponse;
    try {
      llmResponse = await analyzeMessage(body, anthropicKey, weatherContext);
      console.log('LLM response:', JSON.stringify({ hasAction: llmResponse.hasAction, actionCount: llmResponse.actions?.length }));
    } catch (llmErr) {
      console.error('LLM call failed:', llmErr);
      return new Response(
        JSON.stringify({ error: `LLM call failed: ${(llmErr as Error).message}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5. Create Supabase service client (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 6. Build brain_action_data for the bot message
    const brainActionData = {
      hasAction: llmResponse.hasAction,
      replyMessage: llmResponse.replyMessage,
      actions: llmResponse.actions || [],
    };

    // 7. Insert bot chat message
    const messageInsert: Record<string, unknown> = {
      user_id: BRAIN_BOT_USER_ID,
      content: llmResponse.replyMessage,
      message_type: 'brain_action',
      brain_action_data: brainActionData,
    };

    // Set room or project context
    if (roomId) {
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

    // 8. Insert brain_actions rows (one per extracted action)
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

    // 9. Return response
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
