// Shared Gemini Flash API client for Supabase Edge Functions (Deno)
// Replaces Anthropic Claude API calls with Google Gemini 2.0 Flash (free tier).
//
// Free tier limits (Google AI Studio):
// - 15 RPM, 1M TPM, 1500 RPD for gemini-2.0-flash
// - Exceeding limits returns 429 → no charges incurred
//
// Environment variable: GEMINI_API_KEY

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';

export interface GeminiMessage {
  role: 'user' | 'model';
  content: string;
}

export interface GeminiRequestOptions {
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  systemPrompt: string;
  messages: GeminiMessage[];
}

export interface GeminiResponse {
  text: string;
  finishReason?: string;
}

/** Custom error for rate limit (429) so callers can distinguish */
export class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}

/**
 * Call the Gemini API with the given system prompt and messages.
 * Returns the text response from the model.
 *
 * Handles:
 * - Anthropic-style role mapping (assistant → model)
 * - System prompt via systemInstruction
 * - 429/503 rate limit detection
 */
export async function callGemini(
  apiKey: string,
  options: GeminiRequestOptions,
): Promise<GeminiResponse> {
  const model = options.model || DEFAULT_MODEL;
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  // Build contents array (Gemini format)
  const contents = options.messages.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: options.systemPrompt }],
    },
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens || 2048,
      temperature: options.temperature ?? 0.7,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (response.status === 429) {
    const errText = await response.text();
    throw new GeminiRateLimitError(`Gemini API rate limited (429): ${errText}`);
  }

  if (response.status === 503) {
    const errText = await response.text();
    throw new GeminiRateLimitError(`Gemini API overloaded (503): ${errText}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText}`);
  }

  const data = await response.json();

  // Extract text from response
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text || '';
  const finishReason = candidate?.finishReason;

  if (!text) {
    throw new Error('No text content in Gemini response');
  }

  return { text, finishReason };
}

/**
 * Call Gemini with retry logic for rate limits (429/503).
 * Uses exponential backoff.
 */
export async function callGeminiWithRetry(
  apiKey: string,
  options: GeminiRequestOptions,
  maxRetries = 3,
  baseDelayMs = 10_000,
): Promise<GeminiResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`[Gemini] Rate limited — retry ${attempt}/${maxRetries} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      return await callGemini(apiKey, options);
    } catch (err) {
      if (err instanceof GeminiRateLimitError) {
        lastError = err;
        continue; // retry
      }
      throw err; // non-retryable
    }
  }

  throw lastError || new GeminiRateLimitError('Rate limited after max retries');
}

/**
 * Convert Anthropic-style role names to Gemini roles.
 * Anthropic uses 'assistant', Gemini uses 'model'.
 */
export function toGeminiRole(role: 'user' | 'assistant'): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user';
}
