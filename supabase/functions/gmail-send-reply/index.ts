/**
 * gmail-send-reply — Send a reply to a Gmail thread.
 *
 * Constructs a proper MIME message with In-Reply-To and References headers
 * to ensure the reply appears in the correct thread.
 *
 * Request body: { userId, threadId, messageId, body, to, subject }
 * Response: { success: true } or { error: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ensureValidToken, type GoogleTokenRow } from '../_shared/gcal-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

/** RFC 2047 B-encoding for non-ASCII header values (Korean, etc.) */
function encodeRfc2047(str: string): string {
  // Check if all ASCII — if so, no encoding needed
  if (/^[\x20-\x7E]*$/.test(str)) return str;
  // UTF-8 → bytes → base64
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of utf8Bytes) binary += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

/** Build raw base64url-encoded MIME message for Gmail API */
function encodeMimeMessage(params: {
  to: string;
  subject: string;
  body: string;
  inReplyTo: string;
  threadId: string;
}): string {
  const mimeMessage = [
    `To: ${params.to}`,
    `Subject: ${encodeRfc2047(params.subject)}`,
    `In-Reply-To: <${params.inReplyTo}>`,
    `References: <${params.inReplyTo}>`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    params.body,
  ].join('\r\n');

  // UTF-8 encode → base64url for Gmail API raw field
  const utf8Bytes = new TextEncoder().encode(mimeMessage);
  let binary = '';
  for (const b of utf8Bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, threadId, messageId, body, to, subject } = await req.json();

    if (!userId || !threadId || !body || !to) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get access token with auto-refresh
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: tokenRow } = await supabase
      .from('google_calendar_tokens')
      .select('id, user_id, access_token, refresh_token, token_type, expires_at, scope, connected_email, calendar_id, auto_sync, last_sync_at, sync_status, sync_error')
      .eq('user_id', userId)
      .single();

    if (!tokenRow?.access_token) {
      return new Response(
        JSON.stringify({ error: 'Gmail not connected' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Ensure token is valid (auto-refresh if expired)
    let accessToken: string;
    try {
      accessToken = await ensureValidToken(supabase, tokenRow as GoogleTokenRow);
    } catch (err) {
      console.error('[gmail-send-reply] Token refresh failed:', err);
      return new Response(
        JSON.stringify({ error: 'Token refresh failed. Please reconnect Google Calendar.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Encode MIME message
    const raw = encodeMimeMessage({
      to,
      subject: subject || 'Re:',
      body,
      inReplyTo: messageId || '',
      threadId,
    });

    // Send via Gmail API
    const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw,
        threadId,
      }),
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('[gmail-send-reply] Gmail API error:', errData);
      return new Response(
        JSON.stringify({ error: `Gmail send failed: ${res.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[gmail-send-reply] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
