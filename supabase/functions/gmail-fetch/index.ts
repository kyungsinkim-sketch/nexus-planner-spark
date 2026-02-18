/**
 * gmail-fetch — Incremental Gmail email fetching via historyId.
 *
 * Flow:
 *   1. Load stored historyId from gmail_sync_state table
 *   2. If historyId exists → history.list (incremental, new messages only)
 *   3. If no historyId → messages.list (initial sync, max 20)
 *   4. Fetch full message details for new messageIds
 *   5. Store nextHistoryId for subsequent syncs
 *
 * Request body: { userId: string }
 * Response: { newMessages: GmailMessage[], historyId: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ensureValidToken, type GoogleTokenRow } from '../_shared/gcal-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  date: string;
  isUnread: boolean;
  snippet: string;
}

// ─── Helpers ─────────────────────────────────────────

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const binaryStr = atob(base64);
    // Convert Latin-1 string to Uint8Array, then decode as UTF-8
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function stripHtml(html: string): string {
  // Remove style/script blocks entirely
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  // Replace <br>, <p>, <div>, <li> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
  // Remove all other tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // Collapse multiple newlines/spaces
  text = text.replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim();
  return text;
}

function extractTextBody(payload: Record<string, unknown>): string {
  // Try direct body (single-part message)
  const body = payload.body as { data?: string; size?: number } | undefined;
  const mimeType = payload.mimeType as string | undefined;
  if (body?.data) {
    const decoded = decodeBase64Url(body.data);
    return mimeType === 'text/html' ? stripHtml(decoded) : decoded;
  }
  // Try parts (multipart) — prefer text/plain, fallback to text/html
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    let htmlFallback = '';
    for (const part of parts) {
      const partMime = part.mimeType as string;
      if (partMime === 'text/plain') {
        const partBody = part.body as { data?: string } | undefined;
        if (partBody?.data) return decodeBase64Url(partBody.data);
      }
      if (partMime === 'text/html' && !htmlFallback) {
        const partBody = part.body as { data?: string } | undefined;
        if (partBody?.data) htmlFallback = stripHtml(decodeBase64Url(partBody.data));
      }
      // Recursive for nested multipart
      if (partMime?.startsWith('multipart/')) {
        const nested = extractTextBody(part);
        if (nested) return nested;
      }
    }
    if (htmlFallback) return htmlFallback;
  }
  return '';
}

function parseGmailMessage(raw: Record<string, unknown>): GmailMessage {
  const payload = raw.payload as Record<string, unknown>;
  const headers = (payload?.headers || []) as Array<{ name: string; value: string }>;

  const from = getHeader(headers, 'From');
  const to = getHeader(headers, 'To')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const cc = getHeader(headers, 'Cc');
  const subject = getHeader(headers, 'Subject');
  const date = getHeader(headers, 'Date');
  const labelIds = (raw.labelIds || []) as string[];

  return {
    id: raw.id as string,
    threadId: raw.threadId as string,
    from,
    to,
    cc: cc ? cc.split(',').map((s: string) => s.trim()) : undefined,
    subject,
    body: extractTextBody(payload).slice(0, 2000), // Limit body size
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    isUnread: labelIds.includes('UNREAD'),
    snippet: (raw.snippet as string) || '',
  };
}

// ─── Gmail API calls ─────────────────────────────────

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ accessToken: string } | { error: string; status: number }> {
  const { data: tokenRow } = await supabase
    .from('google_calendar_tokens')
    .select('id, user_id, access_token, refresh_token, token_type, expires_at, scope, connected_email, calendar_id, auto_sync, last_sync_at, sync_status, sync_error')
    .eq('user_id', userId)
    .single();

  if (!tokenRow?.access_token) {
    return { error: 'Gmail not connected', status: 401 };
  }

  try {
    const accessToken = await ensureValidToken(supabase, tokenRow as GoogleTokenRow);
    return { accessToken };
  } catch (err) {
    console.error('[gmail-fetch] Token refresh failed:', err);
    return { error: 'Token refresh failed. Please reconnect Google Calendar.', status: 401 };
  }
}

async function fetchMessageIds(accessToken: string, maxResults = 20): Promise<{ ids: string[]; historyId: string }> {
  const url = `${GMAIL_API}/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail messages.list failed: ${res.status}`);
  const data = await res.json();
  const ids = (data.messages || []).map((m: { id: string }) => m.id);
  // Get historyId from profile
  const profileRes = await fetch(`${GMAIL_API}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json();
  return { ids, historyId: profile.historyId || '' };
}

async function fetchNewMessageIdsByHistory(accessToken: string, startHistoryId: string): Promise<{ ids: string[]; historyId: string }> {
  const url = `${GMAIL_API}/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded&labelId=INBOX`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 404) {
      // History expired → fallback to full sync
      throw new Error('HISTORY_EXPIRED');
    }
    throw new Error(`Gmail history.list failed: ${res.status}`);
  }
  const data = await res.json();
  const messageIds = new Set<string>();
  for (const history of data.history || []) {
    for (const added of history.messagesAdded || []) {
      messageIds.add(added.message.id);
    }
  }
  // Get latest historyId from profile
  const profileRes = await fetch(`${GMAIL_API}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await profileRes.json();
  return { ids: Array.from(messageIds), historyId: profile.historyId || '' };
}

async function fetchFullMessages(accessToken: string, messageIds: string[]): Promise<GmailMessage[]> {
  const messages: GmailMessage[] = [];
  // Batch fetch (max 10 at a time to avoid rate limits)
  for (let i = 0; i < messageIds.length; i += 10) {
    const batch = messageIds.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (id) => {
        const url = `${GMAIL_API}/users/me/messages/${id}?format=full`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        return res.json();
      }),
    );
    for (const raw of results) {
      if (raw) {
        messages.push(parseGmailMessage(raw));
      }
    }
  }
  return messages;
}

// ─── Main Handler ────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get valid access token (auto-refresh if expired)
    const tokenResult = await getValidAccessToken(supabase, userId);
    if ('error' in tokenResult) {
      return new Response(
        JSON.stringify({ error: tokenResult.error, newMessages: [] }),
        { status: tokenResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { accessToken } = tokenResult;

    // Check for existing sync state
    const { data: syncState } = await supabase
      .from('gmail_sync_state')
      .select('history_id')
      .eq('user_id', userId)
      .single();

    let messageIds: string[] = [];
    let nextHistoryId = '';

    if (syncState?.history_id) {
      // Incremental sync
      try {
        const result = await fetchNewMessageIdsByHistory(accessToken, syncState.history_id);
        messageIds = result.ids;
        nextHistoryId = result.historyId;
      } catch (err) {
        if ((err as Error).message === 'HISTORY_EXPIRED') {
          // Fallback to full sync
          console.log('[gmail-fetch] History expired, doing full sync');
          const result = await fetchMessageIds(accessToken, 20);
          messageIds = result.ids;
          nextHistoryId = result.historyId;
        } else {
          throw err;
        }
      }
    } else {
      // Initial sync
      const result = await fetchMessageIds(accessToken, 20);
      messageIds = result.ids;
      nextHistoryId = result.historyId;
    }

    // Fetch full messages
    const newMessages = messageIds.length > 0 ? await fetchFullMessages(accessToken, messageIds) : [];

    // Save sync state
    await supabase
      .from('gmail_sync_state')
      .upsert({
        user_id: userId,
        history_id: nextHistoryId,
        last_sync_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return new Response(
      JSON.stringify({ newMessages, historyId: nextHistoryId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[gmail-fetch] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message, newMessages: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
