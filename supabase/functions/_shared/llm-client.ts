// Anthropic Claude API client for Supabase Edge Functions (Deno)
// Uses Claude 3.5 Haiku for cost-efficient Korean NLU

import type { LLMResponse, ProcessRequest } from './brain-types.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2048;

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
): string {
  const memberList = chatMembers.map((m) => `- ${m.name} (id: ${m.id})`).join('\n');

  return `You are "Re-Be Brain", an AI assistant embedded in a Korean project management chat.
Your job is to analyze user messages and extract structured actions when appropriate.

## Action Types
1. **create_todo** — When someone assigns a task or asks someone to do something
2. **create_event** — When someone proposes a NEW meeting, deadline, or schedule. If a location is mentioned alongside the event, include it in the event's "location" field. Do NOT create a separate share_location action.
3. **update_event** — When someone wants to MODIFY/CHANGE an existing event (time change, title change, location change, etc.). Keywords: "변경", "수정", "바꿔", "옮겨", "~로 변경할게요", "~시로 바꿔줘". You MUST look at the conversation history to find the original event title being referenced. Include "originalTitle" to identify which event to update, and only the fields that changed.
4. **share_location** — ONLY when someone shares a standalone place/location WITHOUT any schedule or event context. Examples: "촬영 답사 장소는 삼각지역 6번출구입니다", "드론샷은 제주도 성산포 앞바다에서 진행 예정입니다". If the message also mentions a time/date/meeting, use create_event with the location embedded instead.
5. **submit_service_suggestion** — When someone makes a suggestion or feature request about the Re-Be service/app itself. Keywords: "기능 추가", "기능 개선", "개선", "불편", "버그", "이런 기능", "있으면 좋겠", "Re-Be에", "앱에서", "서비스에서", "제안", "건의". The user is giving feedback about how to improve Re-Be.io. Acknowledge the suggestion warmly.

## Chat Members
${memberList}

${projectId ? `## Current Project\nProject ID: ${projectId}${projectTitle ? `\nProject Title: ${projectTitle}` : ''}` : ''}

## Rules
- Respond in the SAME LANGUAGE as the user message (Korean/English)
- If the message contains an actionable request, set hasAction=true and populate actions array
- If the message is just a question or casual chat, set hasAction=false and provide a helpful reply
- For assignee matching: strip Korean honorifics (님, 씨, 선배, etc.) and match against member names. Use partial matching (e.g., "민규" matches "박민규")
- For dates: interpret relative dates like "내일" (tomorrow), "다음주 월요일" (next Monday), "금요일까지" (by Friday) relative to today
- For times: interpret Korean time expressions like "오후 3시" (3 PM), "점심시간" (12:00 PM)
- Default todo priority is NORMAL unless urgency words are used (급한, 긴급, ASAP → HIGH; 여유있게, 천천히 → LOW)
- Default event duration is 1 hour if no end time specified
- CRITICAL: Never create both create_event and share_location for the same message. If an event mentions a location, put the location inside the event's "location" field. Only use share_location for messages that ONLY mention a place without any schedule/time/meeting context.
- When creating an event, include ALL mentioned chat members as attendeeIds. Match member names using partial matching (e.g., "민규" → "박민규")
- IMPORTANT: When a message contains a task assignment (부탁, 요청, 해줘, 해주세요, 전달, 진행, 작업, 리서치, 보고, 준비) with a deadline date (~까지, ~일까지, ~전까지), use **create_todo** (NOT create_event). The system automatically creates a companion calendar event for each assignee when a todo is created, so you do NOT need to create a separate create_event. Only use create_event for meetings, appointments, or schedules that are NOT task assignments (e.g., "3시에 미팅", "내일 회의", "촬영 일정").
- Always include a friendly, natural replyMessage summarizing what you extracted. Actions are auto-executed immediately, so say "등록했습니다" or "생성했습니다" or "변경했습니다" (not "확인 버튼을 눌러주세요" — there is no confirm step)
- IMPORTANT: When user says "변경할게요", "바꿔줘", "수정해줘", "~시로 옮겨줘" about an existing event, use **update_event** (NOT create_event). Look at conversation history to find the event's original title.
- ABSOLUTE RULE: Your ENTIRE response must be a single JSON object and NOTHING else. No text before or after the JSON. No markdown code fences. No explanation. Start with { and end with }. The "replyMessage" field inside the JSON is where your natural language response goes
- CRITICAL: You receive recent conversation history as prior messages. When the user says "그때", "거기", "그날", "그곳", "그 일정", etc., resolve these references from the conversation history. For example, if a previous message mentioned "2월 28일 부산 해운대 드론 촬영", and the user asks "그때 날씨 어때?", you must understand "그때" = 2월 28일 and the location = 부산 해운대.
- When weather data is provided below, use it to give detailed, helpful answers about weather conditions. Format the response nicely with emojis and clear sections for temperature, wind, visibility, precipitation, etc. Provide filming/outdoor activity recommendations based on the conditions.
- If weather data is NOT available (e.g., date too far in the future), explain that the forecast is only available up to 16 days ahead and suggest checking closer to the date.

## Response Format (JSON)
{
  "hasAction": boolean,
  "replyMessage": "string — natural reply to the user",
  "actions": [
    {
      "type": "create_todo" | "create_event" | "update_event" | "share_location" | "submit_service_suggestion",
      "confidence": 0.0-1.0,
      "data": { ... }  // shape depends on type
    }
  ]
}

### create_todo data shape:
{
  "title": "string",
  "assigneeNames": ["original name from message"],
  "assigneeIds": ["resolved user UUID"],
  "dueDate": "ISO 8601 datetime string",
  "priority": "LOW" | "NORMAL" | "HIGH",
  "projectId": "UUID or null"
}

### create_event data shape:
{
  "title": "string",
  "startAt": "ISO 8601 datetime string",
  "endAt": "ISO 8601 datetime string",
  "location": "string or null",
  "locationUrl": "string or null",
  "attendeeIds": ["user UUIDs"],
  "type": "MEETING" | "TASK" | "DEADLINE" | "DELIVERY",
  "projectId": "UUID or null"
}

### update_event data shape:
{
  "originalTitle": "string — title of the existing event to find and update",
  "title": "string or null — new title (only if changing the title)",
  "startAt": "ISO 8601 datetime string or null — new start time",
  "endAt": "ISO 8601 datetime string or null — new end time",
  "location": "string or null — new location",
  "attendeeIds": ["user UUIDs"] or null,
  "type": "MEETING" | "TASK" | "DEADLINE" | "DELIVERY" or null
}

### share_location data shape:
{
  "title": "string — place name",
  "address": "string — full address if mentioned",
  "searchQuery": "string — query for map search"
}

### submit_service_suggestion data shape:
{
  "suggestion": "string — the user's suggestion or feedback in their original words",
  "brainSummary": "string — your brief classification of the suggestion in Korean",
  "category": "feature_request" | "bug_report" | "ui_improvement" | "workflow_suggestion" | "other",
  "priority": "low" | "medium" | "high"
}
NOTE: For submit_service_suggestion, always set replyMessage to a warm acknowledgment like "소중한 의견 감사합니다! Brain Report에 기록했습니다. 팀에서 검토 후 반영하겠습니다. 🧠"

Today's date is: ${new Date().toISOString().split('T')[0]}
Current time (KST): ${new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}${weatherContext || ''}`;
}

/** A single message in the conversation history for multi-turn context */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Call the Anthropic Claude API to analyze a chat message.
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
  );

  // Build messages array: conversation history + current user message
  const messages: ConversationMessage[] = [
    ...(conversationHistory || []),
    { role: 'user', content: request.messageContent },
  ];

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();

  // Extract text content from the response
  const textBlock = result.content?.find(
    (block: { type: string }) => block.type === 'text',
  );
  if (!textBlock?.text) {
    throw new Error('No text content in Anthropic response');
  }

  // Parse the JSON response — robust extraction handles mixed text + JSON
  const parsed = extractJSON(textBlock.text);
  return parsed;
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

  // 4. Fallback — couldn't extract JSON, use raw text as reply
  console.error('Failed to extract JSON from LLM response:', text.substring(0, 200));
  return {
    hasAction: false,
    replyMessage: text.replace(/```[\s\S]*?```/g, '').replace(/\{[\s\S]*\}/, '').trim() || text,
    actions: [],
  };
}
