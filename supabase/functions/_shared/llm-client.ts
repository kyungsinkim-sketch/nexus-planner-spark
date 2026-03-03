// Anthropic Claude API client for Supabase Edge Functions (Deno)
// Uses Claude 3.5 Haiku for cost-efficient Korean NLU

import type { LLMResponse, ProcessRequest } from './brain-types.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2048; // Must accommodate large attendeeIds arrays (10+ UUIDs)
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 15_000; // 15s base — rate limit is per minute, so wait longer
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

  return `You are "Re-Be Brain", an AI assistant in a project management chat. Analyze messages and extract structured actions.

## Language
${langInstruction}

## Actions
1. **create_todo** — Task assignment (부탁, 해줘, ~까지). System auto-creates calendar event per assignee, so do NOT also create_event.
2. **create_event** — NEW meeting/schedule (미팅, 회의, 촬영). Include location in event if mentioned; do NOT create separate share_location.
3. **update_event** — MODIFY existing event (변경, 수정, 바꿔, 옮겨). Use "originalTitle" from history. Only include changed fields.
4. **share_location** — Standalone place WITHOUT schedule context only.
5. **submit_service_suggestion** — Re-Be app feedback (기능 추가, 버그, 개선). Reply warmly: "소중한 의견 감사합니다! Brain Report에 기록했습니다. 🧠"
6. **create_board_task** — Project board task (보드에 추가, 태스크 생성, 작업 등록). For project board management.

## Members
${memberList}
${projectId ? `\n## Project: ${projectId}${projectTitle ? ` (${projectTitle})` : ''}` : ''}

## Rules
- ENTIRE response = single JSON object, no markdown fences.
- hasAction=true with actions[] for actionable requests; hasAction=false with helpful reply otherwise.
- Assignee: strip honorifics (님/씨/선배), partial match ("민규"→"박민규").
- Dates: relative to today. Times: Korean (오후 3시=15:00). Default event=1hr, todo priority=NORMAL.
- Actions auto-execute: say "등록했습니다" not "확인 버튼을 눌러주세요".
- Resolve "그때/거기/그 일정" from conversation history.
- Weather: if data provided, give detailed answer with emojis. If unavailable, explain 16-day forecast limit.

## JSON Format
{"hasAction":bool,"replyMessage":"string","actions":[{"type":"...","confidence":0-1,"data":{...}}]}

### Data shapes:
- create_todo: {title, assigneeNames[], assigneeIds[], dueDate, priority:"LOW"|"NORMAL"|"HIGH", projectId}
- create_event: {title, startAt, endAt, location?, locationUrl?, attendeeIds[], type:"MEETING"|"TASK"|"DEADLINE"|"DELIVERY", projectId}
- update_event: {originalTitle, title?, startAt?, endAt?, location?, attendeeIds?, type?}
- share_location: {title, address, searchQuery}
- submit_service_suggestion: {suggestion, brainSummary, category:"feature_request"|"bug_report"|"ui_improvement"|"workflow_suggestion"|"other", priority:"low"|"medium"|"high"}
- create_board_task: {title, groupTitle?, assigneeNames[], assigneeIds[], status:"backlog"|"waiting"|"working"|"review"|"stuck"|"done", startDate?, endDate?, dueDate?, projectId}

Today: ${new Date().toISOString().split('T')[0]} KST: ${new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}${weatherContext || ''}`;
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
    request.language,
  );

  // Trim conversation history to save input tokens (rate limit is 10k/min)
  const trimmedHistory = (conversationHistory || [])
    .slice(-MAX_HISTORY_MESSAGES)
    .map(m => ({
      ...m,
      content: m.content.length > MAX_HISTORY_CHARS
        ? m.content.slice(0, MAX_HISTORY_CHARS) + '...'
        : m.content,
    }));

  // Build messages array: conversation history + current user message
  const messages: ConversationMessage[] = [
    ...trimmedHistory,
    { role: 'user', content: request.messageContent },
  ];

  const requestBody = JSON.stringify({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  // Retry with exponential backoff for rate limit (429) errors
  // Rate limit is per-minute, so delays must be long enough to clear the window
  let lastError: Error | null = null;
  let retryAfterMs = 0; // Set by retry-after header from Anthropic

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Use retry-after header if available, otherwise exponential backoff
      const delay = retryAfterMs || BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[LLM] Rate limited — retry ${attempt}/${MAX_RETRIES} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      retryAfterMs = 0; // Reset for next attempt
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: requestBody,
    });

    if (response.status === 429) {
      const errorBody = await response.text();
      // Read retry-after header (seconds) from Anthropic
      const retryAfterSec = response.headers.get('retry-after');
      if (retryAfterSec) {
        retryAfterMs = Math.min(parseFloat(retryAfterSec) * 1000, 120_000); // cap at 2 min
      }
      lastError = new RateLimitError(`Anthropic API rate limited (429): ${errorBody}`);
      continue; // retry
    }

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
    return extractJSON(textBlock.text);
  }

  // All retries exhausted
  throw lastError || new RateLimitError('Rate limited after max retries');
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
