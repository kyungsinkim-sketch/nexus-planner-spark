/**
 * slack-auth-callback — Slack OAuth 2.0 callback handler.
 *
 * Flow:
 *   1. Frontend redirects user to Slack OAuth consent screen
 *   2. User approves → Slack redirects with ?code=...
 *   3. Frontend captures code and calls this Edge Function
 *   4. Edge Function exchanges code for bot + user tokens
 *   5. Stores tokens in slack_tokens table
 *
 * Request body: { code: string, redirectUri: string, userId: string }
 * Response: { success: true, teamName: string } or { error: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authenticateOrFallback } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SLACK_CLIENT_ID = Deno.env.get('SLACK_CLIENT_ID') || '';
const SLACK_CLIENT_SECRET = Deno.env.get('SLACK_CLIENT_SECRET') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, redirectUri, userId: bodyUserId } = await req.json();
    const { userId: jwtUserId } = await authenticateOrFallback(req);
    const userId = jwtUserId || bodyUserId;

    if (!code || !redirectUri || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: code, redirectUri, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Slack OAuth not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Exchange authorization code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('[SlackAuth] Token exchange failed:', JSON.stringify(tokenData));
      return new Response(
        JSON.stringify({ error: `Slack OAuth failed: ${tokenData.error}`, detail: tokenData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Extract token data
    const {
      access_token,        // Bot token (xoxb-...)
      scope,
      bot_user_id,
      team,                // { id, name }
      authed_user,         // { id, scope, access_token, token_type }
      incoming_webhook,    // { channel, channel_id, configuration_url, url }
    } = tokenData;

    // 3. Get team info for icon
    let teamIcon = '';
    try {
      const teamInfoRes = await fetch('https://slack.com/api/team.info', {
        headers: { 'Authorization': `Bearer ${access_token}` },
      });
      const teamInfo = await teamInfoRes.json();
      if (teamInfo.ok) {
        teamIcon = teamInfo.team?.icon?.image_88 || teamInfo.team?.icon?.image_68 || '';
      }
    } catch { /* non-critical */ }

    // 4. Store in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error: upsertError } = await supabase
      .from('slack_tokens')
      .upsert({
        user_id: userId,
        access_token,
        user_access_token: authed_user?.access_token || null,
        bot_user_id: bot_user_id || null,
        team_id: team.id,
        team_name: team.name,
        team_icon: teamIcon,
        scope: scope || '',
        user_scope: authed_user?.scope || '',
        authed_user_id: authed_user?.id || null,
        incoming_webhook_url: incoming_webhook?.url || null,
        incoming_webhook_channel: incoming_webhook?.channel || null,
        sync_status: 'CONNECTED',
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,team_id',
      });

    if (upsertError) {
      console.error('[SlackAuth] DB upsert failed:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store Slack token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[SlackAuth] Connected user ${userId} to Slack workspace: ${team.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        teamName: team.name,
        teamId: team.id,
        teamIcon,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('[SlackAuth] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
