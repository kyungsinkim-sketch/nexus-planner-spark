/**
 * gcal-auth-callback — Google Calendar OAuth callback handler.
 *
 * Flow:
 *   1. Frontend redirects user to Google OAuth consent screen
 *   2. Google redirects to the app with ?code=...&state=userId
 *   3. Frontend captures the code and calls this Edge Function
 *   4. Edge Function exchanges the code for tokens
 *   5. Stores tokens in google_calendar_tokens table
 *   6. Returns success + connected email
 *
 * Request body: { code: string, redirectUri: string, userId: string }
 * Response: { success: true, email: string } or { error: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  exchangeCodeForTokens,
  getGoogleUserEmail,
} from '../_shared/gcal-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, redirectUri, userId } = await req.json();

    if (!code || !redirectUri || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: code, redirectUri, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // 2. Get the connected Google account email
    const email = await getGoogleUserEmail(tokens.access_token);

    // 3. Store tokens in Supabase (using service role to bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert — if user already connected, update tokens
    const { error: upsertError } = await supabase
      .from('google_calendar_tokens')
      .upsert(
        {
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type || 'Bearer',
          expires_at: expiresAt.toISOString(),
          scope: tokens.scope,
          connected_email: email,
          sync_status: 'CONNECTED',
          sync_error: null,
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      console.error('Failed to store tokens:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Initialize sync token record
    await supabase
      .from('google_calendar_sync_tokens')
      .upsert(
        {
          user_id: userId,
          sync_token: null,
          page_token: null,
          full_sync_completed: false,
        },
        { onConflict: 'user_id' },
      );

    return new Response(
      JSON.stringify({ success: true, email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
