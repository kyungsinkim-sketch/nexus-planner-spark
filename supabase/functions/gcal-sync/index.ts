/**
 * gcal-sync — Bidirectional Google Calendar sync.
 *
 * Performs two-way sync:
 *   Phase 1: Pull Google → Re-Be (incremental or full)
 *   Phase 2: Push Re-Be → Google (events without googleEventId)
 *
 * Supports incremental sync using Google's sync tokens to avoid
 * re-fetching all events on every sync.
 *
 * Request body: { userId: string }
 * Response: { success: true, imported: number, exported: number, deleted: number }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  ensureValidToken,
  listGoogleEvents,
  createGoogleEvent,
  deleteGoogleEvent,
  googleEventToDbInsert,
  dbEventToGoogleEvent,
  type GoogleTokenRow,
  type GoogleEvent,
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
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
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
      return new Response(
        JSON.stringify({ error: 'Google Calendar not connected' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Mark as syncing
    await supabase
      .from('google_calendar_tokens')
      .update({ sync_status: 'SYNCING', sync_error: null })
      .eq('id', tokenRow.id);

    // 2. Ensure access token is valid
    let accessToken: string;
    try {
      accessToken = await ensureValidToken(supabase, tokenRow as GoogleTokenRow);
    } catch (err) {
      await supabase
        .from('google_calendar_tokens')
        .update({ sync_status: 'ERROR', sync_error: `Token refresh failed: ${(err as Error).message}` })
        .eq('id', tokenRow.id);

      return new Response(
        JSON.stringify({ error: 'Token refresh failed. Please reconnect Google Calendar.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3. Load sync token
    const { data: syncTokenRow } = await supabase
      .from('google_calendar_sync_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    let currentSyncToken = syncTokenRow?.sync_token || null;
    let imported = 0;
    let exported = 0;
    let deleted = 0;

    // ─── Phase 1: Pull Google → Re-Be ────────────────────
    try {
      let pageToken: string | null = null;
      let nextSyncToken: string | null = null;
      let needsFullSync = false;

      do {
        let response;
        try {
          response = await listGoogleEvents(
            accessToken,
            tokenRow.calendar_id || 'primary',
            needsFullSync ? null : currentSyncToken,
            pageToken,
          );
        } catch (err) {
          if ((err as Error).message === 'SYNC_TOKEN_INVALID') {
            // Sync token expired — do full re-sync
            console.log('[gcal-sync] Sync token invalid, doing full sync');
            needsFullSync = true;
            currentSyncToken = null;
            response = await listGoogleEvents(
              accessToken,
              tokenRow.calendar_id || 'primary',
              null,
              null,
            );
          } else {
            throw err;
          }
        }

        const googleEvents: GoogleEvent[] = response.items || [];

        for (const gEvent of googleEvents) {
          if (gEvent.status === 'cancelled') {
            // Delete the corresponding local event
            const { data: existing } = await supabase
              .from('calendar_events')
              .select('id')
              .eq('google_event_id', gEvent.id)
              .eq('owner_id', userId)
              .maybeSingle();

            if (existing) {
              await supabase
                .from('calendar_events')
                .delete()
                .eq('id', existing.id);
              deleted++;
            }
            continue;
          }

          const dbInsert = googleEventToDbInsert(gEvent, userId);
          if (!dbInsert) continue;

          // Check if this Google event already exists in our DB
          const { data: existing } = await supabase
            .from('calendar_events')
            .select('id, title, start_at, end_at, location')
            .eq('google_event_id', gEvent.id)
            .eq('owner_id', userId)
            .maybeSingle();

          if (existing) {
            // Update existing event
            await supabase
              .from('calendar_events')
              .update({
                title: dbInsert.title,
                start_at: dbInsert.start_at,
                end_at: dbInsert.end_at,
                location: dbInsert.location,
              })
              .eq('id', existing.id);
          } else {
            // Insert new event
            const { error: insertError } = await supabase
              .from('calendar_events')
              .insert(dbInsert);

            if (!insertError) {
              imported++;
            } else {
              console.error('[gcal-sync] Failed to insert event:', insertError, gEvent.summary);
            }
          }
        }

        pageToken = response.nextPageToken || null;
        if (response.nextSyncToken) {
          nextSyncToken = response.nextSyncToken;
        }
      } while (pageToken);

      // Save the new sync token
      if (nextSyncToken) {
        await supabase
          .from('google_calendar_sync_tokens')
          .upsert(
            {
              user_id: userId,
              sync_token: nextSyncToken,
              full_sync_completed: true,
              last_sync_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          );
      }
    } catch (err) {
      console.error('[gcal-sync] Phase 1 (pull) error:', err);
      await supabase
        .from('google_calendar_tokens')
        .update({ sync_status: 'ERROR', sync_error: `Pull failed: ${(err as Error).message}` })
        .eq('id', tokenRow.id);

      return new Response(
        JSON.stringify({ error: `Sync failed: ${(err as Error).message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ─── Phase 2: Push Re-Be → Google ────────────────────
    try {
      // Find PAULUS events that don't have a googleEventId yet
      const { data: localEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('owner_id', userId)
        .eq('source', 'PAULUS')
        .is('google_event_id', null);

      if (localEvents && localEvents.length > 0) {
        for (const localEvent of localEvents) {
          try {
            const googleEvent = await createGoogleEvent(
              accessToken,
              dbEventToGoogleEvent(localEvent),
              tokenRow.calendar_id || 'primary',
            );

            // Update local event with the Google event ID
            await supabase
              .from('calendar_events')
              .update({ google_event_id: googleEvent.id })
              .eq('id', localEvent.id);

            exported++;
          } catch (err) {
            console.error('[gcal-sync] Failed to export event:', localEvent.title, err);
            // Continue with other events
          }
        }
      }
    } catch (err) {
      console.error('[gcal-sync] Phase 2 (push) error:', err);
      // Non-fatal: we still completed the pull
    }

    // ─── Phase 3: Sync deletions Re-Be → Google ─────────
    // (Events that were deleted locally but still exist in Google)
    // This is handled reactively: when user deletes a GOOGLE-sourced event,
    // the frontend calls the delete endpoint which also deletes from Google.
    // We don't need to scan for deletions during sync.

    // 4. Update sync status
    await supabase
      .from('google_calendar_tokens')
      .update({
        sync_status: 'CONNECTED',
        sync_error: null,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', tokenRow.id);

    return new Response(
      JSON.stringify({ success: true, imported, exported, deleted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[gcal-sync] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
