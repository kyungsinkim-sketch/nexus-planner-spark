/**
 * call-room-create — Create a LiveKit room + issue participant tokens.
 *
 * Request: { targetUserId, projectId?, title? }
 * Response: { roomName, token, room: CallRoom }
 *
 * Flow:
 * 1. Create call_rooms record in DB
 * 2. Generate LiveKit access token for the caller
 * 3. Create call_participants entries
 * 4. Send push notification to target user
 * 5. Return room info + token
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLiveKitToken } from '../_shared/livekit-token.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY') || '';
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET') || '';
const LIVEKIT_WS_URL = Deno.env.get('LIVEKIT_WS_URL') || '';

function generateRoomName(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `rebe-${ts}-${rand}`;
}

async function createToken(roomName: string, participantId: string, participantName: string): Promise<string> {
  return await createLiveKitToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantId,
    name: participantName,
    ttlSeconds: 86400,
    grant: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      roomRecord: true,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate LiveKit config
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_WS_URL) {
      throw new Error('LiveKit configuration missing. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL.');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Auth
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

    const { targetUserId, targetUserIds, projectId, title, isVideo } = await req.json();

    // Support single targetUserId or array targetUserIds
    const targets: string[] = targetUserIds || (targetUserId ? [targetUserId] : []);
    if (targets.length === 0) {
      return new Response(JSON.stringify({ error: 'targetUserId or targetUserIds required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get caller and target user info
    const allUserIds = [user.id, ...targets];
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', allUserIds);

    const callerName = users?.find(u => u.id === user.id)?.name || 'Unknown';
    const targetNames = targets.map(id => users?.find(u => u.id === id)?.name || 'Unknown');

    // Create room
    const roomName = generateRoomName();
    const callTitle = title || (targets.length === 1
      ? `${callerName} ↔ ${targetNames[0]}`
      : `${callerName} 외 ${targets.length}명`);

    const { data: room, error: roomError } = await supabase
      .from('call_rooms')
      .insert({
        livekit_room_name: roomName,
        created_by: user.id,
        project_id: projectId || null,
        title: callTitle,
        recording_type: 'online_meeting',
        status: 'waiting',
        is_video: isVideo || false,
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Add participants (host + all targets)
    const participantRows = [
      { room_id: room.id, user_id: user.id, role: 'host' },
      ...targets.map(id => ({ room_id: room.id, user_id: id, role: 'participant' })),
    ];
    await supabase.from('call_participants').insert(participantRows);

    // Generate caller token
    const callerToken = await createToken(roomName, user.id, callerName);

    // Send push notifications to all targets (non-blocking)
    for (let i = 0; i < targets.length; i++) {
      const targetId = targets[i];
      const tName = targetNames[i];
      const targetToken = await createToken(roomName, targetId, tName);
      supabase.from('notifications').insert({
        user_id: targetId,
        type: 'call_invite',
        title: `${isVideo ? '📹' : '📞'} ${callerName}님의 ${isVideo ? '화상' : '음성'} 통화`,
        message: callTitle,
        data: {
          roomId: room.id,
          roomName,
          token: targetToken,
          wsUrl: LIVEKIT_WS_URL,
          callerId: user.id,
          callerName,
          isVideo: isVideo || false,
        },
      }).then(() => {});
    }

    return new Response(JSON.stringify({
      room: {
        id: room.id,
        roomName,
        title: callTitle,
        status: 'waiting',
        isVideo: isVideo || false,
      },
      token: callerToken,
      wsUrl: LIVEKIT_WS_URL,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[call-room-create] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
