/**
 * slackService.ts — Frontend service for Slack integration.
 *
 * Handles OAuth flow, channel listing, message fetching, and sending.
 * All API calls go through the slack-api Edge Function proxy.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ─── Config ─────────────────────────────────────────

const SLACK_CLIENT_ID = import.meta.env.VITE_SLACK_CLIENT_ID || '';

// Slack OAuth scopes
const BOT_SCOPES = [
  'channels:history',
  'channels:read',
  'channels:join',
  'chat:write',
  'groups:history',
  'groups:read',
  'im:history',
  'im:read',
  'mpim:history',
  'mpim:read',
  'team:read',
  'users:read',
  'users:read.email',
].join(',');

const USER_SCOPES = [
  'chat:write',
  'channels:history',
  'groups:history',
  'im:history',
].join(',');

// ─── Types ──────────────────────────────────────────

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_member: boolean;
  topic?: { value: string };
  purpose?: { value: string };
  num_members?: number;
  user?: string;          // For IMs — the other user's Slack ID
  user_name?: string;     // Resolved user name for IMs
  user_avatar?: string;   // Resolved user avatar for IMs
}

export interface SlackMessage {
  type: string;
  user: string;
  text: string;
  ts: string;             // Slack timestamp (unique message ID)
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{ name: string; count: number; users: string[] }>;
  files?: Array<{ name: string; url_private: string; mimetype: string }>;
  attachments?: Array<{ text: string; title: string }>;
}

export interface SlackUserInfo {
  name: string;
  avatar: string;
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
  teamIcon: string | null;
  teamId: string | null;
}

// ─── OAuth ──────────────────────────────────────────

/**
 * Get Slack OAuth authorization URL.
 * User should be redirected to this URL to start the OAuth flow.
 */
export function getSlackAuthUrl(redirectUri: string, state: string): string {
  if (!SLACK_CLIENT_ID) {
    console.warn('[Slack] VITE_SLACK_CLIENT_ID not set');
    return '';
  }

  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: BOT_SCOPES,
    user_scope: USER_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Exchange OAuth code for tokens via Edge Function.
 */
export async function exchangeSlackCode(
  code: string,
  redirectUri: string,
  userId: string,
): Promise<{ success: boolean; teamName?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  const { data, error } = await supabase.functions.invoke('slack-auth-callback', {
    body: { code, redirectUri, userId },
  });

  if (error) return { success: false, error: error.message };
  return data;
}

// ─── API Calls ──────────────────────────────────────

async function slackApiCall(action: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');

  const { data, error } = await supabase.functions.invoke('slack-api', {
    body: { action, ...params },
  });

  if (error) throw error;
  return data;
}

/**
 * Check Slack connection status.
 */
export async function getSlackStatus(userId: string): Promise<SlackStatus> {
  const data = await slackApiCall('status', { userId });
  return data as SlackStatus;
}

/**
 * List Slack channels the bot has access to.
 */
export async function getSlackChannels(userId: string): Promise<{
  channels: SlackChannel[];
  teamName: string;
}> {
  const data = await slackApiCall('channels', { userId });
  return data as { channels: SlackChannel[]; teamName: string };
}

/**
 * Get messages from a Slack channel.
 */
export async function getSlackMessages(
  userId: string,
  channelId: string,
  cursor?: string,
  limit?: number,
): Promise<{
  messages: SlackMessage[];
  userMap: Record<string, SlackUserInfo>;
  has_more: boolean;
  next_cursor?: string;
}> {
  const data = await slackApiCall('messages', { userId, channelId, cursor, limit });
  return data as {
    messages: SlackMessage[];
    userMap: Record<string, SlackUserInfo>;
    has_more: boolean;
    next_cursor?: string;
  };
}

/**
 * Send a message to a Slack channel.
 */
export async function sendSlackMessage(
  userId: string,
  channelId: string,
  text: string,
  threadTs?: string,
): Promise<{ ok: boolean; error?: string }> {
  const data = await slackApiCall('send', { userId, channelId, text, threadTs });
  return data as { ok: boolean; error?: string };
}

/**
 * Disconnect Slack integration.
 */
export async function disconnectSlack(userId: string): Promise<void> {
  await slackApiCall('disconnect', { userId });
}

/**
 * Format Slack message text (basic mrkdwn → readable text).
 * Converts <@U123> mentions, <URL|label> links, etc.
 */
export function formatSlackText(
  text: string,
  userMap?: Record<string, SlackUserInfo>,
): string {
  if (!text) return '';

  return text
    // User mentions: <@U123> → @Name
    .replace(/<@(U[A-Z0-9]+)>/g, (_match, userId) => {
      const user = userMap?.[userId];
      return user ? `@${user.name}` : `@unknown`;
    })
    // Channel mentions: <#C123|channel-name> → #channel-name
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    // URLs: <URL|label> → label, <URL> → URL
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    // Bold: *text* → text (keep simple for now)
    // Italic: _text_ → text
    // Strike: ~text~ → text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
