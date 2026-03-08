// Brain Slack Action Edge Function
// Analyzes a Slack message using Claude LLM and creates a pending brain_action
// for the user to review before execution.
//
// Flow:
//   1. Client sends { userId, channelId, channelName, messageText, messageTs, senderName, actionType }
//   2. Claude analyzes the message for the requested action type
//   3. Creates a brain_action row with status='pending'
//   4. Logs the user preference (actionType choice) for future learning
//   5. Returns the suggestion for the review UI

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authenticateOrFallback } from '../_shared/auth.ts';

const BRAIN_BOT_USER_ID = '00000000-0000-0000-0000-000000000099';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlackBrainRequest {
  userId: string;
  channelId: string;
  channelName: string;
  messageText: string;
  messageTs: string;
  senderName: string;
  actionType: 'todo' | 'calendar' | 'important';
  projectId?: string;
}

/**
 * Build a focused prompt for extracting a single action type from a Slack message.
 */
function buildPrompt(actionType: string, messageText: string, senderName: string, channelName: string): string {
  const today = new Date().toISOString().split('T')[0];
  const kstTime = new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });

  const actionInstructions: Record<string, string> = {
    todo: `Extract a TODO item from this message.
Return JSON: {"title":"string","dueDate":"YYYY-MM-DD or null","priority":"LOW"|"NORMAL"|"HIGH","assigneeNames":["string"]}
- title: Clear, actionable task description derived from the message
- dueDate: Extract if mentioned, else null
- priority: HIGH if urgent words (급한, ASAP, 긴급), else NORMAL
- assigneeNames: People mentioned or implied (can be empty)`,

    calendar: `Extract a calendar event from this message.
Return JSON: {"title":"string","startAt":"ISO datetime or null","endAt":"ISO datetime or null","location":"string or null","type":"MEETING"|"TASK"|"DEADLINE"|"DELIVERY"}
- title: Clear event name
- startAt/endAt: Extract date/time if mentioned. Use KST (+09:00). Default duration 1hr.
- location: Extract if mentioned
- type: MEETING for 미팅/회의, DEADLINE for 마감/데드라인, DELIVERY for 납품/전달, else TASK`,

    important: `Extract an important record/note from this message.
Return JSON: {"title":"string","content":"string","category":"decision"|"risk"|"insight"|"reference"}
- title: Short summary (max 50 chars)
- content: The full important information to remember
- category: decision(결정사항), risk(리스크/주의), insight(인사이트), reference(참고사항)`,
  };

  return `You are Re-Be Brain AI. Extract structured data from a Slack message.

## Context
- Channel: #${channelName}
- Sender: ${senderName}
- Today: ${today} (KST: ${kstTime})

## Task
${actionInstructions[actionType] || actionInstructions.todo}

## Message
"${messageText}"

## Rules
- Return ONLY valid JSON, no markdown fences, no extra text.
- Extract from the message content — be specific, not generic.
- Korean text is expected. Keep titles/content in the original language.
- If the message doesn't clearly contain relevant info for this action type, still extract the best possible interpretation.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: SlackBrainRequest = await req.json();
    const { userId: jwtUserId } = await authenticateOrFallback(req);
    const userId = jwtUserId || body.userId;
    const { channelId, channelName, messageText, messageTs, senderName, actionType, projectId } = body;

    if (!userId || !messageText || !actionType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, messageText, actionType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create Supabase service client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Step 1: Call Claude to analyze the message ───
    const prompt = buildPrompt(actionType, messageText, senderName, channelName);

    const llmResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      console.error('Anthropic API error:', llmResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `LLM error (${llmResponse.status})` }),
        { status: llmResponse.status === 429 ? 429 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const llmResult = await llmResponse.json();
    const textBlock = llmResult.content?.find((b: { type: string }) => b.type === 'text');
    if (!textBlock?.text) {
      throw new Error('No text in LLM response');
    }

    // Parse LLM JSON response
    let extractedData: Record<string, unknown>;
    try {
      // Try direct parse
      extractedData = JSON.parse(textBlock.text.trim());
    } catch {
      // Try extracting JSON from text
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (match) {
        extractedData = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse LLM response as JSON');
      }
    }

    // ─── Step 2: Map actionType to brain_action type ───
    const actionTypeMap: Record<string, string> = {
      todo: 'create_todo',
      calendar: 'create_event',
      important: 'create_important_note',
    };

    const brainActionType = actionTypeMap[actionType] || 'create_todo';

    // Enrich with projectId and source info
    const enrichedData = {
      ...extractedData,
      projectId: projectId || null,
      source: 'slack',
      sourceChannel: channelName,
      sourceChannelId: channelId,
      sourceMessageTs: messageTs,
      sourceSender: senderName,
    };

    // ─── Step 3: Create brain_action with status='pending' ───
    // First create a bot message to hold the action
    const replyMessage = actionType === 'todo'
      ? `📋 TODO 제안: "${extractedData.title}"`
      : actionType === 'calendar'
        ? `📅 캘린더 제안: "${extractedData.title}"`
        : `⭐ 중요기록 제안: "${extractedData.title}"`;

    const { data: botMessage, error: msgError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: BRAIN_BOT_USER_ID,
        content: replyMessage,
        message_type: 'brain_action',
        brain_action_data: {
          hasAction: true,
          replyMessage,
          actions: [{
            type: brainActionType,
            confidence: 0.85,
            data: enrichedData,
          }],
          source: 'slack',
        },
      })
      .select()
      .single();

    if (msgError) {
      console.error('Failed to insert bot message:', msgError);
      throw new Error(`DB error: ${msgError.message}`);
    }

    const { data: brainAction, error: actionError } = await supabase
      .from('brain_actions')
      .insert({
        message_id: botMessage.id,
        action_type: brainActionType,
        status: 'pending',
        extracted_data: enrichedData,
      })
      .select()
      .single();

    if (actionError) {
      console.error('Failed to insert brain_action:', actionError);
      throw new Error(`DB error: ${actionError.message}`);
    }

    // Update bot message with real action ID
    await supabase
      .from('chat_messages')
      .update({
        brain_action_data: {
          hasAction: true,
          replyMessage,
          actions: [{
            id: brainAction.id,
            type: brainActionType,
            status: 'pending',
            confidence: 0.85,
            data: enrichedData,
          }],
          source: 'slack',
        },
      })
      .eq('id', botMessage.id);

    // ─── Step 4: Log user preference for learning ───
    await supabase
      .from('brain_preference_log')
      .insert({
        user_id: userId,
        source: 'slack',
        source_channel_id: channelId,
        message_text: messageText.substring(0, 500), // truncate for storage
        chosen_action_type: actionType,
        extracted_data: enrichedData,
        brain_action_id: brainAction.id,
      })
      .then(({ error }) => {
        if (error) console.warn('Failed to log preference (non-fatal):', error.message);
      });

    // ─── Step 5: Return suggestion for review UI ───
    return new Response(
      JSON.stringify({
        success: true,
        suggestion: {
          id: brainAction.id,
          messageId: botMessage.id,
          actionType,
          brainActionType,
          extractedData,
          replyMessage,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('brain-slack-action error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
