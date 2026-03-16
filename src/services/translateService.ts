/**
 * translateService.ts — Free real-time translation (Korean ↔ English).
 *
 * Strategy:
 * 1. Lingva API instances (open-source Google Translate proxy)
 * 2. MyMemory API fallback (free, no API key, 5000 words/day)
 */

const LINGVA_INSTANCES = [
  'https://translate.plausibility.cloud',
  'https://lingva.ml',
  'https://lingva.thedaviddelta.com',
];

/**
 * Detect if text is primarily Korean or English.
 */
export function detectLanguage(text: string): 'ko' | 'en' {
  const koChars = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length;
  const total = text.replace(/\s/g, '').length;
  if (total === 0) return 'ko';
  return koChars / total > 0.3 ? 'ko' : 'en';
}

/**
 * Try Lingva instances.
 */
async function tryLingva(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  for (const instance of LINGVA_INSTANCES) {
    try {
      const encoded = encodeURIComponent(text);
      const url = `${instance}/api/v1/${sourceLang}/${targetLang}/${encoded}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = await res.json();
      if (data.translation) {
        return data.translation;
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Try MyMemory API (free, no key needed).
 * Limit: 5000 words/day, 500 chars/request.
 */
async function tryMyMemory(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  try {
    // MyMemory uses full locale codes
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
      // MyMemory sometimes returns the original text in uppercase when it fails
      if (translated.toUpperCase() === text.toUpperCase()) return null;
      return translated;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Translate text between Korean and English.
 * Auto-detects source language and translates to the other.
 */
export async function translate(text: string): Promise<string | null> {
  if (!text.trim()) return null;

  const sourceLang = detectLanguage(text);
  const targetLang = sourceLang === 'ko' ? 'en' : 'ko';

  // Try Lingva first
  const lingvaResult = await tryLingva(text, sourceLang, targetLang);
  if (lingvaResult) return lingvaResult;

  // Fallback to MyMemory
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
