// Brain Create Action Edge Function
// Lightweight action creator — receives pre-parsed regex results from the client
// and creates bot messages + brain_actions rows using service_role (bypasses RLS).
//
// This replaces the LLM-based brain-process for CRUD operations.
// The client-side koreanParser.ts handles all parsing; this just handles DB inserts.
//
// IMPORTANT: brain_actions are inserted FIRST to get real UUIDs, then the bot
// message is created with those IDs embedded in brain_action_data. This ensures
// the front-end has valid UUIDs for confirm/reject operations.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { BRAIN_BOT_USER_ID } from '../_shared/brain-types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateActionRequest {
  // From the client-side regex parser
  replyMessage: string;
  actions: {
    type: 'create_todo' | 'create_event' | 'share_location';
    confidence: number;
    data: Record<string, unknown>;
  }[];
  // Context
  roomId?: string;
  projectId?: string;
  userId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: CreateActionRequest = await req.json();
    const { replyMessage, actions, roomId, projectId, userId } = body;

    if (!replyMessage) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: replyMessage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create Supabase service client (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve project_id from room if needed
    let resolvedProjectId = projectId;
    if (roomId && !resolvedProjectId) {
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('project_id')
        .eq('id', roomId)
        .single();
      if (room?.project_id) {
        resolvedProjectId = room.project_id;
      }
    }

    const hasActions = actions && actions.length > 0;

    // ─── Step 1: Insert a TEMPORARY bot message (without action IDs) ───
    // We need message_id to create brain_actions, then we'll UPDATE the
    // message with the real action IDs.
    const tempBrainActionData = {
      hasAction: hasActions,
      replyMessage,
      actions: hasActions
        ? actions.map((a) => ({
            type: a.type,
            confidence: a.confidence,
            data: a.data,
          }))
        : [],
    };

    const messageInsert: Record<string, unknown> = {
      user_id: BRAIN_BOT_USER_ID,
      content: replyMessage,
      message_type: 'brain_action',
      brain_action_data: tempBrainActionData,
    };

    if (roomId) messageInsert.room_id = roomId;
    if (resolvedProjectId) messageInsert.project_id = resolvedProjectId;

    const { data: botMessage, error: msgError } = await supabase
      .from('chat_messages')
      .insert(messageInsert)
      .select()
      .single();

    if (msgError) {
      console.error('Failed to insert bot message:', msgError);
      return new Response(
        JSON.stringify({ error: `Failed to create bot message: ${msgError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── Step 2: Insert brain_actions to get real UUIDs ───
    const createdActions = [];
    if (hasActions) {
      for (const action of actions) {
        const { data: brainAction, error: actionError } = await supabase
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
          continue;
        }

        createdActions.push(brainAction);
      }

      // ─── Step 3: UPDATE bot message with real action IDs ───
      // This ensures the front-end gets valid UUIDs via realtime subscription
      const updatedBrainActionData = {
        hasAction: true,
        replyMessage,
        actions: createdActions.map((a) => ({
          id: a.id,        // ← Real UUID from brain_actions table
          type: a.action_type,
          status: a.status,
          confidence: actions.find(
            (orig) => orig.type === a.action_type,
          )?.confidence ?? 0.7,
          data: a.extracted_data,
        })),
      };

      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ brain_action_data: updatedBrainActionData })
        .eq('id', botMessage.id);

      if (updateError) {
        console.error('Failed to update bot message with action IDs:', updateError);
        // Non-fatal — the actions still exist in brain_actions table
      }

      // Update botMessage reference for the response
      botMessage.brain_action_data = updatedBrainActionData;
    }

    // ─── Step 4: Log activity ───
    await supabase.from('brain_activity_log').insert({
      activity_type: 'crud_parsed',
      room_id: roomId || null,
      project_id: resolvedProjectId || null,
      details: {
        messageId: botMessage.id,
        actionCount: createdActions.length,
        userId,
        method: 'regex',
      },
    }).then(({ error }) => {
      // Silently fail — activity log is optional
      if (error) console.warn('Failed to log brain activity:', error.message);
    });

    // ─── Step 5: Return result ───
    return new Response(
      JSON.stringify({
        success: true,
        message: botMessage,
        actions: createdActions,
        llmResponse: {
          hasAction: hasActions,
          replyMessage,
          actionCount: createdActions.length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('brain-create-action error:', error);
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
