/**
 * translateService.ts — Real-time translation (Korean ↔ English).
 *
 * Provider chain (first success wins):
 * 1. Supabase Edge Function `translate-text` (server-side, bypasses browser CORS)
 * 2. Google Translate (unofficial free endpoint — may be CORS-blocked in browsers)
 * 3. Lingva API instances (open-source Google Translate proxy)
 * 4. MyMemory API (free, no API key, 5000 words/day)
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const LINGVA_INSTANCES = [
  'https://translate.plausibility.cloud',
  'https://lingva.ml',
  'https://lingva.thedaviddelta.com',
];

/**
 * Detect if text is primarily Korean or English.
 */
export function detectLanguage(text: string): 'ko' | 'en' {
  const koChars = (text.match(/[가-힯ᄀ-ᇿ㄰-㆏]/g) || []).length;
  const total = text.replace(/\s/g, '').length;
  if (total === 0) return 'ko';
  return koChars / total > 0.3 ? 'ko' : 'en';
}

// ─── Provider 1: Supabase Edge Function (server-side proxy) ─────

async function tryEdgeFunction(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.functions.invoke('translate-text', {
      body: { text, source_lang: sourceLang, target_lang: targetLang },
    });
    if (error) return null;
    const translation = (data as { translation?: string | null } | null)?.translation;
    return translation && typeof translation === 'string' ? translation : null;
  } catch {
    /* network / invocation error */
    return null;
  }
}

// ─── Provider 2: Google Translate (unofficial) ─────

async function tryGoogleFree(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    // Response: [[["translated","original",null,null,1],...],null,"ko"]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0]
        .filter((seg: unknown) => Array.isArray(seg) && seg.length > 0)
        .map((seg: unknown[]) => seg[0])
        .join('');
      if (translated && translated !== text) return translated;
    }
    return null;
  } catch {
    /* network / CORS / timeout */
    return null;
  }
}

// ─── Provider 3: Lingva (open-source proxy) ────────

async function tryLingva(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  for (const instance of LINGVA_INSTANCES) {
    try {
      const encoded = encodeURIComponent(text);
      const url = `${instance}/api/v1/${sourceLang}/${targetLang}/${encoded}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = await res.json();
      if (data.translation) return data.translation;
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Provider 4: MyMemory (free, 5000 words/day) ──

async function tryMyMemory(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  try {
    const langPair = `${sourceLang === 'ko' ? 'ko-KR' : 'en-US'}|${targetLang === 'ko' ? 'ko-KR' : 'en-US'}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${langPair}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      if (translated.toUpperCase() === text.toUpperCase()) return null;
      return translated;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ─── Main translate function ───────────────────────

/**
 * Translate text between Korean and English.
 * Auto-detects source language and translates to the other.
 */
export async function translate(text: string): Promise<string | null> {
  if (!text.trim()) return null;

  const sourceLang = detectLanguage(text);
  const targetLang = sourceLang === 'ko' ? 'en' : 'ko';

  // 1. Edge Function (server-side, bypasses browser CORS)
  const edgeResult = await tryEdgeFunction(text, sourceLang, targetLang);
  if (edgeResult) return edgeResult;

  // 2. Google Free (may be CORS-blocked in some browsers)
  const googleResult = await tryGoogleFree(text, sourceLang, targetLang);
  if (googleResult) return googleResult;

  // 3. Lingva proxy
  const lingvaResult = await tryLingva(text, sourceLang, targetLang);
  if (lingvaResult) return lingvaResult;

  // 4. MyMemory
  const myMemoryResult = await tryMyMemory(text, sourceLang, targetLang);
  if (myMemoryResult) return myMemoryResult;

  console.warn('[Translate] All providers failed for:', text.slice(0, 50));
  return null;
}

// ─── Batched translation for transcript lines ───────

type PendingTranslation = {
  text: string;
  resolve: (translation: string | null) => void;
};

let pendingBatch: PendingTranslation[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Queue a translation request. Debounced (200ms) to avoid flooding.
 */
export function translateDebounced(text: string): Promise<string | null> {
  return new Promise((resolve) => {
    pendingBatch.push({ text, resolve });

    if (batchTimer) clearTimeout(batchTimer);
    batchTimer = setTimeout(flushBatch, 200);
  });
}

async function flushBatch() {
  const batch = pendingBatch;
  pendingBatch = [];
  batchTimer = null;

  const chunks = [];
  for (let i = 0; i < batch.length; i += 3) {
    chunks.push(batch.slice(i, i + 3));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (item) => {
        const result = await translate(item.text);
        item.resolve(result);
      })
    );
  }
}
