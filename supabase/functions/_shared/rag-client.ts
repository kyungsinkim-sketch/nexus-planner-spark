/**
 * RAG Client — Embedding generation and knowledge management utilities.
 *
 * Uses OpenAI text-embedding-3-small (1536 dims) for embedding.
 * Anthropic Claude for knowledge extraction from digests/actions.
 *
 * Three knowledge scopes:
 *   - personal: User-specific patterns, preferences, judgment
 *   - team: Project/team-level patterns, risks, collaboration
 *   - role: Role-based thinking structures (CD, PD, etc.)
 *
 * Knowledge is extracted automatically from:
 *   - Chat digests (brain-digest results)
 *   - Brain actions (confirmed/executed actions)
 *   - Peer reviews (project completion feedback)
 *   - Notion documents (when connected)
 */

// ─── Types ──────────────────────────────────────────

export interface KnowledgeItem {
  content: string;
  summary?: string;
  knowledge_type: KnowledgeType;
  source_type: SourceType;
  source_id?: string;
  source_context?: Record<string, unknown>;
  scope: 'personal' | 'team' | 'role' | 'global';
  user_id?: string;
  project_id?: string;
  role_tag?: string;
  confidence: number;
}

export type KnowledgeType =
  | 'decision_pattern'
  | 'preference'
  | 'judgment'
  | 'collaboration_pattern'
  | 'recurring_risk'
  | 'workflow'
  | 'domain_expertise'
  | 'feedback_pattern'
  | 'communication_style'
  | 'lesson_learned'
  // 신규 5종 (migration 053)
  | 'creative_direction'
  | 'budget_judgment'
  | 'stakeholder_alignment'
  | 'schedule_change'
  | 'context';

export type SourceType =
  | 'chat_digest'
  | 'brain_action'
  | 'peer_review'
  | 'decision_log'
  | 'meeting_note'
  | 'manual'
  // 신규 3종 (migration 053)
  | 'notion_page'
  | 'gmail'
  | 'voice_recording'
  // 신규 1종 (migration 057)
  | 'flow_chat_log'
  // 신규 1종 (migration 059)
  | 'ceo_pattern_seed';

export interface EmbeddingResult {
  embedding: number[];
  usage: { total_tokens: number };
}

export interface RAGSearchResult {
  id: string;
  content: string;
  summary: string | null;
  knowledge_type: string;
  scope: string;
  source_type: string;
  confidence: number;
  relevance_score: number;
  role_tag: string | null;
  similarity: number;
}

// ─── Embedding Generation ───────────────────────────

const OPENAI_EMBEDDING_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Generate an embedding vector for a text string.
 * Uses OpenAI text-embedding-3-small (1536 dimensions).
 * Falls back to Anthropic-based hashing if OpenAI key is not available.
 */
export async function generateEmbedding(
  text: string,
  openaiKey?: string,
): Promise<number[]> {
  // If no OpenAI key, use deterministic hash-based pseudo-embedding
  // (lower quality but works without external API)
  if (!openaiKey) {
    return generatePseudoEmbedding(text);
  }

  const response = await fetch(OPENAI_EMBEDDING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // Max input for embedding model
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`OpenAI embedding error: ${response.status} ${err}`);
    // THROW instead of silent fallback — pseudo-embeddings cause RAG failures
    // because pseudo ↔ real cosine similarity ≈ 0, yielding 0 search results
    throw new Error(`OpenAI embedding API failed: ${response.status} — ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}

/**
 * Generate a deterministic pseudo-embedding using text hashing.
 * This is a fallback when no embedding API is available.
 * Quality is much lower than real embeddings but allows the system to function.
 */
function generatePseudoEmbedding(text: string): number[] {
  const dims = 1536;
  const embedding = new Array(dims).fill(0);

  // Simple character-level feature extraction
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();

  // Use multiple hash seeds for different dimensions
  for (let i = 0; i < normalized.length && i < 500; i++) {
    const charCode = normalized.charCodeAt(i);
    for (let d = 0; d < 8; d++) {
      const idx = ((charCode * 31 + i * 17 + d * 37) & 0x7fffffff) % dims;
      embedding[idx] += Math.sin(charCode * (d + 1) * 0.1) * 0.1;
    }
  }

  // Normalize to unit length
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dims; i++) {
      embedding[i] /= magnitude;
    }
  }

  return embedding;
}

// ─── Knowledge Extraction ───────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

/**
 * Extract knowledge items from a chat digest result.
 * Analyzes decisions, action items, and risks to identify patterns.
 */
export async function extractKnowledgeFromDigest(
  digest: {
    decisions: Array<{ text: string; confidence: number; relatedUserIds?: string[]; priority?: string }>;
    actionItems: Array<{ text: string; confidence: number; relatedUserIds?: string[]; priority?: string }>;
    risks: Array<{ text: string; confidence: number; priority?: string }>;
    summary: string;
  },
  context: {
    projectId?: string;
    userId?: string;
    projectTitle?: string;
    teamMembers?: { id: string; name: string }[];
  },
  anthropicKey: string,
): Promise<KnowledgeItem[]> {
  const items: KnowledgeItem[] = [];

  // Direct extraction: decisions → decision_pattern
  for (const decision of digest.decisions) {
    if (decision.confidence >= 0.6) {
      items.push({
        content: decision.text,
        summary: decision.text.slice(0, 100),
        knowledge_type: 'decision_pattern',
        source_type: 'chat_digest',
        scope: context.projectId ? 'team' : 'personal',
        user_id: decision.relatedUserIds?.[0] || context.userId,
        project_id: context.projectId,
        confidence: decision.confidence,
      });
    }
  }

  // Direct extraction: risks → recurring_risk
  for (const risk of digest.risks) {
    if (risk.confidence >= 0.5) {
      items.push({
        content: risk.text,
        summary: risk.text.slice(0, 100),
        knowledge_type: 'recurring_risk',
        source_type: 'chat_digest',
        scope: 'team',
        project_id: context.projectId,
        confidence: risk.confidence,
      });
    }
  }

  // LLM-based deep extraction if we have enough content
  const totalContent = [
    ...digest.decisions.map(d => d.text),
    ...digest.actionItems.map(a => a.text),
    ...digest.risks.map(r => r.text),
    digest.summary,
  ].join('\n');

  if (totalContent.length > 50) {
    try {
      const deepItems = await extractDeepKnowledge(totalContent, context, anthropicKey);
      items.push(...deepItems);
    } catch (err) {
      console.warn('Deep knowledge extraction failed (non-fatal):', err);
    }
  }

  return items;
}

/**
 * Use LLM to extract deeper knowledge patterns from text.
 */
async function extractDeepKnowledge(
  text: string,
  context: {
    projectId?: string;
    userId?: string;
    projectTitle?: string;
  },
  anthropicKey: string,
): Promise<KnowledgeItem[]> {
  const systemPrompt = `You are a knowledge extraction engine for a Korean creative production management system.
Analyze the following conversation insights and extract reusable knowledge patterns.

Output JSON array of knowledge items. Each item:
{
  "content": "Clear, reusable knowledge statement in Korean",
  "knowledge_type": "decision_pattern|preference|judgment|collaboration_pattern|recurring_risk|workflow|domain_expertise|feedback_pattern|communication_style|lesson_learned|creative_direction|budget_judgment|stakeholder_alignment|schedule_change|context",
  "scope": "personal|team",
  "confidence": 0.0-1.0,
  "role_tag": "CD|PD|EDITOR|DIRECTOR|WRITER|DESIGNER|MANAGER|PRODUCER|CREATIVE_DIRECTOR|BUDGET_MANAGER|PROJECT_MANAGER|STAKEHOLDER|VENDOR|null"
}

Type guide:
- creative_direction: 크리에이티브 방향성 결정 (톤앤매너, 비주얼 스타일)
- budget_judgment: 예산 관련 판단 (비용 절감, 투자 우선순위)
- stakeholder_alignment: 이해관계자 간 합의/조율 패턴
- schedule_change: 일정 변경 관련 의사결정
- context: 프로젝트 맥락 정보 (다른 타입에 해당하지 않는 일반 정보)

Rules:
- Extract patterns, NOT specific events (e.g., "예산 변경 시 팀 전체 합의 필요" not "12/15 예산을 변경했다")
- Each item should be a standalone, reusable insight
- Confidence reflects how generalizable the pattern is
- role_tag only if the pattern is role-specific
- Return [] if no extractable patterns
- Max 5 items per analysis
- Always respond with valid JSON array only`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: `${context.projectTitle ? `[프로젝트: ${context.projectTitle}]\n` : ''}${text.slice(0, 2000)}` }],
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM extraction failed: ${response.status}`);
  }

  const result = await response.json();
  const textBlock = result.content?.find((b: { type: string }) => b.type === 'text');
  if (!textBlock?.text) return [];

  try {
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: Record<string, unknown>) => ({
      content: String(item.content || ''),
      summary: String(item.content || '').slice(0, 100),
      knowledge_type: String(item.knowledge_type || 'lesson_learned') as KnowledgeType,
      source_type: 'chat_digest' as SourceType,
      scope: String(item.scope || 'team') as 'personal' | 'team' | 'role',
      user_id: context.userId,
      project_id: context.projectId,
      role_tag: item.role_tag ? String(item.role_tag) : undefined,
      confidence: Number(item.confidence) || 0.5,
    }));
  } catch {
    console.warn('Failed to parse deep knowledge extraction:', textBlock.text.slice(0, 200));
    return [];
  }
}

/**
 * Extract knowledge from a brain action (confirmed/executed).
 * Tracks what actions users take to build preference patterns.
 */
export function extractKnowledgeFromAction(
  action: {
    type: string;
    data: Record<string, unknown>;
    status: string;
  },
  userId: string,
  projectId?: string,
): KnowledgeItem | null {
  // Only learn from confirmed/executed actions
  if (action.status !== 'confirmed' && action.status !== 'executed') return null;

  switch (action.type) {
    case 'create_todo': {
      const data = action.data;
      if (data.priority === 'HIGH') {
        return {
          content: `이 사용자는 "${data.title}" 같은 작업을 높은 우선순위로 설정하는 경향이 있습니다.`,
          knowledge_type: 'preference',
          source_type: 'brain_action',
          scope: 'personal',
          user_id: userId,
          project_id: projectId,
          confidence: 0.4, // Low confidence for single action
        };
      }
      break;
    }
    case 'create_event': {
      const data = action.data;
      if (data.type === 'MEETING' && data.location) {
        return {
          content: `자주 사용하는 회의 장소: ${data.location}`,
          knowledge_type: 'preference',
          source_type: 'brain_action',
          scope: 'personal',
          user_id: userId,
          project_id: projectId,
          confidence: 0.3,
        };
      }
      break;
    }
    // Other action types can be added as patterns emerge
  }

  return null;
}

/**
 * Extract knowledge from peer review (project completion).
 */
export function extractKnowledgeFromReview(
  review: {
    reviewerId: string;
    revieweeId: string;
    rating: number;
    comment: string;
    projectId: string;
  },
): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];

  if (review.comment && review.comment.length > 10) {
    // Feedback pattern for the reviewer
    items.push({
      content: review.comment,
      summary: review.comment.slice(0, 100),
      knowledge_type: 'feedback_pattern',
      source_type: 'peer_review',
      scope: 'personal',
      user_id: review.revieweeId,
      project_id: review.projectId,
      source_context: {
        reviewerId: review.reviewerId,
        rating: review.rating,
      },
      confidence: 0.7,
    });

    // Collaboration pattern for the team
    if (review.rating >= 4) {
      items.push({
        content: `이 팀원에 대한 긍정적 평가: ${review.comment}`,
        knowledge_type: 'collaboration_pattern',
        source_type: 'peer_review',
        scope: 'team',
        project_id: review.projectId,
        source_context: {
          revieweeId: review.revieweeId,
          rating: review.rating,
        },
        confidence: 0.6,
      });
    }
  }

  return items;
}

// ─── RAG Context Builder ────────────────────────────

/**
 * Build a RAG context string from retrieved knowledge items.
 * This is injected into the Brain AI system prompt for personalized responses.
 */
export function buildRAGContext(
  items: RAGSearchResult[],
  maxChars: number = 800,
): string {
  if (!items.length) return '';

  let context = '\n\n## 참고 지식 (Knowledge Base)\n아래는 이 조직에서 축적된 실제 판단 기록입니다. 반드시 이 내용을 바탕으로 구체적으로 답변하세요. 일반적인 조언이 아닌, 아래 지식에 기반한 구체적 답변을 해야 합니다.\n\n';
  let currentLength = context.length;

  for (const item of items) {
    // Use full content for rich context, fall back to summary only if content is too long
    const body = item.content || item.summary || '';
    const line = `### [${item.knowledge_type}] (신뢰도: ${(item.confidence * 100).toFixed(0)}%)\n${body}\n\n`;

    if (currentLength + line.length > maxChars) {
      // Try truncated version
      const truncated = `### [${item.knowledge_type}] (신뢰도: ${(item.confidence * 100).toFixed(0)}%)\n${body.slice(0, maxChars - currentLength - 50)}\n\n`;
      if (currentLength + truncated.length <= maxChars) {
        context += truncated;
      }
      break;
    }
    context += line;
    currentLength += line.length;
  }

  return context;
}
