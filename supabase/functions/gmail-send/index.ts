/**
 * gmail-send — Send a new email via Gmail API.
 *
 * Constructs a MIME message and sends it as a brand-new email (not a reply).
 * Always returns HTTP 200 with { success: true/false } to avoid FunctionsHttpError.
 *
 * Request body: { userId, to, subject, body }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ensureValidToken, type GoogleTokenRow } from '../_shared/gcal-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

/** Always-200 JSON response helper */
function jsonResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Encode a plain-text email into a base64url MIME message */
function encodeMimeMessage(params: {
  to: string;
  subject: string;
  body: string;
}): string {
  const mimeMessage = [
    `To: ${params.to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    params.body,
  ].join('\r\n');

  // Base64url encode the entire message
  return btoa(unescape(encodeURIComponent(mimeMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, to, subject, body } = await req.json();

    if (!userId || !to || !body) {
      return jsonResponse({ success: false, error: 'Missing required fields (userId, to, body)' });
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get Google OAuth token
    const { data: tokenRow } = await supabase
      .from('google_calendar_tokens')
      .select('id, user_id, access_token, refresh_token, token_type, expires_at, scope, connected_email, calendar_id, auto_sync, last_sync_at, sync_status, sync_error')
      .eq('user_id', userId)
      .single();

    if (!tokenRow?.access_token) {
      return jsonResponse({ success: false, error: 'Gmail not connected. Please connect Google Calendar first.' });
    }

    // Ensure token is valid (auto-refresh if expired)
    let accessToken: string;
    try {
      accessToken = await ensureValidToken(supabase, tokenRow as GoogleTokenRow);
    } catch (err) {
      console.error('[gmail-send] Token refresh failed:', err);
      return jsonResponse({ success: false, error: 'Token refresh failed. Please reconnect Google Calendar.' });
    }

    // Encode MIME message (no In-Reply-To/References since this is a new email)
    const raw = encodeMimeMessage({
      to,
      subject: subject || '(제목 없음)',
      body,
    });

    // Send via Gmail API — no threadId for new emails
    const res = await fetch(`${GMAIL_API}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('[gmail-send] Gmail API error:', res.status, errData);
      return jsonResponse({ success: false, error: `Gmail API ${res.status}: ${errData.slice(0, 200)}` });
    }

    const result = await res.json();
    console.log('[gmail-send] Email sent successfully, messageId:', result.id);

    return jsonResponse({ success: true, messageId: result.id });
  } catch (err) {
    console.error('[gmail-send] Error:', err);
    return jsonResponse({ success: false, error: (err as Error).message });
  }
});
