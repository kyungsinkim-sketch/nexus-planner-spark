/**
 * slack-api — Proxy for Slack Web API calls.
 *
 * Actions:
 *   - channels:     List channels the bot is in
 *   - messages:     Get messages from a channel (with pagination)
 *   - channel-info: Get channel details
 *   - send:         Send a message to a channel
 *   - status:       Check connection status
 *   - disconnect:   Remove Slack connection
 *
 * Request body: { action: string, userId: string, ...params }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authenticateOrFallback } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlackToken {
  id: string;
  user_id: string;
  access_token: string;
  user_access_token: string | null;
  team_id: string;
  team_name: string;
  team_icon: string;
}

async function getSlackToken(supabase: ReturnType<typeof createClient>, userId: string): Promise<SlackToken | null> {
  const { data } = await supabase
    .from('slack_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('sync_status', 'CONNECTED')
    .single();
  return data;
}

async function slackApi(token: string, method: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

async function slackPost(token: string, method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, userId: bodyUserId, ...params } = body;
    const { userId: jwtUserId } = await authenticateOrFallback(req);
    const userId = jwtUserId || bodyUserId;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ─── Status: check if Slack is connected ───
    if (action === 'status') {
      const token = await getSlackToken(supabase, userId);
      return new Response(
        JSON.stringify({
          connected: !!token,
          teamName: token?.team_name || null,
          teamIcon: token?.team_icon || null,
          teamId: token?.team_id || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // All other actions require a connected token
    const token = await getSlackToken(supabase, userId);
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Slack not connected', connected: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── Channels: list conversations ───
    if (action === 'channels') {
      const result = await slackApi(token.access_token, 'conversations.list', {
        types: 'public_channel,private_channel,mpim,im',
        exclude_archived: 'true',
        limit: params.limit || '100',
      });

      if (!result.ok) {
        return new Response(
          JSON.stringify({ error: `Slack API error: ${result.error}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // For IMs, resolve user names
      const channels = (result.channels as Record<string, unknown>[]) || [];
      const imChannels = channels.filter((c) => c.is_im);
      if (imChannels.length > 0) {
        const userIds = imChannels.map((c) => c.user as string).filter(Boolean);
        if (userIds.length > 0) {
          const usersResult = await slackApi(token.access_token, 'users.info', { user: userIds[0] });
          // Batch user lookups for IMs
          for (const im of imChannels) {
            try {
              const userInfo = await slackApi(token.access_token, 'users.info', { user: im.user as string });
              if (userInfo.ok) {
                const u = userInfo.user as Record<string, unknown>;
                (im as Record<string, unknown>).user_name = (u.real_name || u.name) as string;
                (im as Record<string, unknown>).user_avatar = ((u.profile as Record<string, unknown>)?.image_48) as string;
              }
            } catch { /* skip */ }
          }
        }
      }

      return new Response(
        JSON.stringify({ channels, teamName: token.team_name }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── Messages: get channel history ───
    if (action === 'messages') {
      const { channelId, cursor, limit: msgLimit } = params;
      if (!channelId) {
        return new Response(
          JSON.stringify({ error: 'channelId required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const apiParams: Record<string, string> = {
        channel: channelId,
        limit: msgLimit || '30',
      };
      if (cursor) apiParams.cursor = cursor;

      const result = await slackApi(token.access_token, 'conversations.history', apiParams);

      if (!result.ok) {
        // If not in channel, try to join first
        if (result.error === 'not_in_channel') {
          await slackPost(token.access_token, 'conversations.join', { channel: channelId });
          const retry = await slackApi(token.access_token, 'conversations.history', apiParams);
          if (retry.ok) {
            return new Response(
              JSON.stringify(retry),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
        }
        return new Response(
          JSON.stringify({ error: `Slack API error: ${result.error}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Resolve user names for messages
      const messages = (result.messages as Record<string, unknown>[]) || [];
      const uniqueUserIds = [...new Set(messages.map(m => m.user as string).filter(Boolean))];
      const userMap: Record<string, { name: string; avatar: string }> = {};

      // Batch user lookups (max 10 to avoid rate limits)
      for (const uid of uniqueUserIds.slice(0, 10)) {
        try {
          const userInfo = await slackApi(token.access_token, 'users.info', { user: uid });
          if (userInfo.ok) {
            const u = userInfo.user as Record<string, unknown>;
            const profile = u.profile as Record<string, unknown>;
            userMap[uid] = {
              name: (u.real_name || u.name) as string,
              avatar: (profile?.image_48 || '') as string,
            };
          }
        } catch { /* skip */ }
      }

      return new Response(
        JSON.stringify({
          messages,
          userMap,
          has_more: result.has_more,
          next_cursor: (result.response_metadata as Record<string, unknown>)?.next_cursor,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── Send: post a message ───
    if (action === 'send') {
      const { channelId, text, threadTs } = params;
      if (!channelId || !text) {
        return new Response(
          JSON.stringify({ error: 'channelId and text required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const msgBody: Record<string, unknown> = { channel: channelId, text };
      if (threadTs) msgBody.thread_ts = threadTs;

      // Use user token if available for sending as the user
      const sendToken = token.user_access_token || token.access_token;
      const result = await slackPost(sendToken, 'chat.postMessage', msgBody);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── Disconnect: remove Slack connection ───
    if (action === 'disconnect') {
      await supabase
        .from('slack_tokens')
        .update({ sync_status: 'DISCONNECTED' })
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('[SlackAPI] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
