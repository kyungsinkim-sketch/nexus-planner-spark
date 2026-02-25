-- Migration 072: Smart Call Enhancements
-- Adds speaker voiceprints, recording type, speaker mapping,
-- and auto-created events/tasks tracking
--
-- Part of Phase 2: Smart Call (Re-Be.io Killer Feature)

-- ─── 1. Speaker Voiceprints ─────────────────────────────
CREATE TABLE IF NOT EXISTS speaker_voiceprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  person_id UUID,  -- linked workspace member (nullable, future FK)
  voiceprint_hash TEXT,  -- 256-dim embedding hash (local-first, future)
  sample_count INT DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaker_voiceprints_user
  ON speaker_voiceprints(user_id);

ALTER TABLE speaker_voiceprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own voiceprints"
  ON speaker_voiceprints FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 2. Voice Recordings Enhancements ───────────────────

-- Recording type
ALTER TABLE voice_recordings ADD COLUMN IF NOT EXISTS
  recording_type TEXT DEFAULT 'upload';

-- Drop existing constraint if any, then add
DO $$
BEGIN
  ALTER TABLE voice_recordings DROP CONSTRAINT IF EXISTS voice_recordings_recording_type_check;
  ALTER TABLE voice_recordings ADD CONSTRAINT voice_recordings_recording_type_check
    CHECK (recording_type IN ('upload', 'phone_call', 'meeting', 'desktop_capture'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Speaker map: {"화자 1": {"person_id": "uuid", "name": "정승채", "confidence": 0.95}}
ALTER TABLE voice_recordings ADD COLUMN IF NOT EXISTS
  speaker_map JSONB DEFAULT '{}';

-- Knowledge items created from this recording
ALTER TABLE voice_recordings ADD COLUMN IF NOT EXISTS
  knowledge_item_ids UUID[] DEFAULT '{}';

-- Auto-created calendar events
ALTER TABLE voice_recordings ADD COLUMN IF NOT EXISTS
  auto_created_events JSONB DEFAULT '[]';

-- Auto-created tasks
ALTER TABLE voice_recordings ADD COLUMN IF NOT EXISTS
  auto_created_tasks JSONB DEFAULT '[]';

-- Language detected
ALTER TABLE voice_recordings ADD COLUMN IF NOT EXISTS
  language TEXT DEFAULT 'ko-KR';

-- ─── 3. Update source_type check to include voice_recording ──
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
  'ceo_pattern_seed',
  'phone_call',
  'desktop_capture'
));

-- ─── 4. Comments ─────────────────────────────────────────
COMMENT ON TABLE speaker_voiceprints IS
  '화자 음성 지문 저장. 로컬 디바이스에서 생성한 voiceprint hash만 서버에 저장 (데이터 주권).';

COMMENT ON COLUMN voice_recordings.recording_type IS
  '녹음 유형: upload(파일 업로드), phone_call(전화), meeting(오프라인 미팅), desktop_capture(데스크톱 화면 캡처)';

COMMENT ON COLUMN voice_recordings.speaker_map IS
  '화자 매핑: {"화자 1": {"name": "정승채", "person_id": "uuid", "confidence": 0.95}}';

COMMENT ON COLUMN voice_recordings.knowledge_item_ids IS
  '이 녹음에서 추출된 knowledge_items의 ID 배열';
