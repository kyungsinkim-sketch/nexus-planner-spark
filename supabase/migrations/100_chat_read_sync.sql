-- ==============================================================================
-- Migration: 100_chat_read_sync
-- Description: Cross-device chat read status sync
-- ==============================================================================

-- Store per-user, per-chat last-read timestamp
-- This replaces localStorage-only chatLastReadTimestamps
CREATE TABLE IF NOT EXISTS public.chat_read_status (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chat_key TEXT NOT NULL,  -- e.g. 'dm:<userId>' or 'room:<roomId>'
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_key)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_chat_read_status_user ON chat_read_status(user_id);

-- Enable RLS
ALTER TABLE chat_read_status ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own read status
CREATE POLICY "Users can view own read status"
  ON chat_read_status FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own read status"
  ON chat_read_status FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own read status"
  ON chat_read_status FOR UPDATE
  USING (user_id = auth.uid());

-- Enable realtime for cross-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE chat_read_status;
