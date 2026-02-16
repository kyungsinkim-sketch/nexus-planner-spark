-- Brain Intelligence: Passive conversation analysis infrastructure
-- Phase 1 of Decision Intelligence evolution
--
-- Tables:
--   1. chat_digests — AI-generated conversation analysis results
--   2. brain_processing_queue — Batch processing control
--   3. project_context_snapshots — Project intelligence cache (1hr TTL)
--   4. brain_activity_log — AI transparency log
--
-- Trigger: increment_brain_queue() — auto-increment counter on new chat_messages

-- ============================================================
-- 1. chat_digests — stores AI-generated conversation analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  digest_type TEXT NOT NULL CHECK (digest_type IN ('decisions', 'action_items', 'risks', 'summary')),
  content JSONB NOT NULL,
  message_range_start TIMESTAMPTZ NOT NULL,
  message_range_end TIMESTAMPTZ NOT NULL,
  message_count INT NOT NULL DEFAULT 0,
  model_used TEXT,
  confidence FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_chat_digests_room ON chat_digests(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_digests_project ON chat_digests(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_digests_type ON chat_digests(digest_type);
CREATE INDEX IF NOT EXISTS idx_chat_digests_created ON chat_digests(created_at DESC);

-- ============================================================
-- 2. brain_processing_queue — batch processing control
-- ============================================================
CREATE TABLE IF NOT EXISTS brain_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  pending_message_count INT NOT NULL DEFAULT 0,
  last_processed_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'processing', 'cooldown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id)
);

-- ============================================================
-- 3. project_context_snapshots — cached project intelligence
-- ============================================================
CREATE TABLE IF NOT EXISTS project_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  model_used TEXT,
  UNIQUE(project_id)
);

-- ============================================================
-- 4. brain_activity_log — AI transparency log
-- ============================================================
CREATE TABLE IF NOT EXISTS brain_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('digest_created', 'context_generated', 'crud_parsed', 'error')),
  room_id UUID,
  project_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brain_activity_log_project ON brain_activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_brain_activity_log_type ON brain_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_brain_activity_log_created ON brain_activity_log(created_at DESC);

-- ============================================================
-- 5. Trigger: increment queue counter on new chat message
-- ============================================================
CREATE OR REPLACE FUNCTION increment_brain_queue()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process messages in rooms (not direct messages without rooms)
  -- Skip bot messages (brain bot user)
  IF NEW.room_id IS NOT NULL AND NEW.user_id != '00000000-0000-0000-0000-000000000099' THEN
    INSERT INTO brain_processing_queue (room_id, project_id, pending_message_count)
    VALUES (NEW.room_id, NEW.project_id, 1)
    ON CONFLICT (room_id) DO UPDATE
    SET pending_message_count = brain_processing_queue.pending_message_count + 1,
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_brain_queue ON chat_messages;
CREATE TRIGGER trg_increment_brain_queue
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_brain_queue();

-- ============================================================
-- 6. RLS Policies
-- ============================================================

-- chat_digests
ALTER TABLE chat_digests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view digests" ON chat_digests;
  CREATE POLICY "Authenticated users can view digests" ON chat_digests
    FOR SELECT USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Service can manage digests" ON chat_digests;
  CREATE POLICY "Service can manage digests" ON chat_digests
    FOR ALL USING (true);
END $$;

-- brain_processing_queue
ALTER TABLE brain_processing_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view queue" ON brain_processing_queue;
  CREATE POLICY "Authenticated users can view queue" ON brain_processing_queue
    FOR SELECT USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Service can manage queue" ON brain_processing_queue;
  CREATE POLICY "Service can manage queue" ON brain_processing_queue
    FOR ALL USING (true);
END $$;

-- project_context_snapshots
ALTER TABLE project_context_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view context" ON project_context_snapshots;
  CREATE POLICY "Authenticated users can view context" ON project_context_snapshots
    FOR SELECT USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Service can manage context" ON project_context_snapshots;
  CREATE POLICY "Service can manage context" ON project_context_snapshots
    FOR ALL USING (true);
END $$;

-- brain_activity_log
ALTER TABLE brain_activity_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view activity log" ON brain_activity_log;
  CREATE POLICY "Authenticated users can view activity log" ON brain_activity_log
    FOR SELECT USING (auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Service can insert activity log" ON brain_activity_log;
  CREATE POLICY "Service can insert activity log" ON brain_activity_log
    FOR INSERT WITH CHECK (true);
END $$;
