/**
 * Persona AI Service — Client-side API for @pablo persona queries
 *
 * Handles:
 * 1. queryPersona() — Send a question to the AI persona via brain-persona Edge Function
 * 2. submitPersonaFeedback() — Submit helpful/unhelpful feedback on a response
 * 3. getActivePersonas() — Fetch available AI personas
 * 4. detectPabloMention() — Detect @pablo mention in message content
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { PersonaResponseData } from '@/types/core';

// ─── Types ──────────────────────────────────────────

interface PersonaQueryRequest {
  personaId: string;
  query: string;
  projectId?: string;
  roomId?: string;
  directChatUserId?: string;
}

interface PersonaQueryResponse {
  success: boolean;
  message: Record<string, unknown>;
  queryLogId: string | null;
  personaResponse: {
    personaId: string;
    personaName: string;
    response: string;
    ragResultCount: number;
  };
}

export interface AIPersona {
  id: string;
  name: string;
  displayName: string;
  description: string;
  avatarUrl?: string;
  isActive: boolean;
  triggerPattern: string;
}

// ─── Constants ──────────────────────────────────────

/** Default Pablo AI persona name (matches ai_personas.name from migration 057) */
const PABLO_PERSONA_ID = 'pablo_ai';

/** Client-side retry config for rate limits */
const CLIENT_MAX_RETRIES = 2;
const CLIENT_RETRY_DELAY_MS = 20_000;

// ─── Error extraction ───────────────────────────────

async function extractFunctionError(error: unknown): Promise<string> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      return body?.error || body?.message || JSON.stringify(body);
    }
  } catch {
    // ignore
  }
  return (error as Error)?.message || 'Unknown error';
}

// ─── Core functions ─────────────────────────────────

/**
 * Send a query to the AI persona via brain-persona Edge Function.
 * Retries on 429 rate limit errors with exponential backoff.
 */
export async function queryPersona(
  request: PersonaQueryRequest,
): Promise<PersonaQueryResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= CLIENT_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = CLIENT_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[Persona] Rate limited — client retry ${attempt}/${CLIENT_MAX_RETRIES} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }

    const { data, error } = await supabase.functions.invoke('brain-persona', {
      body: {
        action: 'query',
        personaId: request.personaId,
        query: request.query,
        projectId: request.projectId || null,
        roomId: request.roomId || null,
        directChatUserId: request.directChatUserId || null,
      },
    });

    if (error) {
      const detail = await extractFunctionError(error);
      if (detail.includes('429') || detail.includes('rate_limit') || detail.includes('rate limit')) {
        lastError = new Error(`Persona AI rate limited: ${detail}`);
        continue;
      }
      console.error('brain-persona error detail:', detail);
      throw new Error(`Persona AI failed: ${detail}`);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Persona query returned unsuccessful response');
    }

    return data as PersonaQueryResponse;
  }

  throw new Error('Pablo AI가 잠시 사용량 제한에 도달했습니다. 1분 후 다시 시도해주세요.');
}

/**
 * Submit feedback on a persona response.
 */
export async function submitPersonaFeedback(
  queryLogId: string,
  feedback: 'helpful' | 'unhelpful',
): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase.functions.invoke('brain-persona', {
    body: {
      action: 'feedback',
      queryLogId,
      feedback,
    },
  });

  if (error) {
    const detail = await extractFunctionError(error);
    throw new Error(`Feedback submission failed: ${detail}`);
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Feedback submission unsuccessful');
  }
}

/**
 * Fetch active AI personas from the database.
 */
export async function getActivePersonas(): Promise<AIPersona[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('ai_personas')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch personas:', error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    displayName: row.display_name as string,
    description: row.description as string,
    avatarUrl: (row.avatar_url as string) || undefined,
    isActive: row.is_active as boolean,
    triggerPattern: (row.trigger_pattern as string) || `@${row.name}`,
  }));
}

/**
 * Detect @pablo mention in message content.
 * Returns whether the message contains a persona mention and the cleaned content.
 */
export function detectPabloMention(content: string): {
  isPabloMention: boolean;
  cleanContent: string;
  personaId: string;
} {
  // Match @pablo (case-insensitive) at word boundary
  const pabloPattern = /^@pablo\s+/i;
  const match = content.match(pabloPattern);

  if (match) {
    return {
      isPabloMention: true,
      cleanContent: content.replace(pabloPattern, '').trim(),
      personaId: PABLO_PERSONA_ID,
    };
  }

  // Also check for @pablo anywhere in the message (not just at start)
  const pabloAnywherePattern = /@pablo\b/i;
  if (pabloAnywherePattern.test(content)) {
    return {
      isPabloMention: true,
      cleanContent: content.replace(/@pablo\s*/gi, '').trim(),
      personaId: PABLO_PERSONA_ID,
    };
  }

  return {
    isPabloMention: false,
    cleanContent: content,
    personaId: '',
  };
}

/**
 * Get the default Pablo persona ID.
 */
export function getPabloPersonaId(): string {
  return PABLO_PERSONA_ID;
}
