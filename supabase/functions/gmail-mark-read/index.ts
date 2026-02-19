/**
 * gmail-mark-read — Mark a Gmail message as read (remove UNREAD label).
 *
 * Uses Gmail API modify endpoint to remove the UNREAD label.
 * Returns 200 for ALL cases (success or failure) to avoid FunctionsHttpError.
 *
 * Request body: { userId, messageId }
 * Response: { success: true } or { success: false, error: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ensureValidToken, type GoogleTokenRow } from '../_shared/gcal-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

function jsonResponse(body: Record<string, unknown>) {
  return new Response(
    JSON.stringify(body),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, messageId } = await req.json();

    if (!userId || !messageId) {
      return jsonResponse({ success: false, error: 'Missing required fields (userId, messageId)' });
    }

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
      return jsonResponse({ success: false, error: 'Gmail not connected.' });
    }

    let accessToken: string;
    try {
      accessToken = await ensureValidToken(supabase, tokenRow as GoogleTokenRow);
    } catch (err) {
      console.warn('[gmail-mark-read] Token refresh failed:', err);
      return jsonResponse({ success: false, error: 'Token refresh failed.' });
    }

    // Remove UNREAD label via Gmail API modify
    const res = await fetch(`${GMAIL_API}/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    });

    if (!res.ok) {
      const errData = await res.text();
      console.warn('[gmail-mark-read] Gmail API error:', res.status, errData);
      return jsonResponse({
        success: false,
        error: `Gmail API ${res.status}: insufficient permission.`,
      });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.warn('[gmail-mark-read] Error:', err);
    return jsonResponse({ success: false, error: (err as Error).message });
  }
});
