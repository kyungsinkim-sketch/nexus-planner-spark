/**
 * translateService.ts — Free real-time translation via Lingva API.
 *
 * Uses lingva.ml (open-source Google Translate proxy) — free, no API key needed.
 * Fallback instances in case primary is down.
 */

const LINGVA_INSTANCES = [
  'https://translate.plausibility.cloud',
  'https://lingva.ml',
  'https://lingva.thedaviddelta.com',
];

let activeInstance = LINGVA_INSTANCES[0];

/**
 * Detect if text is primarily Korean or English.
 * Returns 'ko' or 'en'.
 */
export function detectLanguage(text: string): 'ko' | 'en' {
  // Count Korean characters (Hangul range)
  const koChars = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length;
  const total = text.replace(/\s/g, '').length;
  if (total === 0) return 'ko';
  return koChars / total > 0.3 ? 'ko' : 'en';
}

/**
 * Translate text between Korean and English.
 * Auto-detects source language and translates to the other.
 */
export async function translate(text: string): Promise<string | null> {
  if (!text.trim()) return null;

  const sourceLang = detectLanguage(text);
  const targetLang = sourceLang === 'ko' ? 'en' : 'ko';

  console.log('[Translate]', sourceLang, '→', targetLang, ':', text.slice(0, 50));

  for (const instance of LINGVA_INSTANCES) {
    try {
      const encoded = encodeURIComponent(text);
      const url = `${instance}/api/v1/${sourceLang}/${targetLang}/${encoded}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        console.warn('[Translate] Instance returned', res.status, instance);
        continue;
      }

      const data = await res.json();
      if (data.translation) {
        activeInstance = instance;
        console.log('[Translate] ✅', data.translation.slice(0, 50));
        return data.translation;
      }
    } catch (err: any) {
      console.warn('[Translate] Instance failed:', instance, err?.message || err);
      continue;
    }
  }

  console.warn('[Translate] All instances failed for:', text.slice(0, 50));
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
 * Queue a translation request. Requests are debounced (200ms)
 * to avoid flooding the API during fast speech.
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

  // Process in parallel (but limit concurrency to 3)
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
