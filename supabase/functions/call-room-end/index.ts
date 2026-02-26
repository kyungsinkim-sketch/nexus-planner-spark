/**
 * call-room-end — End a call and trigger the analysis pipeline.
 *
 * Request: { roomId }
 * Response: { success, room }
 *
 * Flow:
 * 1. Update room status → 'ended'
 * 2. Calculate duration
 * 3. Stop LiveKit egress recording (if active)
 * 4. Trigger: recording download → STT → Brain analysis → Suggestions → RAG
 *
 * For MVP: Client records locally and uploads the audio.
 * For Production: LiveKit Egress handles server-side recording.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { roomId, audioBlob } = await req.json();
    if (!roomId) {
      return new Response(JSON.stringify({ error: 'roomId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify access
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

    const isParticipant = room.created_by === user.id ||
      (await supabase.from('call_participants').select('id').eq('room_id', roomId).eq('user_id', user.id).single()).data;

    if (!isParticipant) {
      return new Response(JSON.stringify({ error: 'Not a participant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate duration
    const startedAt = room.started_at ? new Date(room.started_at) : new Date();
    const endedAt = new Date();
    const durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);

    // Update room
    await supabase
      .from('call_rooms')
      .update({
        status: 'processing',
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        analysis_status: 'pending',
      })
      .eq('id', roomId);

    // Update all participants left_at
    await supabase
      .from('call_participants')
      .update({ left_at: endedAt.toISOString() })
      .eq('room_id', roomId)
      .is('left_at', null);

    // Get participant names for transcript context
    const { data: participants } = await supabase
      .from('call_participants')
      .select('user_id, users(name)')
      .eq('room_id', roomId);

    const participantNames = participants?.map(p => (p as any).users?.name).filter(Boolean) || [];

    // ── MVP: Client-side recording upload ──
    // Client sends base64 audio blob → we upload to storage → trigger pipeline
    // Production: LiveKit Egress webhook triggers this automatically

    if (audioBlob) {
      // Upload audio to Supabase Storage
      const audioBuffer = Uint8Array.from(atob(audioBlob), c => c.charCodeAt(0));
      const storagePath = `call-recordings/${roomId}.webm`;

      const { error: uploadError } = await supabase.storage
        .from('voice-recordings')
        .upload(storagePath, audioBuffer, {
          contentType: 'audio/webm',
          upsert: true,
        });

      if (uploadError) {
        console.error('[call-room-end] Upload error:', uploadError);
      } else {
        // Create voice_recording entry
        const { data: voiceRec } = await supabase
          .from('voice_recordings')
          .insert({
            user_id: user.id,
            title: room.title || 'In-App Call',
            file_path: storagePath,
            file_size: audioBuffer.length,
            duration: durationSeconds,
            status: 'transcribing',
            recording_type: 'online_meeting',
            participants: participantNames,
          })
          .select()
          .single();

        if (voiceRec) {
          // Link to call room
          await supabase
            .from('call_rooms')
            .update({
              voice_recording_id: voiceRec.id,
              analysis_status: 'transcribing',
            })
            .eq('id', roomId);

          // Trigger STT pipeline (non-blocking)
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

          fetch(`${supabaseUrl}/functions/v1/voice-transcribe`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recordingId: voiceRec.id,
              userId: user.id,
              callRoomId: roomId,
            }),
          }).catch(err => console.error('[call-room-end] STT trigger failed:', err));
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      room: {
        id: room.id,
        status: 'processing',
        durationSeconds,
        analysisStatus: audioBlob ? 'transcribing' : 'pending',
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[call-room-end] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
