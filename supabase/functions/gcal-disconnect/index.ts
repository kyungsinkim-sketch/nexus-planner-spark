/**
 * gcal-disconnect — Disconnect Google Calendar integration.
 *
 * Flow:
 *   1. Revoke the Google OAuth token
 *   2. Delete the token row from google_calendar_tokens
 *   3. Delete the sync token row
 *   4. Optionally delete all Google-sourced events
 *
 * Request body: { userId: string, deleteGoogleEvents?: boolean }
 * Response: { success: true }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, deleteGoogleEvents = false } = await req.json();

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

    // 1. Load the token to revoke it
    const { data: tokenRow } = await supabase
      .from('google_calendar_tokens')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .single();

    if (tokenRow) {
      // 2. Revoke the Google token (best effort)
      try {
        const tokenToRevoke = tokenRow.access_token || tokenRow.refresh_token;
        if (tokenToRevoke) {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokenToRevoke)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
        }
      } catch (err) {
        console.warn('[gcal-disconnect] Token revocation failed (non-fatal):', err);
      }
    }

    // 3. Delete tokens
    await supabase.from('google_calendar_tokens').delete().eq('user_id', userId);
    await supabase.from('google_calendar_sync_tokens').delete().eq('user_id', userId);

    // 4. Optionally delete all Google-sourced events
    if (deleteGoogleEvents) {
      await supabase
        .from('calendar_events')
        .delete()
        .eq('owner_id', userId)
        .eq('source', 'GOOGLE');
    } else {
      // Just clear the google_event_id so they become standalone PAULUS events
      await supabase
        .from('calendar_events')
        .update({ source: 'PAULUS', google_event_id: null })
        .eq('owner_id', userId)
        .eq('source', 'GOOGLE');
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[gcal-disconnect] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
