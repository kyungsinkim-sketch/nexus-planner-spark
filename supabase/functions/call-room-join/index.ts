/**
 * call-room-join — Join an existing call room (for the callee).
 *
 * Request: { roomId }
 * Response: { token, wsUrl, room }
 *
 * Also updates room status to 'active' and sets started_at.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AccessToken } from 'https://esm.sh/livekit-server-sdk@2.9.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY') || '';
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET') || '';
const LIVEKIT_WS_URL = Deno.env.get('LIVEKIT_WS_URL') || '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      throw new Error('LiveKit configuration missing');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { roomId } = await req.json();
    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is a participant
    const { data: participant } = await supabase
      .from('call_participants')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single();

    if (!participant) {
      return new Response(JSON.stringify({ error: 'Not a participant of this call' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get room
    const { data: room } = await supabase
      .from('call_rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (!room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (room.status === 'ended' || room.status === 'completed') {
      return new Response(JSON.stringify({ error: 'Call has already ended' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user name
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    // Generate token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: user.id,
      name: userData?.name || 'Unknown',
    });
    at.addGrant({
      room: room.livekit_room_name,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    at.ttl = '24h';
    const token = await at.toJwt();

    // Update room status to active + set start time
    if (room.status === 'waiting') {
      await supabase
        .from('call_rooms')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', roomId);
    }

    // Update participant joined_at
    await supabase
      .from('call_participants')
      .update({ joined_at: new Date().toISOString() })
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    return new Response(JSON.stringify({
      token,
      wsUrl: LIVEKIT_WS_URL,
      room: {
        id: room.id,
        roomName: room.livekit_room_name,
        title: room.title,
        status: 'active',
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[call-room-join] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
