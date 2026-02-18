-- Migration 044: Voice Recordings (Voice-to-Brain MVP)
--
-- Adds voice recording support with STT transcription and Brain AI analysis.
-- Pipeline: Record/Upload → Google Cloud STT v2 → Brain Analysis → Meeting notes
--

BEGIN;

-- ============================================================
-- 1. voice_recordings table
-- ============================================================
CREATE TABLE IF NOT EXISTS voice_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    audio_storage_path TEXT NOT NULL,
    duration_seconds INTEGER,
    status TEXT NOT NULL DEFAULT 'uploading'
        CHECK (status IN ('uploading', 'transcribing', 'analyzing', 'completed', 'error')),
    transcript JSONB,          -- Array of TranscriptSegment
    brain_analysis JSONB,      -- VoiceBrainAnalysis object
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_voice_recordings_user ON voice_recordings(user_id);
CREATE INDEX idx_voice_recordings_project ON voice_recordings(project_id);
CREATE INDEX idx_voice_recordings_status ON voice_recordings(status);

-- Enable RLS
ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only access their own recordings
CREATE POLICY "Users can view own recordings" ON voice_recordings
    FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own recordings" ON voice_recordings
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own recordings" ON voice_recordings
    FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own recordings" ON voice_recordings
    FOR DELETE USING (user_id = (select auth.uid()));

-- updated_at trigger
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_voice_recordings_updated_at') THEN
        CREATE TRIGGER update_voice_recordings_updated_at BEFORE UPDATE ON voice_recordings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================
-- 2. Enable Realtime for voice_recordings
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE voice_recordings;

COMMIT;
