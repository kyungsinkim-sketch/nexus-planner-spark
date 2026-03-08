/**
 * gcal-delete-event — Delete an event from Google Calendar.
 *
 * Called when a user deletes a Google-synced event from Re-Be,
 * so it doesn't zombie-resurrect on next sync.
 *
 * Request body: { userId: string, googleEventId: string }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  ensureValidToken,
  deleteGoogleEvent,
  type GoogleTokenRow,
} from '../_shared/gcal-client.ts';
import { authenticateOrFallback } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId: bodyUserId, googleEventId } = await req.json();
    const { userId: jwtUserId } = await authenticateOrFallback(req);
    const userId = jwtUserId || bodyUserId;

    if (!userId || !googleEventId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId or googleEventId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: tokenRow, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenRow) {
      // No Google connection — nothing to delete remotely
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const accessToken = await ensureValidToken(supabase, tokenRow as GoogleTokenRow);

    await deleteGoogleEvent(
      accessToken,
      googleEventId,
      tokenRow.calendar_id || 'primary',
    );

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[gcal-delete-event] Error:', err);
    // 404/410 from Google means already deleted — that's fine
    if ((err as Error).message?.includes('404') || (err as Error).message?.includes('410')) {
      return new Response(
        JSON.stringify({ success: true, alreadyDeleted: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
