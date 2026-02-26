/**
 * call-analyze-pipeline — End-to-end: STT → Brain Analysis → Suggestions → RAG
 *
 * Called by call-room-end after audio upload.
 * Chains: voice-transcribe → voice-brain-analyze → create call_suggestions → voice-call-ingest (RAG)
 *
 * Updates call_rooms.analysis_status at each stage.
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let callRoomId: string | undefined;

  try {
    const { recordingId, userId, callRoomId: roomId } = await req.json();
    callRoomId = roomId;

    if (!recordingId || !userId) {
      return new Response(JSON.stringify({ error: 'recordingId and userId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[call-analyze-pipeline] Starting for recording=${recordingId}, room=${callRoomId}`);

    // ─── Step 1: STT ────────────────────────────────
    if (callRoomId) {
      await supabase.from('call_rooms').update({ analysis_status: 'transcribing' }).eq('id', callRoomId);
    }

    const sttResp = await fetch(`${supabaseUrl}/functions/v1/voice-transcribe`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, userId }),
    });

    if (!sttResp.ok) {
      const err = await sttResp.text();
      throw new Error(`STT failed (${sttResp.status}): ${err}`);
    }

    const { transcript } = await sttResp.json();
    console.log(`[call-analyze-pipeline] STT done, ${transcript?.length || 0} segments`);

    if (!transcript || transcript.length === 0) {
      console.warn('[call-analyze-pipeline] No transcript, skipping analysis');
      if (callRoomId) {
        await supabase.from('call_rooms').update({ analysis_status: 'completed' }).eq('id', callRoomId);
      }
      return new Response(JSON.stringify({ status: 'no_transcript' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Step 2: Brain Analysis ─────────────────────
    if (callRoomId) {
      await supabase.from('call_rooms').update({ analysis_status: 'analyzing' }).eq('id', callRoomId);
    }

    const brainResp = await fetch(`${supabaseUrl}/functions/v1/voice-brain-analyze`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId, userId, transcript }),
    });

    if (!brainResp.ok) {
      const err = await brainResp.text();
      throw new Error(`Brain analysis failed (${brainResp.status}): ${err}`);
    }

    const { analysis } = await brainResp.json();
    console.log('[call-analyze-pipeline] Brain analysis done:', {
      events: analysis?.suggestedEvents?.length || 0,
      actions: analysis?.actionItems?.length || 0,
      decisions: analysis?.decisions?.length || 0,
      quotes: analysis?.keyQuotes?.length || 0,
      followups: analysis?.followups?.length || 0,
    });

    // ─── Step 3: Create call_suggestions ────────────
    if (callRoomId) {
      await supabase.from('call_rooms').update({ analysis_status: 'suggesting' }).eq('id', callRoomId);

      const suggestions: any[] = [];

      // Events → suggestion type 'event'
      if (analysis.suggestedEvents?.length) {
        for (const evt of analysis.suggestedEvents) {
          suggestions.push({
            room_id: callRoomId,
            user_id: userId,
            suggestion_type: 'event',
            title: evt.title || evt.description || '새 일정',
            description: evt.description || null,
            event_start: evt.startTime || evt.date || null,
            event_end: evt.endTime || null,
            confidence: evt.confidence || 0.8,
            source_quote: evt.sourceQuote || null,
            project_id: evt.projectId || null,
            status: 'pending',
          });
        }
      }

      // Action items → suggestion type 'todo'
      if (analysis.actionItems?.length) {
        for (const item of analysis.actionItems) {
          suggestions.push({
            room_id: callRoomId,
            user_id: userId,
            suggestion_type: 'todo',
            title: item.title || item.content || '새 할 일',
            description: item.description || null,
            todo_due_date: item.dueDate || null,
            todo_priority: item.priority || 'MEDIUM',
            confidence: item.confidence || 0.8,
            source_quote: item.sourceQuote || null,
            project_id: item.projectId || null,
            status: 'pending',
          });
        }
      }

      // Decisions → suggestion type 'note' (category: decision)
      if (analysis.decisions?.length) {
        for (const dec of analysis.decisions) {
          suggestions.push({
            room_id: callRoomId,
            user_id: userId,
            suggestion_type: 'note',
            title: dec.content || dec.title || '결정 사항',
            description: dec.reasoning || dec.description || null,
            note_category: 'decision',
            confidence: dec.confidence || 0.85,
            source_quote: dec.sourceQuote || null,
            project_id: dec.projectId || null,
            status: 'pending',
          });
        }
      }

      // Key quotes → suggestion type 'note' (category: key_quote)
      if (analysis.keyQuotes?.length) {
        for (const quote of analysis.keyQuotes) {
          suggestions.push({
            room_id: callRoomId,
            user_id: userId,
            suggestion_type: 'note',
            title: `${quote.speaker || '발언자'}: "${quote.text?.substring(0, 80) || ''}"`,
            description: quote.text || null,
            note_category: quote.importance || 'key_quote',
            confidence: 0.7,
            source_quote: quote.text || null,
            status: 'pending',
          });
        }
      }

      // Followups → suggestion type 'todo' (lower priority)
      if (analysis.followups?.length) {
        for (const fu of analysis.followups) {
          suggestions.push({
            room_id: callRoomId,
            user_id: userId,
            suggestion_type: 'todo',
            title: fu.content || fu.title || '후속 조치',
            description: fu.description || null,
            todo_due_date: fu.remindDate || null,
            todo_priority: 'LOW',
            confidence: 0.65,
            source_quote: fu.sourceQuote || null,
            status: 'pending',
          });
        }
      }

      if (suggestions.length > 0) {
        const { error: sugError } = await supabase.from('call_suggestions').insert(suggestions);
        if (sugError) {
          console.error('[call-analyze-pipeline] Suggestion insert error:', sugError);
        } else {
          console.log(`[call-analyze-pipeline] ✅ Created ${suggestions.length} suggestions`);
        }
      }

      // Update room status
      await supabase.from('call_rooms').update({
        analysis_status: 'completed',
        status: 'completed',
      }).eq('id', callRoomId);
    }

    // ─── Step 4: RAG Ingest (non-blocking) ──────────
    fetch(`${supabaseUrl}/functions/v1/voice-call-ingest`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, recordingId, analysis, transcript }),
    }).catch(err => console.warn('[call-analyze-pipeline] RAG ingest failed (non-blocking):', err));

    return new Response(JSON.stringify({
      status: 'completed',
      suggestions: analysis ? {
        events: analysis.suggestedEvents?.length || 0,
        todos: (analysis.actionItems?.length || 0) + (analysis.followups?.length || 0),
        notes: (analysis.decisions?.length || 0) + (analysis.keyQuotes?.length || 0),
      } : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[call-analyze-pipeline] Error:', err);

    if (callRoomId) {
      await supabase.from('call_rooms').update({
        analysis_status: 'error',
        status: 'completed',
      }).eq('id', callRoomId).catch(() => {});
    }

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
