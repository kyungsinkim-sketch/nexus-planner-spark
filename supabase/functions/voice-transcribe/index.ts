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
 *
 * Optimizations:
 * - Chunked base64 encoding to avoid stack overflow on large arrays
 * - Shared segment parsing helper (DRY)
 * - Error handler correctly scopes recordingId
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

// ─── Chunked Base64 ─────────────────────────────────
// btoa(String.fromCharCode(...largeArray)) causes stack overflow.
// Process in 32KB chunks instead.

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB per chunk
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    parts.push(String.fromCharCode(...chunk));
  }
  return btoa(parts.join(''));
}

// ─── Segment Parser ─────────────────────────────────
// Shared between sync and async recognize responses.

function parseWordsToSegments(results: Array<Record<string, unknown>>): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let currentSpeaker = '';
  let currentText = '';
  let currentStart = 0;
  let currentEnd = 0;

  for (const result of results) {
    const alt = (result.alternatives as Array<Record<string, unknown>>)?.[0];
    if (!alt) continue;

    const words = (alt.words as Array<Record<string, unknown>>) || [];

    if (words.length === 0) {
      const transcript = alt.transcript as string;
      if (transcript) {
        segments.push({ speaker: '화자 1', text: transcript.trim(), startTime: 0, endTime: 0 });
      }
      continue;
    }

    for (const word of words) {
      const speakerTag = (word.speakerTag as number) || 1;
      const speaker = `화자 ${speakerTag}`;
      const startSec = parseFloat(((word.startTime as string) || '0').replace('s', ''));
      const endSec = parseFloat(((word.endTime as string) || '0').replace('s', ''));

      if (speaker !== currentSpeaker && currentText) {
        segments.push({ speaker: currentSpeaker, text: currentText.trim(), startTime: currentStart, endTime: currentEnd });
        currentText = '';
      }

      if (!currentText) {
        currentSpeaker = speaker;
        currentStart = startSec;
      }

      currentText += (currentText ? ' ' : '') + (word.word as string);
      currentEnd = endSec;
    }
  }

  // Push last segment
  if (currentText) {
    segments.push({ speaker: currentSpeaker, text: currentText.trim(), startTime: currentStart, endTime: currentEnd });
  }

  // Fallback: if no segments from word-level, use result-level transcripts
  if (segments.length === 0) {
    for (const result of results) {
      const transcript = (result.alternatives as Array<Record<string, unknown>>)?.[0]?.transcript as string;
      if (transcript) {
        segments.push({ speaker: '화자 1', text: transcript.trim(), startTime: 0, endTime: 0 });
      }
    }
  }

  return segments;
}

// ─── Google Cloud STT (sync) ────────────────────────

async function transcribeWithGoogleSTT(
  audioBytes: Uint8Array,
  apiKey: string,
): Promise<TranscriptSegment[]> {
  const audioContent = uint8ArrayToBase64(audioBytes);

  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
        audio: { content: audioContent },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google STT error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return parseWordsToSegments(data.results || []);
}

// ─── Long audio: async recognize for files > 10MB ───

async function transcribeLongAudio(
  audioBytes: Uint8Array,
  apiKey: string,
): Promise<TranscriptSegment[]> {
  const audioSizeMB = audioBytes.length / (1024 * 1024);
  console.log(`[voice-transcribe] Audio size: ${audioSizeMB.toFixed(1)} MB`);

  // Synchronous API for smaller files (< ~10MB / ~1 min)
  if (audioBytes.length < 10 * 1024 * 1024) {
    return transcribeWithGoogleSTT(audioBytes, apiKey);
  }

  // Async API for larger files
  const audioContent = uint8ArrayToBase64(audioBytes);

  const opResponse = await fetch(
    `https://speech.googleapis.com/v1/speech:longrunningrecognize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    },
  );

  if (!opResponse.ok) {
    const errText = await opResponse.text();
    throw new Error(`Google STT longrunning error: ${opResponse.status} - ${errText}`);
  }

  const operation = await opResponse.json();
  const operationName = operation.name;

  // Poll for completion (max 5 minutes, 60 polls × 5s)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));

    const pollResponse = await fetch(
      `https://speech.googleapis.com/v1/operations/${operationName}?key=${apiKey}`,
    );
    const pollData = await pollResponse.json();

    if (pollData.done) {
      if (pollData.error) {
        throw new Error(`Google STT async error: ${JSON.stringify(pollData.error)}`);
      }
      return parseWordsToSegments(pollData.response?.results || []);
    }
  }

  throw new Error('Transcription timed out after 5 minutes');
}

// ─── Main Handler ────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Parse body once and keep recordingId in outer scope for error handling
  let recordingId: string | undefined;

  try {
    const body = await req.json();
    const { userId, audioStoragePath } = body;
    recordingId = body.recordingId;

    if (!userId || !recordingId || !audioStoragePath) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, recordingId, audioStoragePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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

    const googleApiKey = Deno.env.get('GOOGLE_CLOUD_STT_API_KEY');

    let transcript: TranscriptSegment[];

    if (!googleApiKey) {
      // STT API key not configured — return placeholder transcript
      // This allows the Brain analysis step to still run with minimal context
      console.warn('[voice-transcribe] GOOGLE_CLOUD_STT_API_KEY not configured, returning placeholder');
      transcript = [
        {
          speaker: '화자 1',
          text: '(음성 인식 API 키가 설정되지 않아 트랜스크립트를 생성할 수 없습니다. Supabase Dashboard → Edge Functions → Secrets에서 GOOGLE_CLOUD_STT_API_KEY를 설정해주세요.)',
          startTime: 0,
          endTime: 0,
        },
      ];
    } else {
      // Download audio from Storage
      const { data: audioData, error: downloadError } = await supabase.storage
        .from('voice-recordings')
        .download(audioStoragePath);

      if (downloadError || !audioData) {
        throw new Error(`Failed to download audio: ${downloadError?.message}`);
      }

      const audioBytes = new Uint8Array(await audioData.arrayBuffer());
      console.log(`[voice-transcribe] Downloaded ${audioBytes.length} bytes for recording ${recordingId}`);

      // Transcribe with Google Cloud STT
      transcript = await transcribeLongAudio(audioBytes, googleApiKey);
    }

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

    // Update recording status to error (best effort)
    if (recordingId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('voice_recordings')
          .update({ status: 'error', error_message: (err as Error).message })
          .eq('id', recordingId);
      } catch { /* best effort */ }
    }

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
