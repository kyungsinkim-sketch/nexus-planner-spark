/**
 * gcal-push-event — Push a single Re-Be event to Google Calendar.
 *
 * Called when a user creates, updates, or deletes an event in Re-Be.
 * Creates/updates/deletes the event in Google Calendar and saves the google_event_id.
 *
 * Request body: {
 *   userId: string,
 *   eventId: string,
 *   action: 'create' | 'update' | 'delete',
 *   googleEventId?: string   // for delete when event already removed from DB
 * }
 * Response: { success: true, googleEventId: string } or { error: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  ensureValidToken,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
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
    const { userId, eventId, action = 'create', googleEventId: providedGoogleEventId } = await req.json();

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

    const calendarId = tokenRow.calendar_id || 'primary';

    // ── DELETE action ──
    if (action === 'delete') {
      const gEventId = providedGoogleEventId;
      if (gEventId) {
        try {
          await deleteGoogleEvent(accessToken, gEventId, calendarId);
          console.log(`[gcal-push-event] Deleted Google event: ${gEventId}`);
        } catch (err) {
          // If event already deleted from Google, that's fine
          console.warn('[gcal-push-event] Delete failed (may already be deleted):', (err as Error).message);
        }
      }
      return new Response(
        JSON.stringify({ success: true, deleted: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Load the event from DB (for create/update)
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

    // ── UPDATE action ──
    if (action === 'update' && dbEvent.google_event_id) {
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
        // If update fails because event was deleted from Google, DON'T create a new one
        // — just clear the stale google_event_id and let the next sync handle it
        console.warn('[gcal-push-event] Update failed:', (err as Error).message);
        await supabase
          .from('calendar_events')
          .update({ google_event_id: null })
          .eq('id', eventId);
        // Fall through to create
      }
    }

    // ── CREATE action ──
    // Guard: skip if already has google_event_id (prevent duplicates)
    if (dbEvent.google_event_id) {
      console.log(`[gcal-push-event] Event ${eventId} already has google_event_id, skipping create`);
      return new Response(
        JSON.stringify({ success: true, googleEventId: dbEvent.google_event_id, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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
