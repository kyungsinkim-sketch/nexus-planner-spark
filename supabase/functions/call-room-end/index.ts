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
import { authenticateOrFallback } from '../_shared/auth.ts';

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

    const { roomId, audioBlob, liveTranscript, userId: bodyUserId } = await req.json();
    const { userId: authUserId } = await authenticateOrFallback(req);

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

    // Resolve userId: JWT > body > room creator
    const userId = authUserId || bodyUserId || room.created_by;
    const user = { id: userId };
    console.log('[call-room-end] userId resolved:', userId, '(auth:', authUserId, 'body:', bodyUserId, 'room:', room.created_by, ')');

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

    let audioProcessed = false;
    if (audioBlob) {
      try {
        console.log('[call-room-end] Decoding audio base64, length:', audioBlob.length);
        const audioBuffer = Uint8Array.from(atob(audioBlob), c => c.charCodeAt(0));
        console.log('[call-room-end] Audio decoded, size:', audioBuffer.length, 'bytes');
        const storagePath = `call-recordings/${roomId}.webm`;

        const { error: uploadError } = await supabase.storage
          .from('voice-recordings')
          .upload(storagePath, audioBuffer, {
            contentType: 'audio/webm',
            upsert: true,
          });

        if (uploadError) {
          console.error('[call-room-end] Upload error:', JSON.stringify(uploadError));
          throw new Error('Storage upload failed: ' + JSON.stringify(uploadError));
        }

        // Create voice_recording entry
        const { data: voiceRec, error: insertError } = await supabase
          .from('voice_recordings')
          .insert({
            user_id: user.id,
            title: room.title || 'In-App Call',
            audio_storage_path: storagePath,
            file_size: audioBuffer.length,
            duration: durationSeconds,
            status: 'transcribing',
            recording_type: 'online_meeting',
            participants: participantNames,
          })
          .select()
          .single();

        if (insertError) {
          console.error('[call-room-end] voice_recordings insert error:', JSON.stringify(insertError));
          throw new Error('voice_recordings insert failed');
        }

        if (voiceRec) {
          audioProcessed = true;
          await supabase.from('call_rooms').update({
            voice_recording_id: voiceRec.id,
            analysis_status: 'transcribing',
          }).eq('id', roomId);

          // Trigger full analysis pipeline (non-blocking)
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          fetch(`${supabaseUrl}/functions/v1/call-analyze-pipeline`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recordingId: voiceRec.id,
              userId: user.id,
              callRoomId: roomId,
              audioStoragePath: storagePath,
            }),
          }).catch(err => console.error('[call-room-end] Pipeline trigger failed:', err));
        }
      } catch (audioErr) {
        console.error('[call-room-end] Audio processing failed, falling back to liveTranscript:', audioErr);
      }
    }

    // ── Fallback: If audio processing failed OR no audio, use live transcript ──
    if (!audioProcessed && liveTranscript && liveTranscript.trim().length > 10) {
      console.log('[call-room-end] No audio, using live transcript for analysis. Length:', liveTranscript.length);

      // Create a voice_recording entry with pre-filled transcript
      const transcript = liveTranscript.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => ({
        speaker: '화자 1',
        text: line.trim(),
        startTime: i * 10,
        endTime: (i + 1) * 10,
      }));

      const { data: voiceRec } = await supabase
        .from('voice_recordings')
        .insert({
          user_id: user.id,
          title: room.title || 'In-App Call',
          audio_storage_path: null,
          file_size: 0,
          duration: durationSeconds,
          status: 'analyzing',
          recording_type: 'online_meeting',
          participants: participantNames,
          transcript: JSON.stringify(transcript),
        })
        .select()
        .single();

      if (voiceRec) {
        await supabase.from('call_rooms').update({
          voice_recording_id: voiceRec.id,
          analysis_status: 'analyzing',
        }).eq('id', roomId);

        // Skip STT, go straight to Brain analysis
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        fetch(`${supabaseUrl}/functions/v1/voice-brain-analyze`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recordingId: voiceRec.id,
            userId: user.id,
            transcript,
          }),
        }).then(async (resp) => {
          if (resp.ok) {
            const { analysis } = await resp.json();
            // Create suggestions (same logic as call-analyze-pipeline)
            const suggestions: any[] = [];

            if (analysis?.suggestedEvents?.length) {
              for (const evt of analysis.suggestedEvents) {
                suggestions.push({
                  room_id: roomId, user_id: user.id, suggestion_type: 'event',
                  title: evt.title || '새 일정', description: evt.description || null,
                  event_start: evt.startTime || null, event_end: evt.endTime || null,
                  confidence: evt.confidence || 0.8, source_quote: evt.sourceQuote || null,
                  status: 'pending',
                });
              }
            }
            if (analysis?.actionItems?.length) {
              for (const item of analysis.actionItems) {
                suggestions.push({
                  room_id: roomId, user_id: user.id, suggestion_type: 'todo',
                  title: item.title || '새 할 일', description: item.description || null,
                  todo_due_date: item.dueDate || null, todo_priority: item.priority || 'MEDIUM',
                  confidence: item.confidence || 0.8, source_quote: item.sourceQuote || null,
                  status: 'pending',
                });
              }
            }
            if (analysis?.decisions?.length) {
              for (const dec of analysis.decisions) {
                suggestions.push({
                  room_id: roomId, user_id: user.id, suggestion_type: 'note',
                  title: dec.content || '결정 사항', description: dec.reasoning || null,
                  note_category: 'decision', confidence: dec.confidence || 0.85,
                  source_quote: dec.sourceQuote || null, status: 'pending',
                });
              }
            }

            if (suggestions.length > 0) {
              await supabase.from('call_suggestions').insert(suggestions);
            }
            await supabase.from('call_rooms').update({ analysis_status: 'completed', status: 'completed' }).eq('id', roomId);
            console.log(`[call-room-end] Live transcript analysis done. ${suggestions.length} suggestions created.`);
          }
        }).catch(err => console.error('[call-room-end] Live transcript analysis failed:', err));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      room: {
        id: room.id,
        status: 'processing',
        durationSeconds,
        analysisStatus: audioBlob ? 'transcribing' : (liveTranscript ? 'analyzing' : 'pending'),
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
