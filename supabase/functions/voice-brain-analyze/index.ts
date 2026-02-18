/**
 * voice-brain-analyze — Brain AI analysis of meeting transcripts.
 *
 * Takes a transcript and extracts:
 * - Meeting summary
 * - Decisions made
 * - Calendar events (meetings, deadlines)
 * - Action items (todos with assignees)
 * - Follow-up reminders
 * - Key quotes
 *
 * Request: { userId, recordingId, transcript, context? }
 * Response: { analysis: VoiceBrainAnalysis }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4096;

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface BrainContext {
  projects?: Array<{ id: string; title: string; client: string; status: string; teamMemberIds?: string[] }>;
  users?: Array<{ id: string; name: string; department?: string; role: string }>;
}

// ─── System Prompt ───────────────────────────────────

function buildSystemPrompt(context?: BrainContext): string {
  let contextSection = '';

  if (context?.projects?.length) {
    const activeProjects = context.projects.filter(p => p.status === 'ACTIVE');
    if (activeProjects.length > 0) {
      const lines = activeProjects.map(p => `  - ID: ${p.id} | "${p.title}" (클라이언트: ${p.client})`).join('\n');
      contextSection += `\n\n## Active Projects\n${lines}`;
    }
  }

  if (context?.users?.length) {
    const lines = context.users.map(u => `  - ID: ${u.id} | "${u.name}" (${u.role}${u.department ? `, ${u.department}` : ''})`).join('\n');
    contextSection += `\n\n## Team Members\n${lines}`;
  }

  return `You are "Re-Be Brain Meeting Analyzer", an AI that analyzes meeting/call transcripts for a Korean creative production company.

## Your Tasks
Analyze the transcript and extract:

1. **summary** — 3-5 sentence Korean summary of the meeting/call
2. **decisions** — List of decisions made during the conversation
3. **suggestedEvents** — Calendar events mentioned (meetings, deadlines, deliveries)
4. **actionItems** — Todo/action items with assignees and deadlines
5. **followups** — Things to follow up on later
6. **keyQuotes** — Important statements worth highlighting

## Response Format
Return a single JSON object:
{
  "summary": "회의 요약 (한국어)",
  "decisions": [
    { "content": "결정 내용", "decidedBy": "화자 이름", "confidence": 0.0-1.0 }
  ],
  "suggestedEvents": [
    { "title": "", "startAt": "ISO", "endAt": "ISO", "location": "", "type": "MEETING|TASK|DEADLINE|DELIVERY", "attendeeIds": [], "projectId": "" }
  ],
  "actionItems": [
    { "title": "", "assigneeNames": [], "assigneeIds": [], "dueDate": "ISO", "priority": "LOW|MEDIUM|HIGH", "projectId": "" }
  ],
  "followups": [
    { "content": "", "remindDate": "YYYY-MM-DD" }
  ],
  "keyQuotes": [
    { "speaker": "", "text": "", "timestamp": 0.0, "importance": "budget_constraint|deadline|risk|decision" }
  ]
}

## Rules
- All text output MUST be in Korean
- Match speakers and names to team members when possible
- Match project mentions to active projects using title, client name, or abbreviations
- When matched, set projectId in suggestedEvents and actionItems
- Use KST timezone (+09:00) for all timestamps
- For event duration, default to 1 hour unless specified
- Prioritize decisions and action items — those are most valuable
- If the transcript is too short or uninformative, return minimal results${contextSection}`;
}

// ─── Retry + JSON Parse ──────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw); } catch { /* continue */ }

  // Repair trailing commas
  let repaired = raw.replace(/,\s*([}\]])/g, '$1');
  try { return JSON.parse(repaired); } catch { /* continue */ }

  // Try to close truncated JSON
  const lastBrace = repaired.lastIndexOf('}');
  if (lastBrace > 0) {
    repaired = repaired.slice(0, lastBrace + 1);
    try { return JSON.parse(repaired); } catch { /* continue */ }
  }

  return null;
}

// ─── Claude API Call ─────────────────────────────────

async function analyzeWithClaude(
  transcript: TranscriptSegment[],
  anthropicKey: string,
  context?: BrainContext,
): Promise<Record<string, unknown>> {
  const transcriptText = transcript
    .map(s => `[${formatTime(s.startTime)}] ${s.speaker}: ${s.text}`)
    .join('\n');

  const today = new Date();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const userMessage = `Today is ${today.toISOString().split('T')[0]} (${dayNames[today.getDay()]}요일).

Analyze the following meeting/call transcript and return a JSON object with your analysis:

${transcriptText}`;

  const systemPrompt = buildSystemPrompt(context);

  // Retry up to 2 times for 429/529
  for (let attempt = 0; attempt < 3; attempt++) {
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
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.content?.[0]?.text || '{}';

      // Extract JSON object from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[voice-brain-analyze] No JSON object found in response');
        return { summary: '', decisions: [], suggestedEvents: [], actionItems: [], followups: [], keyQuotes: [] };
      }

      const parsed = tryParseJson(jsonMatch[0]);
      if (!parsed) {
        console.warn('[voice-brain-analyze] JSON parse failed after repair');
        return { summary: '', decisions: [], suggestedEvents: [], actionItems: [], followups: [], keyQuotes: [] };
      }

      return parsed;
    }

    const status = response.status;
    if (status === 429 && attempt < 2) {
      console.warn(`[voice-brain-analyze] Rate limited, retry ${attempt + 1}/2 after 10s`);
      await sleep(10_000);
      continue;
    }
    if (status === 529 && attempt < 2) {
      console.warn(`[voice-brain-analyze] Overloaded, retry ${attempt + 1}/2 after 5s`);
      await sleep(5_000);
      continue;
    }

    const errText = await response.text();
    throw new Error(`Claude API error: ${status} - ${errText}`);
  }

  throw new Error('All retries exhausted');
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Main Handler ────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, recordingId, transcript, context } = await req.json();

    if (!userId || !recordingId || !transcript?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
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

    // Analyze with Claude
    const analysis = await analyzeWithClaude(
      transcript as TranscriptSegment[],
      anthropicKey,
      context as BrainContext | undefined,
    );

    // Save analysis to DB
    await supabase
      .from('voice_recordings')
      .update({
        brain_analysis: JSON.stringify(analysis),
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[voice-brain-analyze] Error:', err);

    // Try to update recording status
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.recordingId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('voice_recordings')
          .update({ status: 'error', error_message: (err as Error).message })
          .eq('id', recordingId);
      }
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
