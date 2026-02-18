/**
 * gmail-brain-analyze — Brain AI analysis of Gmail messages.
 *
 * Sends email content + workspace context (projects, users) to Claude
 * for intelligent extraction of:
 * - Intent classification (meeting_request, schedule_change, deadline, etc.)
 * - Calendar events with location info
 * - Todo items with correct assignees resolved from workspace members
 * - Important notes linked to the right project
 * - Date-day inconsistency detection
 * - Reply draft generation
 *
 * Request body: { userId: string, messages: GmailMessage[], context?: BrainContext }
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

interface BrainContext {
  projects?: Array<{
    id: string;
    title: string;
    client: string;
    status: string;
    teamMemberIds?: string[];
  }>;
  users?: Array<{
    id: string;
    name: string;
    department?: string;
    role: string;
  }>;
}

// ─── System Prompt (static part) ─────────────────────

const SYSTEM_PROMPT_BASE = `You are "Re-Be Brain Email Analyzer", an AI that analyzes business emails for a Korean creative production company.

## Your Tasks
For each email, extract:
1. **Intent** — one of: meeting_request, schedule_change, deadline, info_share, action_required, location_compare
2. **Summary** — 1-line Korean summary of the email
3. **Date Inconsistency** — If the email mentions a date with a day-of-week (e.g., "3/6(금)"), verify if the day matches. If wrong, flag it with the correct day.
4. **Suggested Event** — If the email requests a meeting or schedule, extract event details (title, startAt, endAt, location, type, attendeeIds)
5. **Suggested Todo** — If there's an action item or request, extract todo details (title, assigneeIds, dueDate, priority, projectId)
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
  "suggestedEvent": { "title": "", "startAt": "ISO", "endAt": "ISO", "location": "", "locationUrl": "", "type": "MEETING|TASK|DEADLINE|DELIVERY", "attendeeIds": ["user-id-1"], "projectId": "proj-id" } | null,
  "suggestedTodo": { "title": "", "assigneeIds": ["user-id-1"], "assigneeNames": ["홍길동"], "dueDate": "ISO", "priority": "LOW|MEDIUM|HIGH", "projectId": "proj-id" } | null,
  "suggestedNote": "중요 기록 내용" | null,
  "suggestedReplyDraft": "답장 초안",
  "confidence": 0.0-1.0
}

## Korean Meeting/Schedule Detection Patterns
Detect these Korean expressions as meeting_request or schedule_change intent:
- "~에서 미팅 요청드립니다", "~에서 회의 있습니다", "~에서 만나요", "미팅 일정"
- "~시에 ~에서", "~에서 ~시에"
- Time patterns: "오전 X시", "오후 X시", "X시 반", "X:XX"
  - "오후 2시" = 14:00, "오전 10시" = 10:00
- Relative dates: "내일" = tomorrow, "모레" = day after tomorrow, "다음 주 X요일" = next {day}
- Duration: Default meeting duration is 1 hour unless specified
- Location keywords: "~사무실", "~에서", "~호", "~층", "~역", "~카페"

IMPORTANT: If ANY meeting/schedule pattern is detected, ALWAYS generate a suggestedEvent even if confidence is low. It's better to suggest and let the user reject than to miss a meeting.

## Rules
- Always respond in valid JSON array format
- Summary MUST be in Korean
- Reply draft MUST be in Korean, professional tone
- For date validation: use the current year and calculate actual day-of-week
- If email is purely informational with no actions, set intent to "info_share" and only provide summary + reply draft
- For location comparisons (e.g., "장소 A vs B"), always create a suggestedNote
- Event type mapping: 회의/미팅→MEETING, 촬영/작업→TASK, 마감/납품→DEADLINE, 배송→DELIVERY
- For suggestedEvent startAt/endAt: use KST timezone (+09:00) when generating ISO timestamps
- NEVER skip suggestedEvent for meeting_request or schedule_change intents`;

// ─── Context-aware prompt section ────────────────────

function buildContextPrompt(context?: BrainContext): string {
  if (!context) return '';

  const sections: string[] = [];

  // Projects context
  if (context.projects && context.projects.length > 0) {
    const activeProjects = context.projects.filter(p => p.status === 'ACTIVE');
    if (activeProjects.length > 0) {
      const projectLines = activeProjects.map(p => {
        const members = p.teamMemberIds?.length
          ? ` [팀원: ${p.teamMemberIds.join(', ')}]`
          : '';
        return `  - ID: ${p.id} | "${p.title}" (클라이언트: ${p.client})${members}`;
      }).join('\n');
      sections.push(`## Active Projects (진행 중 프로젝트)
Use these to match email content to the correct project.
Match by keywords in project title, client name, or common abbreviations (e.g., "JG" → "JG" in title).
When matched, set projectId in suggestedEvent and suggestedTodo.
Also use this to populate suggestedNote for project-relevant important info.

${projectLines}`);
    }
  }

  // Users/Team context
  if (context.users && context.users.length > 0) {
    const userLines = context.users.map(u => {
      const dept = u.department ? ` | 부서: ${u.department}` : '';
      return `  - ID: ${u.id} | "${u.name}" (${u.role}${dept})`;
    }).join('\n');
    sections.push(`## Team Members (팀원 목록)
Use these to resolve assignees and attendees from email content.
Match by name, department, or role. Common patterns:
- "사판 CD" or "사판팀" → users with department containing "사판"
- "크리에이티브팀" → users with department containing "크리에이티브"
- "PD" or "기획" → users with role "PD" or department containing "기획"
- Specific names like "김경신", "요한" → match to user names (partial match OK)

When matched, use the user's ID in assigneeIds or attendeeIds.
If a team or department is mentioned (e.g., "크리에이티브팀에 전달"), include ALL users from that department.

${userLines}`);
  }

  if (sections.length === 0) return '';

  return `\n\n## ─── WORKSPACE CONTEXT ─────────────────────
The following is the current workspace state. Use this to accurately assign projects, team members, and departments.

${sections.join('\n\n')}

## Context Matching Rules
1. **Project matching**: If email mentions a project name, client, or abbreviation → set projectId
2. **Assignee matching**: If email mentions a person, team, or department → resolve to user IDs
3. **Important notes**: If email contains info relevant to a matched project → set suggestedNote with context
4. **Multiple assignees**: If "팀에 전달" is mentioned → assign to ALL members of that team/department
5. **Fallback**: If no project/user match is found, leave projectId empty and assigneeIds as []`;
}

// ─── Claude API call ─────────────────────────────────

async function analyzeEmails(
  messages: GmailMessage[],
  anthropicKey: string,
  context?: BrainContext,
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

  // Build full system prompt with context
  const systemPrompt = SYSTEM_PROMPT_BASE + buildContextPrompt(context);

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
    const { userId, messages, context } = await req.json();

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

    const rawSuggestions = await analyzeEmails(messages, anthropicKey, context as BrainContext);

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
