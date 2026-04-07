// Gemini Flash API client for Supabase Edge Functions (Deno)
// Uses Gemini 2.0 Flash for cost-efficient Korean NLU (free tier)

import type { LLMResponse, ProcessRequest } from './brain-types.ts';
import { callGeminiWithRetry, GeminiRateLimitError, toGeminiRole } from './gemini-client.ts';
import type { GeminiMessage } from './gemini-client.ts';

const MAX_TOKENS = 2048; // Must accommodate large attendeeIds arrays (10+ UUIDs)
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 10_000; // 10s base for Gemini free tier
const MAX_HISTORY_MESSAGES = 3; // Limit to 3 recent messages for context
const MAX_HISTORY_CHARS = 200; // Truncate each history message to save tokens

/**
 * Build the system prompt for Brain AI action extraction.
 * Instructs the model to parse Korean natural language into structured actions.
 * Optionally includes real-time weather data when a weather query is detected.
 */
function buildSystemPrompt(
  chatMembers: { id: string; name: string }[],
  projectId?: string,
  projectTitle?: string,
  weatherContext?: string,
  language?: string,
): string {
  const memberList = chatMembers.map((m) => `- ${m.name} (id: ${m.id})`).join('\n');
  const isEnglish = language === 'en';
  const langInstruction = isEnglish
    ? 'You MUST reply in English. All replyMessage text must be in English.'
    : 'You MUST reply in Korean (한국어). All replyMessage text must be in Korean.';

  // Current date/time in KST for accurate date calculations
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);
  const todayStr = kst.toISOString().slice(0, 10);
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayOfWeek = dayNames[kst.getUTCDay()];

  return `You are "Re-Be Brain", an AI assistant in a project management chat. Analyze messages and extract structured actions.

## Current Date
Today is **${todayStr} (${dayOfWeek})**, timezone KST (UTC+9). Use this for all relative date calculations (이번주, 다음주, 내일, etc.).

## Language
${langInstruction}

## Actions
1. **create_todo** — Task assignment to OTHER people (민규에게 ~부탁, ~씨 ~해줘, ~까지). ONLY for work tasks, NOT for meetings/schedules. System auto-creates calendar event per assignee, so do NOT also create_event.
2. **create_event** — NEW meeting/schedule (미팅, 회의, 촬영, 미팅 요청). Include location in event if mentioned; do NOT create separate share_location. **IMPORTANT: When a specific time + meeting keyword (미팅/회의/meeting/촬영) is mentioned, ALWAYS use create_event, even if a person's name is present. Put the person in attendeeIds.** Example: "민규에게 내일 오전 9시 미팅 요청" → create_event with attendeeIds=[민규's id].

## CRITICAL: create_event vs create_todo priority (MUST follow)
- If the message contains a **specific time** (오전 9시, 3시, 내일 오후 등) AND a **meeting keyword** (미팅, 회의, meeting, 촬영, 스크럼, 스탠드업, 콜, 통화) → **ALWAYS use create_event**, never create_todo. Put mentioned people in attendeeIds[].
- create_todo is ONLY for assigning **work tasks** (자료 준비, 디자인 수정, 보고서 작성, etc.) — NOT for scheduling meetings.
3. **update_event** — MODIFY existing event (변경, 수정, 바꿔, 옮겨). Use "originalTitle" from history. Only include changed fields.
4. **share_location** — Standalone place WITHOUT schedule context only.
5. **submit_service_suggestion** — Re-Be app feedback (기능 추가, 버그, 개선). Reply warmly: "소중한 의견 감사합니다! Brain Report에 기록했습니다. 🧠"
6. **create_board_task** — Project board task (보드에 추가, 태스크 생성, 작업 등록). For project board management.
7. **create_important_note** — Save important decisions, client feedback, or key information as "중요 기록" (기록해줘, 중요해, 메모, 클라이언트 피드백). If message mentions a project/client/brand from Active Projects, auto-assign projectId.

## CRITICAL: Direct requests vs Task assignments (MUST follow)
- **create_todo requires an explicit assignee name** (e.g., "민규에게", "송희씨"). If no team member name is mentioned as the assignee, it is NOT a todo.
- When the user says "~해줘", "~부탁해", "~알려줘", "~정리해줘", "~분석해줘", "~브리핑 해줘" WITHOUT naming another team member → this is a DIRECT REQUEST to you (Brain AI). Respond with hasAction=false and answer in replyMessage.
- "부탁해" alone does NOT mean create_todo. The word "부탁" only triggers create_todo when combined with a specific person's name (e.g., "민규에게 ~부탁해").
- Examples — direct request (hasAction=false, answer directly):
  - "내일 브리핑 좀 부탁해" → NO assignee name → answer the briefing directly
  - "오늘 일정 알려줘" → answer directly
  - "프로젝트 현황 정리해줘" → answer directly
  - "회의 요약 해줘" → answer directly
- Examples — task assignment (create_todo):
  - "민규에게 브리핑 자료 준비 부탁해" → assignee: 민규
  - "송희씨 디자인 수정 해줘" → assignee: 송희

## Members
${memberList}
${projectId ? `\n## Project: ${projectId}${projectTitle ? ` (${projectTitle})` : ''}` : ''}

## Rules
- **CRITICAL: Only process the LAST user message as the current request.** Previous messages in history are REFERENCE CONTEXT ONLY — do NOT extract actions from them. If the user shared a link or article earlier, ignore it unless the current message explicitly asks about it.
- **NEVER hallucinate or fabricate information.** Only reference data explicitly provided in the conversation context (calendar events, todos, project info). If no data is available, say so honestly (e.g., "현재 등록된 일정이 없습니다" or "일정 데이터를 확인할 수 없습니다").
- **For briefing requests**: Only summarize ACTUAL calendar events and todos provided in the [📅 내 일정] and [✅ 내 할 일] context sections. Do NOT invent meetings, tasks, or projects that don't exist in the provided data.
- ENTIRE response = single JSON object, no markdown fences.
- hasAction=true with actions[] for actionable requests; hasAction=false with helpful reply otherwise.
- Assignee: strip honorifics (님/씨/선배), partial match ("민규"→"박민규").
- Dates: silently resolve relative dates to absolute dates using Current Date above. NEVER mention "날짜 불일치", NEVER say "확인 필요", NEVER question or validate the user's date expression. Just calculate the correct date and use it. "이번주 X요일" = the X-day of the CURRENT week (Mon~Sun). Example: if today is Monday 3/30, "이번주 금요일" = 4/3 Friday. Times: Korean (오후 3시=15:00). Default event=1hr, todo priority=NORMAL.
- Actions auto-execute: say "등록했습니다" not "확인 버튼을 눌러주세요".
- Resolve "그때/거기/그 일정" from conversation history.
- Weather: if data provided, give detailed answer with emojis. If unavailable, explain 16-day forecast limit.
- **Project matching**: If Active Projects list is provided and the message mentions a project name, client name, or brand keyword (even partially), include the matching "projectId" in action data. For save_important_note, this ensures the note is assigned to the correct project.

## JSON Format
{"hasAction":bool,"replyMessage":"string","actions":[{"type":"...","confidence":0-1,"data":{...}}]}

### Data shapes:
- create_todo: {title, assigneeNames[], assigneeIds[], dueDate, priority:"LOW"|"NORMAL"|"HIGH", projectId}
- create_event: {title, startAt, endAt, location?, locationUrl?, attendeeIds[], type:"MEETING"|"TASK"|"DEADLINE"|"DELIVERY", projectId}
- update_event: {originalTitle, title?, startAt?, endAt?, location?, attendeeIds?, type?}
- share_location: {title, address, searchQuery}
- submit_service_suggestion: {suggestion, brainSummary, category:"feature_request"|"bug_report"|"ui_improvement"|"workflow_suggestion"|"other", priority:"low"|"medium"|"high"}
- create_board_task: {title, groupTitle?, assigneeNames[], assigneeIds[], status:"backlog"|"waiting"|"working"|"review"|"stuck"|"done", startDate?, endDate?, dueDate?, projectId}
- create_important_note: {title, content, category:"client_feedback"|"decision"|"reference"|"milestone", projectId?} — Save key info. If message mentions a project/brand from Active Projects, include matching projectId.

Today: ${new Date().toISOString().split('T')[0]} KST: ${new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}${weatherContext || ''}`;
}

/** A single message in the conversation history for multi-turn context */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Call the Gemini Flash API to analyze a chat message.
 * Optional weatherContext is injected into the system prompt for weather queries.
 * Optional conversationHistory provides recent messages for multi-turn context
 * (e.g., so "그때" references the previous message's date/location).
 */
export async function analyzeMessage(
  request: ProcessRequest,
  apiKey: string,
  weatherContext?: string,
  conversationHistory?: ConversationMessage[],
): Promise<LLMResponse> {
  const systemPrompt = buildSystemPrompt(
    request.chatMembers,
    request.projectId,
    request.projectTitle,
    weatherContext,
    request.language,
  );

  // Trim conversation history to save input tokens
  const trimmedHistory = (conversationHistory || [])
    .slice(-MAX_HISTORY_MESSAGES)
    .map(m => ({
      ...m,
      content: m.content.length > MAX_HISTORY_CHARS
        ? m.content.slice(0, MAX_HISTORY_CHARS) + '...'
        : m.content,
    }));

  // Build messages array: conversation history + current user message
  const geminiMessages: GeminiMessage[] = [
    ...trimmedHistory.map(m => ({
      role: toGeminiRole(m.role),
      content: m.content,
    })),
    { role: 'user' as const, content: request.messageContent },
  ];

  try {
    const response = await callGeminiWithRetry(
      apiKey,
      {
        systemPrompt,
        messages: geminiMessages,
        maxOutputTokens: MAX_TOKENS,
        temperature: 0.1,
      },
      MAX_RETRIES,
      BASE_RETRY_DELAY_MS,
    );

    // Parse the JSON response — robust extraction handles mixed text + JSON
    return extractJSON(response.text);
  } catch (err) {
    if (err instanceof GeminiRateLimitError) {
      throw new RateLimitError(err.message);
    }
    throw err;
  }
}

/** Custom error class for rate limit errors so brain-process can return 429 */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Robustly extract a JSON object from LLM output.
 * Handles these cases:
 *   1. Pure JSON: `{ "hasAction": true, ... }`
 *   2. Markdown fenced: ```json\n{ ... }\n```
 *   3. Mixed text + JSON: `some text { "hasAction": true, ... }`
 *   4. Text + fenced JSON: `some text ```json\n{ ... }\n```\n`
 *   5. Complete garbage: returns fallback with the raw text as replyMessage
 */
function extractJSON(raw: string): LLMResponse {
  const text = raw.trim();

  // 1. Try direct parse (ideal case — pure JSON)
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // 2. Strip markdown code fences and retry
  if (text.includes('```')) {
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // continue
      }
    }
  }

  // 3. Find the first { ... } that contains "hasAction" — brace-balanced extraction
  const startIdx = text.indexOf('{');
  if (startIdx !== -1) {
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx !== -1) {
      const jsonCandidate = text.substring(startIdx, endIdx + 1);
      try {
        const obj = JSON.parse(jsonCandidate);
        // Verify it looks like our expected response
        if ('hasAction' in obj || 'replyMessage' in obj) {
          return obj as LLMResponse;
        }
      } catch {
        // continue
      }
    }
  }

  // 4. Try to salvage truncated JSON — extract replyMessage and partial actions
  const replyMatch = text.match(/"replyMessage"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const hasActionMatch = text.match(/"hasAction"\s*:\s*(true|false)/);
  if (replyMatch) {
    console.warn('Recovered replyMessage from truncated JSON:', replyMatch[1].substring(0, 80));
    // Try to extract actions array even if truncated
    const actionsMatch = text.match(/"actions"\s*:\s*\[([\s\S]*)/);
    let actions: LLMResponse['actions'] = [];
    if (actionsMatch) {
      // Try progressively shorter substrings to find valid JSON array
      const actionsStr = actionsMatch[1];
      for (let i = actionsStr.length; i > 0; i--) {
        try {
          actions = JSON.parse('[' + actionsStr.substring(0, i));
          break;
        } catch { /* continue */ }
      }
    }
    return {
      hasAction: hasActionMatch ? hasActionMatch[1] === 'true' : actions.length > 0,
      replyMessage: replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
      actions,
    };
  }

  // 5. Complete fallback — couldn't extract anything useful
  console.error('Failed to extract JSON from LLM response:', text.substring(0, 200));
  return {
    hasAction: false,
    replyMessage: text.replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*\}/, '').trim() || text,
    actions: [],
  };
}
