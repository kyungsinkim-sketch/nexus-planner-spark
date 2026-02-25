-- 072: Smart Call Schema Extension
-- Adds recording type, participants, RAG ingestion tracking, and speaker profiles

-- ─── 1. voice_recordings extensions ──────────────────
ALTER TABLE voice_recordings
  ADD COLUMN IF NOT EXISTS recording_type TEXT DEFAULT 'manual';

-- Add check constraint for recording_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'voice_recordings_recording_type_check'
  ) THEN
    ALTER TABLE voice_recordings
      ADD CONSTRAINT voice_recordings_recording_type_check
      CHECK (recording_type IN ('phone_call', 'offline_meeting', 'online_meeting', 'manual'));
  END IF;
END $$;

ALTER TABLE voice_recordings
  ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS rag_ingested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS knowledge_item_ids UUID[] DEFAULT '{}';

-- Index for finding unprocessed recordings
CREATE INDEX IF NOT EXISTS idx_voice_recordings_rag
  ON voice_recordings(rag_ingested)
  WHERE status = 'completed' AND rag_ingested = FALSE;

-- ─── 2. speaker_profiles table ───────────────────────
CREATE TABLE IF NOT EXISTS speaker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  known_aliases TEXT[] DEFAULT '{}',
  phone_number TEXT,
  email TEXT,
  ark_id TEXT,  -- future: Ark.works identity link
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speaker lookup
CREATE INDEX IF NOT EXISTS idx_speaker_profiles_user
  ON speaker_profiles(user_id)
  WHERE is_active = TRUE;

-- ─── 3. source_type CHECK expansion ─────────────────
-- Add 'voice_recording' to allowed source_types
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_source_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_source_type_check CHECK (source_type IN (
  'chat_digest',
  'brain_action',
  'peer_review',
  'decision_log',
  'meeting_note',
  'manual',
  'notion_page',
  'gmail',
  'voice_recording',
  'flow_chat_log',
  'ceo_pattern_seed'
));

-- ─── 4. Comments ─────────────────────────────────────
COMMENT ON COLUMN voice_recordings.recording_type IS
  'Source type: phone_call, offline_meeting, online_meeting, manual';

COMMENT ON COLUMN voice_recordings.rag_ingested IS
  'Whether this recording analysis has been ingested into RAG knowledge_items';

COMMENT ON COLUMN voice_recordings.knowledge_item_ids IS
  'Array of knowledge_item UUIDs created from this recording';

COMMENT ON TABLE speaker_profiles IS
  'Speaker identification profiles for voice recordings. Phase 2: voiceprint hash for auto-identification.';
