/**
 * gmail-trash — Move a Gmail message to trash.
 *
 * Request body: { userId, messageId }
 * Response: { success: true } or { error: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ensureValidToken, type GoogleTokenRow } from '../_shared/gcal-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, messageId } = await req.json();

    if (!userId || !messageId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields (userId, messageId)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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
      return new Response(
        JSON.stringify({ error: 'Gmail not connected' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let accessToken: string;
    try {
      accessToken = await ensureValidToken(supabase, tokenRow as GoogleTokenRow);
    } catch (err) {
      console.error('[gmail-trash] Token refresh failed:', err);
      return new Response(
        JSON.stringify({ error: 'Token refresh failed. Please reconnect Google Calendar.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Move message to trash via Gmail API
    const res = await fetch(`${GMAIL_API}/users/me/messages/${messageId}/trash`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error('[gmail-trash] Gmail API error:', errData);
      return new Response(
        JSON.stringify({ error: `Gmail trash failed: ${res.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[gmail-trash] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
