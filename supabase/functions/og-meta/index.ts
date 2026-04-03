/**
 * og-meta — Fetch Open Graph metadata for a URL.
 * Used for link preview thumbnails in chat.
 * 
 * POST { url: string } → { title, description, image, siteName, favicon }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OGMeta {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  url: string;
}

function extractMeta(html: string, url: string): OGMeta {
  const get = (property: string): string | null => {
    // Try og: tags first
    const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'));
    if (ogMatch) return ogMatch[1];

    // Fallback to twitter: tags
    const twMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:${property}["']`, 'i'));
    if (twMatch) return twMatch[1];

    return null;
  };

  // Title fallback
  let title = get('title');
  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    title = titleMatch ? titleMatch[1].trim() : null;
  }

  // Description fallback
  let description = get('description');
  if (!description) {
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    description = descMatch ? descMatch[1] : null;
  }

  // Image
  let image = get('image');
  if (image && !image.startsWith('http')) {
    try {
      image = new URL(image, url).href;
    } catch { /* ignore */ }
  }

  // Site name
  const siteName = get('site_name');

  // Favicon
  let favicon: string | null = null;
  const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
  if (faviconMatch) {
    favicon = faviconMatch[1];
    if (!favicon.startsWith('http')) {
      try { favicon = new URL(favicon, url).href; } catch { /* ignore */ }
    }
  }
  if (!favicon) {
    try { favicon = new URL('/favicon.ico', url).href; } catch { /* ignore */ }
  }

  return { title, description, image, siteName, favicon, url };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'URL required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the page (with timeout)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Re-Be.io/1.0; +https://re-be.io)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `HTTP ${response.status}` }), {
        status: 200, // Return 200 with error field — client handles gracefully
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only parse HTML
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return new Response(JSON.stringify({ error: 'Not HTML', url }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Read only first 50KB to save bandwidth
    const reader = response.body?.getReader();
    let html = '';
    const decoder = new TextDecoder();
    if (reader) {
      let totalBytes = 0;
      while (totalBytes < 50000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        totalBytes += value.length;
      }
      reader.cancel().catch(() => {});
    }

    const meta = extractMeta(html, url);

    return new Response(JSON.stringify(meta), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400', // Cache 24h
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
