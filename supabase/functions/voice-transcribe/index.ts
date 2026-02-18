/**
 * voice-transcribe — Google Cloud STT v2 transcription.
 *
 * Pipeline:
 * 1. Download audio from Supabase Storage
 * 2. Call Google Cloud Speech-to-Text v2 API (Korean, speaker diarization)
 * 3. Parse response into TranscriptSegment[]
 * 4. Update voice_recordings table with transcript
 * 5. Return transcript to client
 *
 * Request: { userId, recordingId, audioStoragePath }
 * Response: { transcript: TranscriptSegment[] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

// ─── Google Cloud STT v2 ─────────────────────────────

async function transcribeWithGoogleSTT(
  audioBytes: Uint8Array,
  apiKey: string,
): Promise<TranscriptSegment[]> {
  const audioContent = btoa(String.fromCharCode(...audioBytes));

  const requestBody = {
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: 'ko-KR',
      alternativeLanguageCodes: ['en-US'],
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      enableWordConfidence: true,
      diarizationConfig: {
        enableSpeakerDiarization: true,
        minSpeakerCount: 1,
        maxSpeakerCount: 6,
      },
      model: 'latest_long',
      useEnhanced: true,
    },
    audio: {
      content: audioContent,
    },
  };

  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google STT error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const results = data.results || [];

  // Parse Google STT response into TranscriptSegment[]
  const segments: TranscriptSegment[] = [];
  let currentSpeaker = '';
  let currentText = '';
  let currentStart = 0;
  let currentEnd = 0;

  for (const result of results) {
    const alt = result.alternatives?.[0];
    if (!alt) continue;

    const words = alt.words || [];

    if (words.length === 0) {
      // No word-level info — use the whole transcript as one segment
      segments.push({
        speaker: '화자 1',
        text: alt.transcript?.trim() || '',
        startTime: 0,
        endTime: 0,
      });
      continue;
    }

    for (const word of words) {
      const speakerTag = word.speakerTag || 1;
      const speaker = `화자 ${speakerTag}`;
      const startSec = parseFloat(word.startTime?.replace('s', '') || '0');
      const endSec = parseFloat(word.endTime?.replace('s', '') || '0');

      if (speaker !== currentSpeaker && currentText) {
        // Speaker changed — push previous segment
        segments.push({
          speaker: currentSpeaker,
          text: currentText.trim(),
          startTime: currentStart,
          endTime: currentEnd,
        });
        currentText = '';
      }

      if (!currentText) {
        currentSpeaker = speaker;
        currentStart = startSec;
      }

      currentText += (currentText ? ' ' : '') + word.word;
      currentEnd = endSec;
    }
  }

  // Push last segment
  if (currentText) {
    segments.push({
      speaker: currentSpeaker,
      text: currentText.trim(),
      startTime: currentStart,
      endTime: currentEnd,
    });
  }

  // Fallback: if no segments from word-level parsing, use result-level transcripts
  if (segments.length === 0) {
    for (const result of results) {
      const transcript = result.alternatives?.[0]?.transcript;
      if (transcript) {
        segments.push({
          speaker: '화자 1',
          text: transcript.trim(),
          startTime: 0,
          endTime: 0,
        });
      }
    }
  }

  return segments;
}

// ─── Long audio: use async recognize for files > 1 minute ──

async function transcribeLongAudio(
  audioBytes: Uint8Array,
  apiKey: string,
): Promise<TranscriptSegment[]> {
  // For MVP, use synchronous recognize with chunking if needed
  // Google STT sync API supports up to ~1 minute of audio
  // For longer audio, we'd use longrunningrecognize (async)

  const audioSizeMB = audioBytes.length / (1024 * 1024);
  console.log(`[voice-transcribe] Audio size: ${audioSizeMB.toFixed(1)} MB`);

  // Try synchronous first (works for < ~1 min / ~10MB)
  if (audioBytes.length < 10 * 1024 * 1024) {
    return transcribeWithGoogleSTT(audioBytes, apiKey);
  }

  // For longer audio, use longrunningrecognize
  const audioContent = btoa(String.fromCharCode(...audioBytes));

  const requestBody = {
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: 'ko-KR',
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      diarizationConfig: {
        enableSpeakerDiarization: true,
        minSpeakerCount: 1,
        maxSpeakerCount: 6,
      },
      model: 'latest_long',
      useEnhanced: true,
    },
    audio: { content: audioContent },
  };

  const opResponse = await fetch(
    `https://speech.googleapis.com/v1/speech:longrunningrecognize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    },
  );

  if (!opResponse.ok) {
    const errText = await opResponse.text();
    throw new Error(`Google STT longrunning error: ${opResponse.status} - ${errText}`);
  }

  const operation = await opResponse.json();
  const operationName = operation.name;

  // Poll for completion (max 5 minutes)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const pollResponse = await fetch(
      `https://speech.googleapis.com/v1/operations/${operationName}?key=${apiKey}`,
    );
    const pollData = await pollResponse.json();

    if (pollData.done) {
      const results = pollData.response?.results || [];
      const segments: TranscriptSegment[] = [];

      for (const result of results) {
        const transcript = result.alternatives?.[0]?.transcript;
        const words = result.alternatives?.[0]?.words || [];

        if (words.length > 0) {
          let currentSpeaker = '';
          let currentText = '';
          let currentStart = 0;
          let currentEnd = 0;

          for (const word of words) {
            const speaker = `화자 ${word.speakerTag || 1}`;
            const startSec = parseFloat(word.startTime?.replace('s', '') || '0');
            const endSec = parseFloat(word.endTime?.replace('s', '') || '0');

            if (speaker !== currentSpeaker && currentText) {
              segments.push({ speaker: currentSpeaker, text: currentText.trim(), startTime: currentStart, endTime: currentEnd });
              currentText = '';
            }
            if (!currentText) { currentSpeaker = speaker; currentStart = startSec; }
            currentText += (currentText ? ' ' : '') + word.word;
            currentEnd = endSec;
          }
          if (currentText) {
            segments.push({ speaker: currentSpeaker, text: currentText.trim(), startTime: currentStart, endTime: currentEnd });
          }
        } else if (transcript) {
          segments.push({ speaker: '화자 1', text: transcript.trim(), startTime: 0, endTime: 0 });
        }
      }

      return segments;
    }
  }

  throw new Error('Transcription timed out after 5 minutes');
}

// ─── Main Handler ────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, recordingId, audioStoragePath } = await req.json();

    if (!userId || !recordingId || !audioStoragePath) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, recordingId, audioStoragePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_STT_API_KEY');
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_CLOUD_STT_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create Supabase service client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update status → transcribing
    await supabase
      .from('voice_recordings')
      .update({ status: 'transcribing', updated_at: new Date().toISOString() })
      .eq('id', recordingId);

    // Download audio from Storage
    const { data: audioData, error: downloadError } = await supabase.storage
      .from('voice-recordings')
      .download(audioStoragePath);

    if (downloadError || !audioData) {
      throw new Error(`Failed to download audio: ${downloadError?.message}`);
    }

    const audioBytes = new Uint8Array(await audioData.arrayBuffer());
    console.log(`[voice-transcribe] Downloaded ${audioBytes.length} bytes for recording ${recordingId}`);

    // Transcribe
    const transcript = await transcribeLongAudio(audioBytes, googleApiKey);
    console.log(`[voice-transcribe] Got ${transcript.length} segments`);

    // Save transcript to DB
    await supabase
      .from('voice_recordings')
      .update({
        transcript: JSON.stringify(transcript),
        status: 'analyzing', // Ready for Brain analysis
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    return new Response(
      JSON.stringify({ transcript }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[voice-transcribe] Error:', err);

    // Try to update recording status to error
    try {
      const { recordingId } = await (async () => {
        try { return await req.clone().json(); } catch { return {}; }
      })();
      if (recordingId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('voice_recordings')
          .update({ status: 'error', error_message: (err as Error).message })
          .eq('id', recordingId);
      }
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
