/**
 * Local RAG Service — Tauri IPC bridge
 *
 * Provides TypeScript interface to the Rust local RAG engine.
 * Falls back gracefully when not running in Tauri (web/PWA mode).
 *
 * All knowledge data stays on the user's device:
 * - SQLite for structured storage
 * - 384-dim embeddings generated locally (ONNX or pseudo)
 * - Hybrid vector + relevance + usage scoring
 * - 정반합 (thesis-antithesis-synthesis) 3-pass search
 * - Claude Haiku chat digest analysis
 * - Knowledge extraction pipeline
 * - CEO 30-pattern initial seeding
 */

import { invokeTauri, isTauriApp } from '@/lib/platform';

// ─── Types ──────────────────────────────────────────────

export interface SearchResult {
  id: string;
  content: string;
  summary?: string;
  knowledge_type: string;
  source_type: string;
  scope: string;
  role_tag?: string;
  dialectic_tag?: string;
  confidence: number;
  relevance_score: number;
  usage_count: number;
  similarity: number;
  hybrid_score: number;
  project_id?: string;
  user_id?: string;
}

export interface RagStats {
  initialized: boolean;
  knowledge_count: number;
  active_count: number;
  by_scope: { scope: string; count: number }[];
  by_type: { knowledge_type: string; count: number }[];
  last_created_at?: string;
  total_usage: number;
}

export interface IngestResult {
  id: string;
  is_pseudo_embedding: boolean;
}

export interface ChatMessage {
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface DigestResult {
  decisions: DigestItem[];
  actionItems: DigestItem[];
  risks: RiskItem[];
  summary: string;
}

export interface DigestItem {
  text: string;
  confidence: number;
  relatedUserIds: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface RiskItem {
  text: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
}

export interface DigestResponse {
  digest: DigestResult;
  stored_ids: string[];
}

export interface ExtractionResult {
  created_ids: string[];
  skipped_count: number;
  is_pseudo_embedding: boolean;
}

export interface StoredDigest {
  id: string;
  room_id: string;
  project_id?: string;
  digest_type: string;
  content: string;
  message_count: number;
  confidence: number;
  created_at: string;
}

export interface SeedResult {
  seeded: number;
  already_seeded: boolean;
}

// ─── Search ─────────────────────────────────────────────

/**
 * Hybrid search: vector similarity + relevance + usage scoring.
 * Returns top-N knowledge items matching the query.
 */
export async function ragSearch(params: {
  query: string;
  scope?: 'all' | 'personal' | 'team' | 'role';
  userId?: string;
  projectId?: string;
  roleTag?: string;
  knowledgeType?: string;
  threshold?: number;
  limit?: number;
}): Promise<SearchResult[]> {
  if (!isTauriApp()) return [];

  const result = await invokeTauri<string>('rag_search', {
    query: params.query,
    scope: params.scope,
    user_id: params.userId,
    project_id: params.projectId,
    role_tag: params.roleTag,
    knowledge_type: params.knowledgeType,
    threshold: params.threshold,
    limit: params.limit,
  });

  return result ? JSON.parse(result) : [];
}

/**
 * Dialectic search: find opposing/counterargument knowledge.
 * Used for 정반합 antithesis pass.
 */
export async function ragDialecticSearch(params: {
  query: string;
  userId?: string;
  projectId?: string;
  roleTag?: string;
  opposingTags?: string[];
  threshold?: number;
  limit?: number;
}): Promise<SearchResult[]> {
  if (!isTauriApp()) return [];

  const result = await invokeTauri<string>('rag_dialectic_search', {
    query: params.query,
    user_id: params.userId,
    project_id: params.projectId,
    role_tag: params.roleTag,
    opposing_tags: params.opposingTags,
    threshold: params.threshold,
    limit: params.limit,
  });

  return result ? JSON.parse(result) : [];
}

/**
 * Get RAG context string for LLM injection.
 * Performs 3-pass search (thesis → antithesis → personal) and builds markdown.
 */
export async function ragGetContext(params: {
  query: string;
  scope?: string;
  userId?: string;
  projectId?: string;
  roleTag?: string;
  maxChars?: number;
}): Promise<string> {
  if (!isTauriApp()) return '';

  const result = await invokeTauri<string>('rag_get_context', {
    query: params.query,
    scope: params.scope,
    user_id: params.userId,
    project_id: params.projectId,
    role_tag: params.roleTag,
    max_chars: params.maxChars,
  });

  return result || '';
}

// ─── Ingest ─────────────────────────────────────────────

/**
 * Ingest a knowledge item into the local database.
 * Generates embedding and stores both in SQLite.
 */
export async function ragIngest(params: {
  content: string;
  knowledgeType: string;
  sourceType: string;
  scope?: string;
  scopeLayer?: string;
  roleTag?: string;
  dialecticTag?: string;
  confidence?: number;
  userId?: string;
  projectId?: string;
  sourceId?: string;
  sourceContext?: string;
}): Promise<IngestResult | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('rag_ingest', {
    content: params.content,
    knowledge_type: params.knowledgeType,
    source_type: params.sourceType,
    scope: params.scope,
    scope_layer: params.scopeLayer,
    role_tag: params.roleTag,
    dialectic_tag: params.dialecticTag,
    confidence: params.confidence,
    user_id: params.userId,
    project_id: params.projectId,
    source_id: params.sourceId,
    source_context: params.sourceContext,
  });

  return result ? JSON.parse(result) : null;
}

// ─── Phase 3: Digest & Extract ──────────────────────────

/**
 * Analyze chat messages using Claude Haiku.
 * Extracts decisions, action items, risks, and summary.
 *
 * Privacy: Messages are sent to Claude API for analysis only.
 * Anthropic does NOT train on API data. Results stored locally.
 *
 * @param messages - Array of chat messages to analyze
 * @param roomId - Chat room ID for storage
 * @param projectId - Optional project ID
 * @param apiKey - Anthropic API key
 */
export async function ragDigest(params: {
  messages: ChatMessage[];
  roomId: string;
  projectId?: string;
  apiKey: string;
}): Promise<DigestResponse | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('rag_digest', {
    messages: params.messages,
    room_id: params.roomId,
    project_id: params.projectId,
    api_key: params.apiKey,
  });

  return result ? JSON.parse(result) : null;
}

/**
 * Extract reusable knowledge from a digest using Claude Haiku.
 * Deep analysis that finds patterns, not just one-time facts.
 *
 * @param digestJson - JSON string of DigestResult
 * @param sourceId - Digest ID for duplicate prevention
 * @param apiKey - Anthropic API key
 */
export async function ragExtractFromDigest(params: {
  digestJson: string;
  userId?: string;
  projectId?: string;
  sourceId: string;
  apiKey: string;
}): Promise<ExtractionResult | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('rag_extract_from_digest', {
    digest_json: params.digestJson,
    user_id: params.userId,
    project_id: params.projectId,
    source_id: params.sourceId,
    api_key: params.apiKey,
  });

  return result ? JSON.parse(result) : null;
}

/**
 * Ingest knowledge from a brain action (no Claude API needed).
 * Rule-based extraction for task completions, decisions, etc.
 */
export async function ragIngestAction(params: {
  actionType: string;
  actionContent: string;
  userId?: string;
  projectId?: string;
  sourceId: string;
}): Promise<ExtractionResult | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('rag_ingest_action', {
    action_type: params.actionType,
    action_content: params.actionContent,
    user_id: params.userId,
    project_id: params.projectId,
    source_id: params.sourceId,
  });

  return result ? JSON.parse(result) : null;
}

/**
 * Ingest knowledge from a peer review (project completion).
 */
export async function ragIngestReview(params: {
  reviewerName: string;
  revieweeName: string;
  rating: number;
  comment: string;
  userId?: string;
  projectId?: string;
  sourceId: string;
}): Promise<ExtractionResult | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('rag_ingest_review', {
    reviewer_name: params.reviewerName,
    reviewee_name: params.revieweeName,
    rating: params.rating,
    comment: params.comment,
    user_id: params.userId,
    project_id: params.projectId,
    source_id: params.sourceId,
  });

  return result ? JSON.parse(result) : null;
}

/**
 * Get recent digests for a chat room.
 */
export async function ragGetDigests(
  roomId: string,
  limit?: number,
): Promise<StoredDigest[]> {
  if (!isTauriApp()) return [];

  const result = await invokeTauri<string>('rag_get_digests', {
    room_id: roomId,
    limit,
  });

  return result ? JSON.parse(result) : [];
}

// ─── Seeding ────────────────────────────────────────────

/**
 * Seed CEO 30 patterns into the local database.
 * Runs automatically on first launch; calling again is a no-op.
 */
export async function ragSeedCeo(): Promise<SeedResult | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('rag_seed_ceo');
  return result ? JSON.parse(result) : null;
}

/**
 * Check if CEO patterns have been seeded.
 */
export async function ragIsSeeded(): Promise<boolean> {
  if (!isTauriApp()) return false;

  const result = await invokeTauri<boolean>('rag_is_seeded');
  return result ?? false;
}

// ─── Stats & Feedback ───────────────────────────────────

/**
 * Get local RAG statistics (knowledge count, types, etc.)
 */
export async function ragGetStats(): Promise<RagStats | null> {
  if (!isTauriApp()) return null;

  const result = await invokeTauri<string>('rag_stats');
  return result ? JSON.parse(result) : null;
}

/**
 * Submit feedback on a RAG query (👍/👎).
 * Updates relevance scores: +0.02 for helpful, -0.03 for not helpful.
 */
export async function ragFeedback(queryLogId: string, wasHelpful: boolean): Promise<void> {
  if (!isTauriApp()) return;

  await invokeTauri<void>('rag_feedback', {
    query_log_id: queryLogId,
    was_helpful: wasHelpful,
  });
}

// ─── Utility ────────────────────────────────────────────

/**
 * Check if local RAG is available and initialized.
 */
export async function isLocalRagAvailable(): Promise<boolean> {
  if (!isTauriApp()) return false;

  const stats = await ragGetStats();
  return stats?.initialized ?? false;
}

/**
 * Ping the Rust backend to verify the IPC bridge works.
 */
export async function pingBackend(): Promise<string | null> {
  return invokeTauri<string>('ping');
}

// ─── Digest Trigger Logic ───────────────────────────────

/**
 * Configuration for automatic digest triggering.
 */
export const DIGEST_CONFIG = {
  /** Minimum messages before triggering a digest */
  MIN_MESSAGES: 15,
  /** Minimum time (ms) between digests for the same room */
  COOLDOWN_MS: 30 * 60 * 1000, // 30 minutes
};

/** Track last digest time per room */
const lastDigestTimes = new Map<string, number>();

/**
 * Check if a digest should be triggered for a room.
 * Conditions: ≥15 new messages AND ≥30min since last digest.
 */
export function shouldTriggerDigest(
  roomId: string,
  messageCount: number,
): boolean {
  if (!isTauriApp()) return false;
  if (messageCount < DIGEST_CONFIG.MIN_MESSAGES) return false;

  const lastTime = lastDigestTimes.get(roomId) || 0;
  const elapsed = Date.now() - lastTime;
  return elapsed >= DIGEST_CONFIG.COOLDOWN_MS;
}

/**
 * Mark that a digest was triggered for a room.
 */
export function markDigestTriggered(roomId: string): void {
  lastDigestTimes.set(roomId, Date.now());
}
