// Brain Cross-Tool Action Edge Function
// Analyzes a message/text from any source (Slack, Notion, Chat) using Claude LLM
// and returns comprehensive suggestions (event + todo + note) for the SuggestionReviewDialog.
//
// Flow:
//   1. Client sends { userId, messageText, source, sourceMeta }
//   2. Claude analyzes and extracts ALL applicable items (event, todo, note)
//   3. Returns structured suggestion matching EmailBrainSuggestion format
//   4. Logs user preference for future learning

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authenticateOrFallback } from '../_shared/auth.ts';
import { callGemini, GeminiRateLimitError } from '../_shared/gemini-client.ts';

const MAX_TOKENS = 1536;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BrainActionRequest {
  userId: string;
  messageText: string;
  source: 'slack' | 'notion' | 'chat';
  sourceMeta?: {
    channelId?: string;
    channelName?: string;
    messageTs?: string;
    senderName?: string;
    pageId?: string;
    pageTitle?: string;
  };
  projectId?: string;
}

function buildPrompt(messageText: string, source: string, sourceMeta?: BrainActionRequest['sourceMeta']): string {
  const today = new Date().toISOString().split('T')[0];
  const kstTime = new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });

  const sourceContext = source === 'slack'
    ? `Slack 채널 #${sourceMeta?.channelName || 'unknown'}, 발신자: ${sourceMeta?.senderName || 'unknown'}`
    : source === 'notion'
      ? `Notion 페이지: ${sourceMeta?.pageTitle || 'unknown'}`
      : '채팅 메시지';

  return `You are Re-Be Brain AI. Analyze the given text and extract ALL applicable structured items.

## Context
- Source: ${sourceContext}
- Today: ${today} (KST: ${kstTime})

## Task
Analyze the text and extract up to 3 types of items. Only include items that are genuinely relevant.
Return JSON with this exact structure:

{
  "summary": "1줄 한국어 요약 (30자 이내)",
  "suggestedEvent": null or {
    "title": "일정 제목",
    "startAt": "ISO datetime with +09:00 or null",
    "endAt": "ISO datetime with +09:00 or null",
    "location": "장소 or null",
    "type": "MEETING|TASK|DEADLINE|DELIVERY",
    "attendeeIds": []
  },
  "suggestedTodo": null or {
    "title": "할 일 제목",
    "dueDate": "ISO datetime or null",
    "priority": "LOW|NORMAL|HIGH",
    "assigneeNames": [],
    "assigneeIds": []
  },
  "suggestedNote": null or "중요기록 내용 (결정사항/리스크/인사이트 등)"
}

## Rules
- Return ONLY valid JSON. No markdown fences, no extra text.
- Korean text: keep in original language.
- suggestedEvent: Only if there's a clear schedule/meeting/deadline. Times in KST (+09:00).
- suggestedTodo: Only if there's a clear action item or task assignment.
- suggestedNote: Only if there's important information worth recording (decisions, insights, risks).
- It's OK to return all three, two, one, or even none (all null) — be honest about relevance.
- summary: Always provide a concise Korean summary of what the text is about.

## Text to Analyze
"${messageText}"`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: BrainActionRequest = await req.json();
    const { userId: jwtUserId } = await authenticateOrFallback(req);
    const userId = jwtUserId || body.userId;
    const { messageText, source, sourceMeta, projectId } = body;

    if (!userId || !messageText) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, messageText' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Call Gemini Flash ───
    const prompt = buildPrompt(messageText, source, sourceMeta);

    let llmText: string;
    try {
      const geminiResponse = await callGemini(geminiKey, {
        systemPrompt: 'You are Re-Be Brain AI, a Korean project management assistant. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }],
        maxOutputTokens: MAX_TOKENS,
        temperature: 0.7,
      });
      llmText = geminiResponse.text;
    } catch (err) {
      if (err instanceof GeminiRateLimitError) {
        return new Response(
          JSON.stringify({ error: 'LLM rate limited' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      throw err;
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(llmText.trim());
    } catch {
      const match = llmText.match(/\{[\s\S]*\}/);
      if (match) {
        extracted = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse LLM response');
      }
    }

    // ─── Enrich with projectId ───
    if (projectId) {
      if (extracted.suggestedEvent && typeof extracted.suggestedEvent === 'object') {
        (extracted.suggestedEvent as Record<string, unknown>).projectId = projectId;
      }
      if (extracted.suggestedTodo && typeof extracted.suggestedTodo === 'object') {
        (extracted.suggestedTodo as Record<string, unknown>).projectId = projectId;
      }
    }

    // ─── Build suggestion in EmailBrainSuggestion format ───
    const suggestionId = crypto.randomUUID();
    const suggestion = {
      id: suggestionId,
      emailId: sourceMeta?.messageTs || sourceMeta?.pageId || `${source}-${Date.now()}`,
      threadId: sourceMeta?.channelId || sourceMeta?.pageId || source,
      intent: 'action_required',
      summary: (extracted.summary as string) || '분석 완료',
      suggestedEvent: extracted.suggestedEvent || null,
      suggestedTodo: extracted.suggestedTodo || null,
      suggestedNote: extracted.suggestedNote || null,
      confidence: 0.85,
      status: 'pending',
      source,
      sourceMeta,
      sourceText: messageText.substring(0, 500),
    };

    // ─── Log preference ───
    await supabase
      .from('brain_preference_log')
      .insert({
        user_id: userId,
        source,
        source_channel_id: sourceMeta?.channelId || sourceMeta?.pageId || null,
        message_text: messageText.substring(0, 500),
        chosen_action_type: 'comprehensive',
        extracted_data: extracted,
      })
      .then(({ error }) => {
        if (error) console.warn('Preference log failed (non-fatal):', error.message);
      });

    return new Response(
      JSON.stringify({ success: true, suggestion }),
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
