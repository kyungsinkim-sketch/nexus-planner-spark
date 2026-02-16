// Anthropic Claude API client for conversation batch analysis (Deno)
// Used by brain-digest Edge Function for passive intelligence.
// Analyzes batches of chat messages to extract decisions, action items, risks, and summaries.

import type { DigestResult } from './brain-types.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 2048;

interface MessageForAnalysis {
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

/**
 * Build the system prompt for conversation batch analysis.
 */
function buildDigestSystemPrompt(
  projectTitle?: string,
  teamMembers?: { id: string; name: string }[],
): string {
  const memberList = teamMembers
    ? teamMembers.map((m) => `- ${m.name} (id: ${m.id})`).join('\n')
    : 'Unknown';

  return `You are "Re-Be Brain", an AI assistant analyzing Korean project management chat conversations.
Your job is to analyze a batch of messages and extract structured intelligence.

## Analysis Categories

1. **DECISIONS** — Agreements, approvals, choices made by the team
   - Look for: consensus phrases ("그렇게 하죠", "알겠습니다", "확정", "결정", "합의")
   - Include: WHO decided, WHAT was decided, implied confidence level

2. **ACTION ITEMS** — Tasks or commitments mentioned but not yet formalized
   - Look for: explicit assignments ("~가 ~하기로", "~에게 ~요청")
   - Also: implicit assignments ("이거 누가 해야 하는데...", "~해야 할 것 같은데")
   - Include: assignee if identifiable, deadline if mentioned

3. **RISKS / BLOCKERS** — Problems, delays, dependencies, concerns
   - Look for: problem signals ("문제가", "걱정", "지연", "어려움", "빡빡해")
   - Include: severity (low/medium/high), what's affected

4. **SUMMARY** — 2-3 sentence Korean summary of the conversation batch

## Team Members
${memberList}

${projectTitle ? `## Project: ${projectTitle}` : ''}

## Korean Language Notes
- Recognize indirect agreement patterns ("그렇게 하죠" = decision)
- Extract assignees from honorific context ("김 대표님이 확인해주신다고" = 김 대표님 has action)
- Detect urgency signals ("급합니다", "ASAP", "긴급" = high priority)
- "ㅇㅇ", "ㄴㄴ" are casual yes/no

## Response Format (JSON only, no markdown fences)
{
  "decisions": [
    { "text": "description in Korean", "confidence": 0.0-1.0, "relatedUserIds": ["uuid"], "priority": "low|medium|high" }
  ],
  "actionItems": [
    { "text": "description in Korean", "confidence": 0.0-1.0, "relatedUserIds": ["uuid"], "priority": "low|medium|high" }
  ],
  "risks": [
    { "text": "description in Korean", "confidence": 0.0-1.0, "priority": "low|medium|high" }
  ],
  "summary": "2-3 sentence summary in Korean"
}

If there are no items for a category, return an empty array.
Always respond with valid JSON only.`;
}

/**
 * Call Claude to analyze a batch of conversation messages.
 */
export async function analyzeConversation(
  messages: MessageForAnalysis[],
  apiKey: string,
  projectTitle?: string,
  teamMembers?: { id: string; name: string }[],
): Promise<DigestResult> {
  const systemPrompt = buildDigestSystemPrompt(projectTitle, teamMembers);

  // Format messages into a readable conversation
  const conversationText = messages
    .map((m) => {
      const time = new Date(m.createdAt).toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `[${time}] ${m.userName}: ${m.content}`;
    })
    .join('\n');

  const userMessage = `다음 ${messages.length}개의 메시지를 분석해주세요:\n\n${conversationText}`;

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
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();

  // Extract text content
  const textBlock = result.content?.find(
    (block: { type: string }) => block.type === 'text',
  );
  if (!textBlock?.text) {
    throw new Error('No text content in Anthropic response');
  }

  // Parse JSON response
  let parsed: DigestResult;
  try {
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    parsed = JSON.parse(jsonText);
  } catch {
    console.error('Failed to parse digest LLM response:', textBlock.text);
    // Return safe fallback
    parsed = {
      decisions: [],
      actionItems: [],
      risks: [],
      summary: '대화 분석에 실패했습니다.',
    };
  }

  return parsed;
}
