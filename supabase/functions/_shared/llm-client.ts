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
2. **create_event** — When someone proposes a meeting, deadline, or schedule. If a location is mentioned alongside the event, include it in the event's "location" field. Do NOT create a separate share_location action.
3. **share_location** — ONLY when someone shares a standalone place/location WITHOUT any schedule or event context. Examples: "촬영 답사 장소는 삼각지역 6번출구입니다", "드론샷은 제주도 성산포 앞바다에서 진행 예정입니다". If the message also mentions a time/date/meeting, use create_event with the location embedded instead.

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
- Always include a friendly, natural replyMessage summarizing what you extracted
- You MUST respond with valid JSON only, no markdown code fences
- When weather data is provided below, use it to give detailed, helpful answers about weather conditions. Format the response nicely with emojis and clear sections for temperature, wind, visibility, precipitation, etc. Provide filming/outdoor activity recommendations based on the conditions.
- If weather data is NOT available (e.g., date too far in the future), explain that the forecast is only available up to 16 days ahead and suggest checking closer to the date.

## Response Format (JSON)
{
  "hasAction": boolean,
  "replyMessage": "string — natural reply to the user",
  "actions": [
    {
      "type": "create_todo" | "create_event" | "share_location",
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

### share_location data shape:
{
  "title": "string — place name",
  "address": "string — full address if mentioned",
  "searchQuery": "string — query for map search"
}

Today's date is: ${new Date().toISOString().split('T')[0]}
Current time (KST): ${new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}${weatherContext || ''}`;
}

/**
 * Call the Anthropic Claude API to analyze a chat message.
 * Optional weatherContext is injected into the system prompt for weather queries.
 */
export async function analyzeMessage(
  request: ProcessRequest,
  apiKey: string,
  weatherContext?: string,
): Promise<LLMResponse> {
  const systemPrompt = buildSystemPrompt(
    request.chatMembers,
    request.projectId,
    request.projectTitle,
    weatherContext,
  );

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
      messages: [
        {
          role: 'user',
          content: request.messageContent,
        },
      ],
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

  // Parse the JSON response
  let parsed: LLMResponse;
  try {
    // Strip markdown code fences if present
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    parsed = JSON.parse(jsonText);
  } catch (e) {
    console.error('Failed to parse LLM response:', textBlock.text);
    // Return a safe fallback
    parsed = {
      hasAction: false,
      replyMessage: textBlock.text,
      actions: [],
    };
  }

  return parsed;
}
