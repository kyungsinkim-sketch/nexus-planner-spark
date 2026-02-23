/**
 * gcal-push-event — Push a single Re-Be event to Google Calendar.
 *
 * Called when a user creates or updates an event in Re-Be.
 * Creates/updates the event in Google Calendar and saves the google_event_id.
 *
 * Request body: {
 *   userId: string,
 *   eventId: string,
 *   action: 'create' | 'update'
 * }
 * Response: { success: true, googleEventId: string } or { error: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  ensureValidToken,
  createGoogleEvent,
  updateGoogleEvent,
  dbEventToGoogleEvent,
  type GoogleTokenRow,
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
    const { userId, eventId, action = 'create' } = await req.json();

    if (!userId || !eventId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, eventId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 1. Load user's Google tokens
    const { data: tokenRow, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenRow) {
      // User doesn't have Google Calendar connected — silently succeed
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Google Calendar not connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check scope includes calendar
    const scope = (tokenRow as GoogleTokenRow).scope || '';
    if (!scope.includes('calendar')) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Calendar scope not granted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Ensure access token is valid
    let accessToken: string;
    try {
      accessToken = await ensureValidToken(supabase, tokenRow as GoogleTokenRow);
    } catch (err) {
      console.error('[gcal-push-event] Token refresh failed:', err);
      return new Response(
        JSON.stringify({ success: false, error: 'Token refresh failed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Load the event from DB
    const { data: dbEvent, error: eventError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !dbEvent) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const calendarId = tokenRow.calendar_id || 'primary';

    // 4. Create or update in Google Calendar
    if (action === 'update' && dbEvent.google_event_id) {
      // Update existing Google event
      try {
        const googleEvent = await updateGoogleEvent(
          accessToken,
          dbEvent.google_event_id,
          dbEventToGoogleEvent(dbEvent),
          calendarId,
        );
        return new Response(
          JSON.stringify({ success: true, googleEventId: googleEvent.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (err) {
        // If update fails (event may have been deleted from Google), create a new one
        console.warn('[gcal-push-event] Update failed, creating new:', (err as Error).message);
      }
    }

    // Create new Google event
    const googleEvent = await createGoogleEvent(
      accessToken,
      dbEventToGoogleEvent(dbEvent),
      calendarId,
    );

    // Store google_event_id so future syncs won't duplicate it
    await supabase
      .from('calendar_events')
      .update({ google_event_id: googleEvent.id })
      .eq('id', eventId);

    return new Response(
      JSON.stringify({ success: true, googleEventId: googleEvent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[gcal-push-event] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
