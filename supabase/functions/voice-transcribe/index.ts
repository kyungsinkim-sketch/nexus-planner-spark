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
import { authenticateOrFallback } from '../_shared/auth.ts';

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

// ─── GCS Upload Helper (for long audio) ──────────────
// Google STT requires gs:// URI for audio > 1 minute (inline base64 is limited).
// We upload to GCS temporarily, transcribe, then delete.

import { SignJWT, importPKCS8 } from 'https://deno.land/x/jose@v5.2.0/index.ts';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

async function getGcsAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(sa.private_key, 'RS256');
  const jwt = await new SignJWT({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(`GCS auth failed: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

async function uploadToGcs(
  audioBytes: Uint8Array,
  bucket: string,
  objectName: string,
  accessToken: string,
): Promise<string> {
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'audio/webm',
    },
    body: audioBytes,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GCS upload failed: ${res.status} - ${errText}`);
  }
  return `gs://${bucket}/${objectName}`;
}

async function deleteFromGcs(bucket: string, objectName: string, accessToken: string): Promise<void> {
  await fetch(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectName)}`,
    { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } },
  ).catch(() => { /* best effort cleanup */ });
}

// ─── Long audio: async recognize ─────────────────────
// Google STT inline (base64) is limited to ~1 minute for BOTH sync and longrunning.
// For longer audio, must use GCS URI with longrunningrecognize.

const GCS_BUCKET = 're-be-stt-temp';

async function transcribeLongAudio(
  audioBytes: Uint8Array,
  apiKey: string,
): Promise<TranscriptSegment[]> {
  const audioSizeMB = audioBytes.length / (1024 * 1024);
  console.log(`[voice-transcribe] Audio size: ${audioSizeMB.toFixed(1)} MB`);

  // Use sync API only for very short recordings (< 200KB ≈ ~30s)
  if (audioBytes.length < 200 * 1024) {
    return transcribeWithGoogleSTT(audioBytes, apiKey);
  }

  // For longer audio, try GCS upload → longrunningrecognize
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!saJson) {
    // Fallback: try inline longrunning (will fail for > 1 min, but worth a shot)
    console.warn('[voice-transcribe] No GOOGLE_SERVICE_ACCOUNT_JSON — trying inline longrunning');
    return transcribeInlineLongRunning(audioBytes, apiKey);
  }

  const sa: ServiceAccount = JSON.parse(saJson);
  const accessToken = await getGcsAccessToken(sa);

  // Upload to GCS
  const objectName = `stt-temp/${crypto.randomUUID()}.webm`;
  console.log(`[voice-transcribe] Uploading to GCS: ${GCS_BUCKET}/${objectName}`);
  const gcsUri = await uploadToGcs(audioBytes, GCS_BUCKET, objectName, accessToken);
  console.log(`[voice-transcribe] GCS URI: ${gcsUri}`);

  try {
    // Call longrunningrecognize with GCS URI — use access token (not API key)
    // so the service account can read its own GCS objects
    const opResponse = await fetch(
      `https://speech.googleapis.com/v1/speech:longrunningrecognize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
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
          audio: { uri: gcsUri },
        }),
      },
    );

    if (!opResponse.ok) {
      const errText = await opResponse.text();
      throw new Error(`Google STT longrunning error: ${opResponse.status} - ${errText}`);
    }

    const operation = await opResponse.json();
    const operationName = operation.name;

    // Poll for completion (max 10 minutes)
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const pollResponse = await fetch(
        `https://speech.googleapis.com/v1/operations/${operationName}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } },
      );
      const pollData = await pollResponse.json();

      if (pollData.done) {
        if (pollData.error) {
          throw new Error(`Google STT async error: ${JSON.stringify(pollData.error)}`);
        }
        return parseWordsToSegments(pollData.response?.results || []);
      }
    }

    throw new Error('Transcription timed out after 10 minutes');
  } finally {
    // Always clean up GCS file
    await deleteFromGcs(GCS_BUCKET, objectName, accessToken);
    console.log(`[voice-transcribe] Cleaned up GCS: ${objectName}`);
  }
}

// Fallback: inline longrunning (for when no GCS credentials)
async function transcribeInlineLongRunning(
  audioBytes: Uint8Array,
  apiKey: string,
): Promise<TranscriptSegment[]> {
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

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const pollResponse = await fetch(
      `https://speech.googleapis.com/v1/operations/${operationName}?key=${apiKey}`,
    );
    const pollData = await pollResponse.json();
    if (pollData.done) {
      if (pollData.error) throw new Error(`Google STT async error: ${JSON.stringify(pollData.error)}`);
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
    const { userId: jwtUserId } = await authenticateOrFallback(req);
    const userId = jwtUserId || body.userId;
    const { audioStoragePath } = body;
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

    // Upsert recording (create if not exists, update if exists)
    const projectId = body.projectId && body.projectId.length > 10 ? body.projectId : null;
    const { error: upsertError } = await supabase
      .from('voice_recordings')
      .upsert({
        id: recordingId,
        user_id: userId,
        audio_storage_path: audioStoragePath,
        title: body.title || 'Recording',
        recording_type: body.recordingType || 'manual',
        project_id: projectId,
        duration_seconds: body.duration || 0,
        status: 'transcribing',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (upsertError) {
      console.error('[voice-transcribe] Upsert error:', upsertError);
    }

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
