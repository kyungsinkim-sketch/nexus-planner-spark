-- Add source tracking columns to important_notes for cross-tool Brain AI
ALTER TABLE important_notes ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'reference';
ALTER TABLE important_notes ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE important_notes ADD COLUMN IF NOT EXISTS source_ref TEXT;
-- Make project_id optional (Brain AI can create notes without project context)
ALTER TABLE important_notes ALTER COLUMN project_id DROP NOT NULL;

-- Brain AI preference learning log
-- Tracks which action type users choose for different messages
-- Enables future pattern learning (e.g., "this user always makes TODOs from messages about deadlines")

CREATE TABLE IF NOT EXISTS brain_preference_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'slack', -- 'slack' | 'notion' | 'chat'
  source_channel_id TEXT,
  message_text TEXT, -- truncated source text (max 500 chars)
  chosen_action_type TEXT NOT NULL, -- 'todo' | 'calendar' | 'important'
  extracted_data JSONB,
  brain_action_id UUID REFERENCES brain_actions(id) ON DELETE SET NULL,
  outcome TEXT DEFAULT 'pending', -- 'pending' | 'confirmed' | 'rejected' | 'modified'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for user preference analysis
CREATE INDEX IF NOT EXISTS idx_brain_preference_log_user ON brain_preference_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_preference_log_source ON brain_preference_log(source, chosen_action_type);

-- RLS
ALTER TABLE brain_preference_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own preference logs" ON brain_preference_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access to preference logs" ON brain_preference_log
  FOR ALL USING (true) WITH CHECK (true);
