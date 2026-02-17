/**
 * Google Calendar API client utility for Edge Functions.
 * Handles token refresh, API calls, and event transformation.
 */

// ─── Types ──────────────────────────────────────────

export interface GoogleTokenRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  scope: string | null;
  connected_email: string | null;
  calendar_id: string;
  auto_sync: boolean;
  last_sync_at: string | null;
  sync_status: string;
  sync_error: string | null;
}

export interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string; // 'confirmed' | 'tentative' | 'cancelled'
  attendees?: Array<{ email: string; responseStatus?: string }>;
  htmlLink?: string;
  updated?: string;
  created?: string;
}

export interface GoogleEventsListResponse {
  kind: string;
  summary: string;
  items?: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

// ─── Environment ────────────────────────────────────

export function getGoogleConfig() {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
  }

  return { clientId, clientSecret, redirectUri: redirectUri || '' };
}

// ─── Token Management ───────────────────────────────

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const { clientId, clientSecret } = getGoogleConfig();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${err}`);
  }

  return await res.json() as TokenResponse;
}

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getGoogleConfig();

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${err}`);
  }

  return await res.json() as TokenResponse;
}

/**
 * Get the connected Google account's email
 */
export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to get user info: ${res.status}`);
  }

  const data = await res.json();
  return data.email || '';
}

// ─── Calendar API ───────────────────────────────────

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Ensure token is valid, refresh if expired
 */
export async function ensureValidToken(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  tokenRow: GoogleTokenRow,
): Promise<string> {
  const expiresAt = new Date(tokenRow.expires_at);
  const now = new Date();

  // If token expires in less than 5 minutes, refresh
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    try {
      const newTokens = await refreshAccessToken(tokenRow.refresh_token);

      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);

      await supabase
        .from('google_calendar_tokens')
        .update({
          access_token: newTokens.access_token,
          expires_at: newExpiresAt.toISOString(),
          ...(newTokens.refresh_token ? { refresh_token: newTokens.refresh_token } : {}),
        })
        .eq('id', tokenRow.id);

      return newTokens.access_token;
    } catch (err) {
      // Mark token as error state
      await supabase
        .from('google_calendar_tokens')
        .update({ sync_status: 'ERROR', sync_error: (err as Error).message })
        .eq('id', tokenRow.id);
      throw err;
    }
  }

  return tokenRow.access_token;
}

/**
 * List events from Google Calendar with incremental sync support
 */
export async function listGoogleEvents(
  accessToken: string,
  calendarId: string = 'primary',
  syncToken?: string | null,
  pageToken?: string | null,
): Promise<GoogleEventsListResponse> {
  const params = new URLSearchParams({
    maxResults: '250',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (syncToken) {
    params.set('syncToken', syncToken);
  } else {
    // Initial sync: fetch events from 1 year ago to 1 year in the future
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - 1);
    params.set('timeMin', timeMin.toISOString());

    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 1);
    params.set('timeMax', timeMax.toISOString());
  }

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const res = await fetch(
    `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (res.status === 410) {
    // Sync token is invalid — need full re-sync
    throw new Error('SYNC_TOKEN_INVALID');
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar API error: ${res.status} ${err}`);
  }

  return await res.json() as GoogleEventsListResponse;
}

/**
 * Create an event in Google Calendar
 */
export async function createGoogleEvent(
  accessToken: string,
  event: {
    summary: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    location?: string;
    description?: string;
  },
  calendarId: string = 'primary',
): Promise<GoogleEvent> {
  const res = await fetch(
    `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Google event: ${res.status} ${err}`);
  }

  return await res.json() as GoogleEvent;
}

/**
 * Update an event in Google Calendar
 */
export async function updateGoogleEvent(
  accessToken: string,
  eventId: string,
  updates: {
    summary?: string;
    start?: { dateTime: string; timeZone?: string };
    end?: { dateTime: string; timeZone?: string };
    location?: string;
    description?: string;
  },
  calendarId: string = 'primary',
): Promise<GoogleEvent> {
  const res = await fetch(
    `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update Google event: ${res.status} ${err}`);
  }

  return await res.json() as GoogleEvent;
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleEvent(
  accessToken: string,
  eventId: string,
  calendarId: string = 'primary',
): Promise<void> {
  const res = await fetch(
    `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  // 404 or 410 means already deleted — that's fine
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.text();
    throw new Error(`Failed to delete Google event: ${res.status} ${err}`);
  }
}

// ─── Event Transformation ───────────────────────────

/**
 * Convert a Google Calendar event to our CalendarEvent insert format
 */
export function googleEventToDbInsert(
  googleEvent: GoogleEvent,
  ownerId: string,
): Record<string, unknown> | null {
  // Skip cancelled events
  if (googleEvent.status === 'cancelled') return null;

  // For timed events, use dateTime directly.
  // For all-day events, Google uses exclusive end dates (e.g., 1-day event on Feb 17
  // has start.date="2026-02-17", end.date="2026-02-18").
  // We subtract 1 day from end.date to get the inclusive last day,
  // then store with Asia/Seoul timezone offset (+09:00).
  const isAllDay = !googleEvent.start?.dateTime && !!googleEvent.start?.date;

  let startAt: string | null = null;
  let endAt: string | null = null;

  if (isAllDay) {
    if (googleEvent.start?.date) {
      startAt = `${googleEvent.start.date}T00:00:00+09:00`;
    }
    if (googleEvent.end?.date) {
      // Subtract 1 day from exclusive end date to get inclusive end
      const endDate = new Date(googleEvent.end.date + 'T00:00:00+09:00');
      endDate.setDate(endDate.getDate() - 1);
      const yyyy = endDate.getFullYear();
      const mm = String(endDate.getMonth() + 1).padStart(2, '0');
      const dd = String(endDate.getDate()).padStart(2, '0');
      endAt = `${yyyy}-${mm}-${dd}T23:59:59+09:00`;
    }
  } else {
    startAt = googleEvent.start?.dateTime || null;
    endAt = googleEvent.end?.dateTime || null;
  }

  if (!startAt || !endAt) return null;

  return {
    title: googleEvent.summary || '(No title)',
    type: 'MEETING', // Default type for Google events
    start_at: startAt,
    end_at: endAt,
    owner_id: ownerId,
    source: 'GOOGLE',
    google_event_id: googleEvent.id,
    location: googleEvent.location || null,
    location_url: null,
    project_id: null,
    attendee_ids: null,
    todo_id: null,
    deliverable_id: null,
    due_date: null,
  };
}

/**
 * Convert a DB CalendarEvent row to Google Calendar event format
 */
export function dbEventToGoogleEvent(
  dbRow: Record<string, unknown>,
): {
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: string;
} {
  return {
    summary: dbRow.title as string,
    start: {
      dateTime: dbRow.start_at as string,
      timeZone: 'Asia/Seoul',
    },
    end: {
      dateTime: dbRow.end_at as string,
      timeZone: 'Asia/Seoul',
    },
    ...(dbRow.location ? { location: dbRow.location as string } : {}),
  };
}
