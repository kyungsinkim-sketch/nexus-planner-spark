/**
 * notion-auth-callback — Notion OAuth callback handler.
 *
 * Flow:
 *   1. Frontend redirects user to Notion OAuth consent screen
 *   2. Notion redirects to the app with ?code=...&state=userId
 *   3. Frontend captures the code and calls this Edge Function
 *   4. Edge Function exchanges the code for an access token
 *   5. Stores token in notion_tokens table
 *   6. Returns success + workspace info
 *
 * Notion OAuth uses Basic Auth (client_id:client_secret) for token exchange.
 * Unlike Google, Notion tokens don't expire — they persist until revoked.
 *
 * Request body: { code: string, redirectUri: string, userId: string }
 * Response: { success: true, workspaceName: string, email: string } or { error: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { exchangeCodeForToken } from '../_shared/notion-client.ts';

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

    // 1. Exchange authorization code for access token
    const tokenData = await exchangeCodeForToken(code, redirectUri);

    // 2. Extract user email from owner
    const email = tokenData.owner?.user?.person?.email || '';

    // 3. Store token in Supabase (using service role to bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Upsert — if user already connected, update token
    const { error: upsertError } = await supabase
      .from('notion_tokens')
      .upsert(
        {
          user_id: userId,
          access_token: tokenData.access_token,
          bot_id: tokenData.bot_id,
          workspace_id: tokenData.workspace_id,
          workspace_name: tokenData.workspace_name,
          workspace_icon: tokenData.workspace_icon,
          connected_email: email,
          token_type: tokenData.token_type || 'bearer',
          sync_status: 'CONNECTED',
          sync_error: null,
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      console.error('Failed to store Notion token:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store Notion token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        workspaceName: tokenData.workspace_name,
        workspaceIcon: tokenData.workspace_icon,
        email,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Notion OAuth callback error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
