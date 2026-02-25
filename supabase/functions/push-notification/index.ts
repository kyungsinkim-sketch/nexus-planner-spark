/**
 * push-notification — Send push notifications via APNs HTTP/2.
 *
 * Triggered by pg_net from the push_notification_queue trigger.
 * Reads device tokens for the recipient and sends APNs pushes.
 *
 * Environment variables:
 *   APNS_KEY_ID        — Apple Push Notification Key ID
 *   APNS_TEAM_ID       — Apple Developer Team ID
 *   APNS_PRIVATE_KEY   — .p8 file contents (PKCS#8 PEM, ES256)
 *   APNS_ENVIRONMENT   — 'sandbox' or 'production'
 *
 * Request body (from pg_net trigger):
 *   { queueId, recipientUserId, title, body, notificationType, payload }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── APNs JWT Cache ─────────────────────────────────
// APNs accepts tokens valid for up to 60 minutes.
// We cache and refresh at 50 minutes.
let _cachedJWT: { token: string; expiresAt: number } | null = null;

async function getAPNsJWT(): Promise<string> {
  if (_cachedJWT && Date.now() < _cachedJWT.expiresAt) {
    return _cachedJWT.token;
  }

  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const privateKeyPem = Deno.env.get('APNS_PRIVATE_KEY');

  if (!keyId || !teamId || !privateKeyPem) {
    throw new Error('APNs credentials not configured (APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY)');
  }

  // The .p8 key is PKCS#8 PEM (ES256 / P-256)
  const privateKey = await jose.importPKCS8(privateKeyPem, 'ES256');

  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(privateKey);

  _cachedJWT = {
    token: jwt,
    expiresAt: Date.now() + 50 * 60 * 1000, // refresh at 50 min
  };

  return jwt;
}

// ─── Send APNs Push ─────────────────────────────────

interface APNsSendResult {
  success: boolean;
  tokenInvalid?: boolean;
  error?: string;
}

async function sendAPNsPush(
  deviceToken: string,
  title: string,
  body: string,
  payload: Record<string, unknown>,
  environment: string,
  bundleId: string,
): Promise<APNsSendResult> {
  const host = environment === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';

  const jwt = await getAPNsJWT();

  const apnsPayload = {
    aps: {
      alert: { title, body },
      badge: 1,
      sound: 'default',
      'mutable-content': 1,
      'thread-id': (payload.projectId as string) || 'default',
    },
    // Custom data passed to the app on notification tap
    ...payload,
  };

  const response = await fetch(`${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      'authorization': `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': '0',
      'content-type': 'application/json',
    },
    body: JSON.stringify(apnsPayload),
  });

  if (response.ok) {
    return { success: true };
  }

  const errorBody = await response.text();

  // 410 Gone = token is no longer valid (uninstalled / revoked)
  if (response.status === 410) {
    return { success: false, tokenInvalid: true, error: `410: ${errorBody}` };
  }

  // 400 BadDeviceToken
  if (response.status === 400 && errorBody.includes('BadDeviceToken')) {
    return { success: false, tokenInvalid: true, error: `400: ${errorBody}` };
  }

  return { success: false, error: `${response.status}: ${errorBody}` };
}

// ─── Main Handler ───────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      queueId,
      recipientUserId,
      title,
      body,
      notificationType,
      payload,
    } = await req.json();

    if (!recipientUserId || !title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 1. Get all active device tokens for this user
    const { data: tokens, error: tokenError } = await supabase
      .from('device_tokens')
      .select('*')
      .eq('user_id', recipientUserId)
      .eq('is_active', true);

    if (tokenError) {
      console.error('[push-notification] Token lookup error:', tokenError);
    }

    if (!tokens || tokens.length === 0) {
      // No tokens — mark queue as sent (nothing to do)
      if (queueId) {
        await supabase
          .from('push_notification_queue')
          .update({ status: 'sent', processed_at: new Date().toISOString(), error_message: 'no_active_tokens' })
          .eq('id', queueId);
      }
      return new Response(
        JSON.stringify({ sent: 0, reason: 'no_active_tokens' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const environment = Deno.env.get('APNS_ENVIRONMENT') || 'sandbox';
    let sent = 0;
    const errors: string[] = [];

    // 2. Send push to each active token
    for (const tokenRow of tokens) {
      if (tokenRow.platform === 'ios') {
        try {
          const result = await sendAPNsPush(
            tokenRow.token,
            title,
            body || '',
            payload || {},
            tokenRow.environment || environment,
            tokenRow.bundle_id || 'io.re-be.app',
          );

          if (result.success) {
            sent++;
            // Update last_used_at
            await supabase
              .from('device_tokens')
              .update({ last_used_at: new Date().toISOString() })
              .eq('id', tokenRow.id);
          } else {
            errors.push(result.error || 'unknown');
            // Deactivate invalid tokens
            if (result.tokenInvalid) {
              console.log(`[push-notification] Deactivating invalid token: ${tokenRow.id}`);
              await supabase
                .from('device_tokens')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', tokenRow.id);
            }
          }
        } catch (err) {
          errors.push(`Exception: ${(err as Error).message}`);
        }
      }
      // Future: handle 'android' (FCM), 'web' (Web Push) here
    }

    // 3. Update queue status
    if (queueId) {
      await supabase
        .from('push_notification_queue')
        .update({
          status: sent > 0 ? 'sent' : 'failed',
          error_message: errors.length > 0 ? errors.join('; ') : null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', queueId);
    }

    return new Response(
      JSON.stringify({ sent, errors: errors.length > 0 ? errors : undefined }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[push-notification] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
