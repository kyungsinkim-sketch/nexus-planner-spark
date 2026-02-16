// Brain Process Edge Function
// Analyzes a chat message using Claude LLM and creates a bot response with extracted actions.
//
// Flow:
//   1. Client sends { messageContent, roomId, projectId, userId, chatMembers }
//   2. Edge Function calls Claude API to analyze the message
//   3. Creates a bot chat_message with type='brain_action'
//   4. Creates brain_actions rows for each extracted action
//   5. Returns the bot message + actions to client

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { analyzeMessage } from '../_shared/llm-client.ts';
import type { ProcessRequest, LLMExtractedAction } from '../_shared/brain-types.ts';

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
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // 2. Parse request
    const body: ProcessRequest = await req.json();
    const { messageContent, roomId, projectId, userId, chatMembers, projectTitle } = body;

    if (!messageContent || !userId || !chatMembers) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messageContent, userId, chatMembers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Call Claude LLM
    const llmResponse = await analyzeMessage(body, anthropicKey);

    // 4. Create Supabase service client (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 5. Build brain_action_data for the bot message
    const brainActionData = {
      hasAction: llmResponse.hasAction,
      replyMessage: llmResponse.replyMessage,
      actions: llmResponse.actions,
    };

    // 6. Insert bot chat message
    const messageInsert: Record<string, unknown> = {
      user_id: BRAIN_BOT_USER_ID,
      content: llmResponse.replyMessage,
      message_type: 'brain_action',
      brain_action_data: brainActionData,
    };

    // Set room or project context
    if (roomId) {
      messageInsert.room_id = roomId;
      // We need the project_id too for room-based messages
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

    const { data: botMessage, error: msgError } = await supabase
      .from('chat_messages')
      .insert(messageInsert)
      .select()
      .single();

    if (msgError) {
      console.error('Failed to insert bot message:', msgError);
      throw new Error(`Failed to insert bot message: ${msgError.message}`);
    }

    // 7. Insert brain_actions rows (one per extracted action)
    const insertedActions: Array<Record<string, unknown>> = [];

    if (llmResponse.hasAction && llmResponse.actions.length > 0) {
      for (const action of llmResponse.actions) {
        const { data: actionRow, error: actionError } = await supabase
          .from('brain_actions')
          .insert({
            message_id: botMessage.id,
            action_type: action.type,
            status: 'pending',
            extracted_data: action.data,
          })
          .select()
          .single();

        if (actionError) {
          console.error('Failed to insert brain_action:', actionError);
        } else {
          insertedActions.push(actionRow);
        }
      }
    }

    // 8. Return response
    return new Response(
      JSON.stringify({
        success: true,
        message: botMessage,
        actions: insertedActions,
        llmResponse: {
          hasAction: llmResponse.hasAction,
          replyMessage: llmResponse.replyMessage,
          actionCount: llmResponse.actions.length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('brain-process error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
