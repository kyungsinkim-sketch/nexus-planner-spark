/**
 * LiveKit Access Token generator using jose (JWT).
 * Lightweight replacement for livekit-server-sdk in Deno Edge Functions.
 */

import { SignJWT } from 'https://deno.land/x/jose@v5.2.2/index.ts';

interface TokenGrant {
  room?: string;
  roomJoin?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  roomRecord?: boolean;
}

interface TokenOptions {
  identity: string;
  name?: string;
  ttlSeconds?: number;
  grant: TokenGrant;
}

export async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  options: TokenOptions,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (options.ttlSeconds || 86400); // default 24h

  const videoGrant: Record<string, unknown> = {};
  if (options.grant.room) videoGrant.room = options.grant.room;
  if (options.grant.roomJoin) videoGrant.roomJoin = true;
  if (options.grant.canPublish) videoGrant.canPublish = true;
  if (options.grant.canSubscribe) videoGrant.canSubscribe = true;
  if (options.grant.roomRecord) videoGrant.roomRecord = true;

  const secret = new TextEncoder().encode(apiSecret);

  const token = await new SignJWT({
    sub: options.identity,
    name: options.name || options.identity,
    video: videoGrant,
    iss: apiKey,
    nbf: now,
    exp,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .sign(secret);

  return token;
}
