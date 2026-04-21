/**
 * translate-text — Server-side translation proxy.
 *
 * Browsers block direct calls to translate.googleapis.com due to CORS.
 * This Edge Function proxies the request from Deno (no CORS), then returns
 * the translation to the client with permissive CORS headers.
 *
 * Provider chain (first success wins):
 * 1. Google Translate unofficial free endpoint (fastest, most reliable)
 * 2. MyMemory API (free, 5000 words/day)
 *
 * Request:  { text: string, source_lang: 'ko'|'en', target_lang: 'ko'|'en' }
 * Response: { translation: string | null }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function tryGoogleFree(text: string, sl: string, tl: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
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
    return null;
  }
}

async function tryMyMemory(text: string, sl: string, tl: string): Promise<string | null> {
  try {
    const langPair = `${sl === 'ko' ? 'ko-KR' : 'en-US'}|${tl === 'ko' ? 'ko-KR' : 'en-US'}`;
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
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, source_lang, target_lang } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ translation: null, error: 'empty text' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sl = source_lang === 'en' ? 'en' : 'ko';
    const tl = target_lang === 'en' ? 'en' : 'ko';

    // 1. Google Free
    const google = await tryGoogleFree(text, sl, tl);
    if (google) {
      return new Response(JSON.stringify({ translation: google, provider: 'google' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. MyMemory fallback
    const mm = await tryMyMemory(text, sl, tl);
    if (mm) {
      return new Response(JSON.stringify({ translation: mm, provider: 'mymemory' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ translation: null, error: 'all providers failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(JSON.stringify({ translation: null, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
