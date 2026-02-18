/**
 * Google Calendar Service — Frontend integration for Google Calendar OAuth and sync.
 *
 * Handles:
 * - OAuth consent URL generation
 * - OAuth callback processing (via Edge Function)
 * - Sync trigger (via Edge Function)
 * - Disconnect (via Edge Function)
 * - Connection status check
 * - Delete Google event when local event is deleted
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { GoogleCalendarSettings, GoogleCalendarSyncStatus } from '@/types/core';

// ─── Configuration ──────────────────────────────────

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

/**
 * Check if Google Calendar OAuth is configured
 */
export function isGoogleCalendarConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID);
}

/**
 * Get the OAuth redirect URI (current origin + /settings path)
 */
function getRedirectUri(): string {
  return `${window.location.origin}/settings`;
}

// ─── OAuth Flow ─────────────────────────────────────

/**
 * Generate the Google OAuth consent URL and redirect the user
 */
export function startGoogleOAuth(userId: string): void {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Calendar not configured. Set VITE_GOOGLE_CLIENT_ID in .env');
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh_token
    state: userId, // Pass userId in state for the callback
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Handle the OAuth callback by exchanging the authorization code for tokens.
 * This is called when the user is redirected back from Google.
 */
export async function handleOAuthCallback(
  code: string,
  userId: string,
): Promise<{ success: boolean; email?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('gcal-auth-callback', {
      body: {
        code,
        redirectUri: getRedirectUri(),
        userId,
      },
    });

    if (error) {
      console.error('[GoogleCalendar] OAuth callback error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true, email: data?.email };
  } catch (err) {
    console.error('[GoogleCalendar] OAuth callback exception:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ─── Sync ───────────────────────────────────────────

/**
 * Trigger a bidirectional sync between Re-Be and Google Calendar.
 */
export async function syncGoogleCalendar(
  userId: string,
): Promise<{ success: boolean; imported?: number; exported?: number; deleted?: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('gcal-sync', {
      body: { userId },
    });

    if (error) {
      console.error('[GoogleCalendar] Sync error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      imported: data?.imported || 0,
      exported: data?.exported || 0,
      deleted: data?.deleted || 0,
    };
  } catch (err) {
    console.error('[GoogleCalendar] Sync exception:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ─── Disconnect ─────────────────────────────────────

/**
 * Disconnect Google Calendar integration.
 */
export async function disconnectGoogleCalendar(
  userId: string,
  deleteGoogleEvents: boolean = false,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('gcal-disconnect', {
      body: { userId, deleteGoogleEvents },
    });

    if (error) {
      console.error('[GoogleCalendar] Disconnect error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err) {
    console.error('[GoogleCalendar] Disconnect exception:', err);
    return { success: false, error: (err as Error).message };
  }
}

// ─── Connection Status ──────────────────────────────

/**
 * Check if the user has Google Calendar connected and get their settings.
 */
export async function getGoogleCalendarStatus(
  userId: string,
): Promise<GoogleCalendarSettings> {
  const defaultSettings: GoogleCalendarSettings = {
    isConnected: false,
    syncStatus: 'DISCONNECTED',
    autoSync: true,
  };

  if (!isSupabaseConfigured()) {
    return defaultSettings;
  }

  try {
    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('connected_email, auto_sync, last_sync_at, sync_status')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return defaultSettings;
    }

    return {
      isConnected: true,
      syncStatus: (data.sync_status || 'CONNECTED') as GoogleCalendarSyncStatus,
      lastSyncAt: data.last_sync_at || undefined,
      connectedEmail: data.connected_email || undefined,
      autoSync: data.auto_sync ?? true,
    };
  } catch (err) {
    console.error('[GoogleCalendar] Status check error:', err);
    return defaultSettings;
  }
}

/**
 * Update auto-sync setting
 */
export async function updateAutoSync(
  userId: string,
  autoSync: boolean,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  await supabase
    .from('google_calendar_tokens')
    .update({ auto_sync: autoSync })
    .eq('user_id', userId);
}

// ─── Event Deletion Sync ────────────────────────────

/**
 * When a Google-sourced event is deleted locally, also delete from Google Calendar.
 * This is called from the event deletion flow when the event has source === 'GOOGLE'.
 */
export async function deleteGoogleCalendarEvent(
  userId: string,
  googleEventId: string,
): Promise<void> {
  if (!isSupabaseConfigured() || !googleEventId) return;

  try {
    // Load token
    const { data: tokenRow } = await supabase
      .from('google_calendar_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .single();

    if (!tokenRow?.access_token) return;

    // Call Google Calendar API directly from the client
    // (Alternatively, could use an Edge Function, but this is simpler for single deletions)
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenRow.access_token}` },
      },
    );

    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.warn('[GoogleCalendar] Failed to delete Google event:', res.status);
    }
  } catch (err) {
    console.warn('[GoogleCalendar] Event deletion sync failed (non-fatal):', err);
  }
}
