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

      // Pre-load ALL existing events for this user (single query)
      // We need both google_event_id matches AND title+start_at matches
      // to avoid duplicating events that were created locally (PAULUS source).
      const { data: existingEvents } = await supabase
        .from('calendar_events')
        .select('id, google_event_id, title, start_at, end_at, location, source')
        .eq('owner_id', userId);

      // Normalize timestamps to UTC epoch ms for reliable comparison
      // (DB stores +00:00, Google API returns +09:00 — same instant, different strings)
      const normalizeTime = (t: string): string => {
        try { return new Date(t).getTime().toString(); } catch { return t; }
      };

      const existingByGoogleId = new Map<string, { id: string; title: string; start_at: string; end_at: string; location: string | null }>();
      const existingByTitleStart = new Map<string, { id: string; title: string; start_at: string; end_at: string; location: string | null }>();
      for (const evt of existingEvents || []) {
        if (evt.google_event_id) {
          existingByGoogleId.set(evt.google_event_id, evt);
        }
        // Index by title + normalized start_at (UTC epoch) for matching across timezone formats
        const key = `${evt.title}||${normalizeTime(evt.start_at)}`;
        if (!existingByTitleStart.has(key)) {
          existingByTitleStart.set(key, evt);
        }
      }

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

        // Batch: collect inserts and updates
        const toInsert: Array<Record<string, unknown>> = [];
        const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];
        const toDelete: string[] = [];

        for (const gEvent of googleEvents) {
          if (gEvent.status === 'cancelled') {
            const existing = existingByGoogleId.get(gEvent.id);
            if (existing) {
              toDelete.push(existing.id);
              deleted++;
            }
            continue;
          }

          const dbInsert = googleEventToDbInsert(gEvent, userId);
          if (!dbInsert) continue;

          // Check by google_event_id first, then fallback to title+normalized_start_at
          const existingById = existingByGoogleId.get(gEvent.id);
          const titleKey = `${dbInsert.title}||${normalizeTime(dbInsert.start_at as string)}`;
          const existingByTitle = existingByTitleStart.get(titleKey);
          const existing = existingById || existingByTitle;

          if (existing) {
            // Only update if this DB row hasn't already been claimed by another google_event_id
            // (prevents overwriting when Google has multiple events with same title+time)
            if (existing.id) {
              toUpdate.push({
                id: existing.id,
                data: {
                  title: dbInsert.title,
                  start_at: dbInsert.start_at,
                  end_at: dbInsert.end_at,
                  location: dbInsert.location,
                  google_event_id: gEvent.id,
                  source: 'GOOGLE',
                },
              });
            }
            // Add to google_event_id map so subsequent pages don't re-insert
            existingByGoogleId.set(gEvent.id, existing);
          } else {
            // Before inserting, check if we've already inserted an event with same title+start_at
            // in this sync batch (Google may have duplicate events with different IDs)
            if (existingByTitleStart.has(titleKey)) {
              // Skip — already handled (duplicate in Google Calendar itself)
              existingByGoogleId.set(gEvent.id, existingByTitleStart.get(titleKey)!);
              continue;
            }
            toInsert.push(dbInsert);
            imported++;
            // Track the new insert to prevent duplicates in subsequent pages
            const newEntry = { id: '', title: dbInsert.title as string, start_at: dbInsert.start_at as string, end_at: dbInsert.end_at as string, location: dbInsert.location as string | null };
            existingByGoogleId.set(gEvent.id, newEntry);
            existingByTitleStart.set(titleKey, newEntry);
          }
        }

        // Execute batch delete
        if (toDelete.length > 0) {
          await supabase
            .from('calendar_events')
            .delete()
            .in('id', toDelete);
        }

        // Execute batch insert
        if (toInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('calendar_events')
            .insert(toInsert);
          if (insertError) {
            console.error('[gcal-sync] Batch insert error:', insertError);
            // Try one-by-one as fallback (some may be duplicates)
            for (const item of toInsert) {
              const { error } = await supabase.from('calendar_events').insert(item);
              if (error) {
                console.error('[gcal-sync] Insert failed:', error, item);
                imported--; // Revert count
              }
            }
          }
        }

        // Execute batch updates (Supabase doesn't support multi-row update, but we can parallelize)
        if (toUpdate.length > 0) {
          await Promise.all(
            toUpdate.map(({ id, data }) =>
              supabase.from('calendar_events').update(data).eq('id', id)
            ),
          );
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
    // TEMPORARILY DISABLED: Phase 2 Push was causing a duplication loop where
    // PAULUS events exported to Google were re-imported as new rows on next sync.
    // TODO: Re-enable after implementing proper bidirectional dedup logic.
    // Key fix needed: when exporting, mark events so they're not re-imported.
    /*
    try {
      const { data: localEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('owner_id', userId)
        .eq('source', 'PAULUS')
        .is('google_event_id', null);

      if (localEvents && localEvents.length > 0) {
        const batch = localEvents.slice(0, 10);
        await Promise.all(
          batch.map(async (localEvent) => {
            try {
              const googleEvent = await createGoogleEvent(
                accessToken,
                dbEventToGoogleEvent(localEvent),
                tokenRow.calendar_id || 'primary',
              );
              await supabase
                .from('calendar_events')
                .update({ google_event_id: googleEvent.id })
                .eq('id', localEvent.id);
              exported++;
            } catch (err) {
              console.error('[gcal-sync] Failed to export event:', localEvent.title, err);
            }
          }),
        );
      }
    } catch (err) {
      console.error('[gcal-sync] Phase 2 (push) error:', err);
    }
    */

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
