/**
 * gmail-brain-analyze — Brain AI analysis of Gmail messages.
 *
 * Sends email content to Claude Haiku for extraction of:
 * - Intent classification (meeting_request, schedule_change, deadline, etc.)
 * - Calendar events with location info
 * - Todo items with assignees and due dates
 * - Important notes (location comparisons, decision info)
 * - Date-day inconsistency detection
 * - Reply draft generation
 *
 * Request body: { userId: string, messages: GmailMessage[] }
 * Response: { suggestions: EmailBrainSuggestion[] }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4096;

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  date: string;
  snippet: string;
}

const SYSTEM_PROMPT = `You are "Re-Be Brain Email Analyzer", an AI that analyzes business emails for a Korean creative production company.

## Your Tasks
For each email, extract:
1. **Intent** — one of: meeting_request, schedule_change, deadline, info_share, action_required, location_compare
2. **Summary** — 1-line Korean summary of the email
3. **Date Inconsistency** — If the email mentions a date with a day-of-week (e.g., "3/6(금)"), verify if the day matches. If wrong, flag it with the correct day.
4. **Suggested Event** — If the email requests a meeting or schedule, extract event details (title, startAt, endAt, location, type)
5. **Suggested Todo** — If there's an action item with a deadline, extract todo details (title, assignees, dueDate, priority)
6. **Suggested Note** — If the email contains decision-relevant info (e.g., comparing locations, pricing options), extract as a note
7. **Reply Draft** — Generate a concise, professional Korean reply draft

## Response Format
Return a JSON array of suggestions. Each suggestion:
{
  "emailId": "string",
  "threadId": "string",
  "intent": "meeting_request|schedule_change|deadline|info_share|action_required|location_compare",
  "summary": "한국어 요약",
  "dateInconsistency": { "mentioned": "3/6(금)", "actualDay": "목요일", "correction": "수정 안내" } | null,
  "suggestedEvent": { "title": "", "startAt": "ISO", "endAt": "ISO", "location": "", "type": "MEETING|TASK|DEADLINE|DELIVERY" } | null,
  "suggestedTodo": { "title": "", "dueDate": "ISO", "priority": "LOW|NORMAL|HIGH" } | null,
  "suggestedNote": "중요 기록 내용" | null,
  "suggestedReplyDraft": "답장 초안",
  "confidence": 0.0-1.0
}

## Rules
- Always respond in valid JSON array format
- Summary MUST be in Korean
- Reply draft MUST be in Korean, professional tone
- For date validation: use the current year and calculate actual day-of-week
- If email is purely informational with no actions, set intent to "info_share" and only provide summary + reply draft
- For location comparisons (e.g., "장소 A vs B"), always create a suggestedNote
- Event type mapping: 회의/미팅→MEETING, 촬영/작업→TASK, 마감/납품→DEADLINE, 배송→DELIVERY`;

async function analyzeEmails(
  messages: GmailMessage[],
  anthropicKey: string,
): Promise<unknown[]> {
  const emailsContext = messages
    .map(
      (m, i) =>
        `--- Email ${i + 1} ---
ID: ${m.id}
ThreadID: ${m.threadId}
From: ${m.from}
To: ${m.to.join(', ')}
Subject: ${m.subject}
Date: ${m.date}
Body:
${m.body.slice(0, 1500)}
---`,
    )
    .join('\n\n');

  const today = new Date();
  const userMessage = `Today is ${today.toISOString().split('T')[0]} (${['일', '월', '화', '수', '목', '금', '토'][today.getDay()]}요일).

Analyze the following emails and return suggestions as a JSON array:

${emailsContext}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '[]';

  // Extract JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn('[gmail-brain-analyze] No JSON array found in response');
    return [];
  }

  return JSON.parse(jsonMatch[0]);
}

// ─── Main Handler ────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, messages } = await req.json();

    if (!userId || !messages?.length) {
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured', suggestions: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rawSuggestions = await analyzeEmails(messages, anthropicKey);

    // Add IDs and normalize
    const suggestions = rawSuggestions.map((s: Record<string, unknown>, i: number) => ({
      id: `es-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
      emailId: s.emailId || '',
      threadId: s.threadId || '',
      intent: s.intent || 'info_share',
      summary: s.summary || '',
      dateInconsistency: s.dateInconsistency || undefined,
      suggestedEvent: s.suggestedEvent || undefined,
      suggestedTodo: s.suggestedTodo || undefined,
      suggestedNote: s.suggestedNote || undefined,
      suggestedReplyDraft: s.suggestedReplyDraft || undefined,
      confidence: typeof s.confidence === 'number' ? s.confidence : 0.8,
      status: 'pending',
    }));

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[gmail-brain-analyze] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
