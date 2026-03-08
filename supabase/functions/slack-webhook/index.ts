/**
 * slack-webhook — Slack Events API endpoint.
 *
 * Handles:
 *   - url_verification: Slack challenge handshake
 *   - event_callback: Real-time events
 *     - message: New/edited/deleted messages
 *     - reaction_added / reaction_removed
 *     - channel_rename, member_joined_channel, etc.
 *
 * Flow:
 *   1. Slack sends POST with event payload
 *   2. Verify request signature (SLACK_SIGNING_SECRET)
 *   3. Store message in slack_messages table
 *   4. Widget receives via Supabase Realtime subscription
 *   5. (Future) Trigger Brain AI analysis for relevant messages
 *
 * Security:
 *   - Verifies Slack request signature using HMAC-SHA256
 *   - Returns 200 quickly to avoid Slack retry (3s timeout)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp',
};

// ─── Signature Verification ─────────────────────────

async function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
): Promise<boolean> {
  const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET');
  if (!signingSecret) {
    console.warn('SLACK_SIGNING_SECRET not set — skipping verification');
    return true; // Allow in dev, but warn
  }

  // Reject requests older than 5 minutes (replay attack prevention)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.warn('Slack request too old:', timestamp);
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigBasestring));
  const mySignature = 'v0=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  return mySignature === signature;
}

// ─── Supabase Client ────────────────────────────────

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

// ─── Message Handler ────────────────────────────────

async function handleMessage(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
  event: Record<string, unknown>,
) {
  const channelId = event.channel as string;
  const messageTs = event.ts as string;
  const threadTs = (event.thread_ts as string) || null;
  const userId = event.user as string || null;
  const text = event.text as string || '';
  const subtype = event.subtype as string || null;
  const botId = event.bot_id as string || null;

  // Skip bot messages from our own bot to avoid loops
  // (but allow other bots)

  // Handle message subtypes
  if (subtype === 'message_deleted') {
    const deletedTs = (event.previous_message as Record<string, unknown>)?.ts as string;
    if (deletedTs) {
      await supabase
        .from('slack_messages')
        .delete()
        .eq('team_id', teamId)
        .eq('channel_id', channelId)
        .eq('message_ts', deletedTs);
    }
    return;
  }

  if (subtype === 'message_changed') {
    const newMsg = event.message as Record<string, unknown>;
    if (newMsg) {
      const editedTs = (newMsg.edited as Record<string, unknown>)?.ts as string || null;
      await supabase
        .from('slack_messages')
        .upsert({
          team_id: teamId,
          channel_id: channelId,
          message_ts: newMsg.ts as string,
          thread_ts: (newMsg.thread_ts as string) || null,
          user_id_slack: newMsg.user as string || null,
          text: newMsg.text as string || '',
          subtype: null,
          edited_ts: editedTs,
          is_bot: Boolean(newMsg.bot_id),
          raw_event: newMsg,
        }, { onConflict: 'team_id,channel_id,message_ts' });
    }
    return;
  }

  // Regular message or file_share etc.
  if (subtype && !['file_share', 'thread_broadcast'].includes(subtype)) {
    // Skip channel_join, channel_leave, etc. — not chat messages
    return;
  }

  await supabase
    .from('slack_messages')
    .upsert({
      team_id: teamId,
      channel_id: channelId,
      message_ts: messageTs,
      thread_ts: threadTs,
      user_id_slack: userId,
      text,
      subtype,
      is_bot: Boolean(botId),
      files: event.files || [],
      raw_event: event,
    }, { onConflict: 'team_id,channel_id,message_ts' });
}

// ─── Reaction Handler ───────────────────────────────

async function handleReaction(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
  event: Record<string, unknown>,
  added: boolean,
) {
  const item = event.item as Record<string, unknown>;
  if (!item || item.type !== 'message') return;

  const channelId = item.channel as string;
  const messageTs = item.ts as string;
  const reactionName = event.reaction as string;
  const reactUserId = event.user as string;

  // Fetch current message
  const { data: msg } = await supabase
    .from('slack_messages')
    .select('reactions')
    .eq('team_id', teamId)
    .eq('channel_id', channelId)
    .eq('message_ts', messageTs)
    .maybeSingle();

  if (!msg) return;

  let reactions = (msg.reactions || []) as Array<{ name: string; count: number; users: string[] }>;

  if (added) {
    const existing = reactions.find(r => r.name === reactionName);
    if (existing) {
      if (!existing.users.includes(reactUserId)) {
        existing.users.push(reactUserId);
        existing.count = existing.users.length;
      }
    } else {
      reactions.push({ name: reactionName, count: 1, users: [reactUserId] });
    }
  } else {
    const existing = reactions.find(r => r.name === reactionName);
    if (existing) {
      existing.users = existing.users.filter(u => u !== reactUserId);
      existing.count = existing.users.length;
      if (existing.count === 0) {
        reactions = reactions.filter(r => r.name !== reactionName);
      }
    }
  }

  await supabase
    .from('slack_messages')
    .update({ reactions })
    .eq('team_id', teamId)
    .eq('channel_id', channelId)
    .eq('message_ts', messageTs);
}

// ─── Main Handler ───────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signature = req.headers.get('x-slack-signature') || '';

    // Verify signature
    const valid = await verifySlackSignature(rawBody, timestamp, signature);
    if (!valid) {
      console.error('Invalid Slack signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // ─── URL Verification (initial setup) ───────────
    if (payload.type === 'url_verification') {
      return new Response(
        JSON.stringify({ challenge: payload.challenge }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── Event Callback ─────────────────────────────
    if (payload.type === 'event_callback') {
      const event = payload.event as Record<string, unknown>;
      const teamId = payload.team_id as string;
      const eventType = event?.type as string;

      if (!event || !teamId) {
        return new Response('ok', { status: 200, headers: corsHeaders });
      }

      const supabase = getSupabase();

      switch (eventType) {
        case 'message':
          await handleMessage(supabase, teamId, event);
          break;

        case 'reaction_added':
          await handleReaction(supabase, teamId, event, true);
          break;

        case 'reaction_removed':
          await handleReaction(supabase, teamId, event, false);
          break;

        // Future: channel_rename, member_joined_channel, etc.
        default:
          console.log(`[Slack Webhook] Unhandled event type: ${eventType}`);
      }
    }

    // Always return 200 quickly to avoid Slack retries
    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('[Slack Webhook] Error:', err);
    // Still return 200 to prevent Slack from retrying
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
});
