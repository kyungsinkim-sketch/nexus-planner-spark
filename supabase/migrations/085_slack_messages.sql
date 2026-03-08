-- Migration 085: Slack messages table for webhook real-time storage
-- Stores incoming Slack messages from Events API for real-time widget updates.

CREATE TABLE IF NOT EXISTS slack_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT NOT NULL,                   -- Slack workspace ID
    channel_id TEXT NOT NULL,                -- Slack channel ID
    message_ts TEXT NOT NULL,                -- Slack message timestamp (unique ID)
    thread_ts TEXT,                          -- Parent thread timestamp (null if top-level)
    user_id_slack TEXT,                      -- Slack user ID who sent the message
    user_name TEXT,                          -- Cached Slack display name
    user_avatar TEXT,                        -- Cached Slack avatar URL
    text TEXT,                               -- Message text content
    subtype TEXT,                            -- Slack message subtype (null for regular)
    edited_ts TEXT,                          -- Edit timestamp if message was edited
    is_bot BOOLEAN DEFAULT FALSE,            -- Whether sent by a bot
    reactions JSONB DEFAULT '[]'::jsonb,     -- Cached reactions [{name, count, users}]
    files JSONB DEFAULT '[]'::jsonb,         -- Attached files metadata
    raw_event JSONB,                         -- Full Slack event payload (for Brain AI)
    brain_analyzed BOOLEAN DEFAULT FALSE,    -- Whether Brain AI has processed this
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one message per channel+timestamp
CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_messages_unique
    ON slack_messages(team_id, channel_id, message_ts);

-- Query by channel (widget display)
CREATE INDEX IF NOT EXISTS idx_slack_messages_channel
    ON slack_messages(team_id, channel_id, created_at DESC);

-- Query unanalyzed messages (Brain AI batch processing)
CREATE INDEX IF NOT EXISTS idx_slack_messages_unanalyzed
    ON slack_messages(brain_analyzed) WHERE brain_analyzed = FALSE;

ALTER TABLE slack_messages ENABLE ROW LEVEL SECURITY;

-- Service role only (webhook writes, Edge Functions read)
-- No direct client access — all through Edge Functions
DROP POLICY IF EXISTS "Service role full access to slack_messages" ON slack_messages;
CREATE POLICY "Service role full access to slack_messages" ON slack_messages
    FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for this table (widget subscribes for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE slack_messages;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_slack_messages_updated_at') THEN
        CREATE TRIGGER update_slack_messages_updated_at BEFORE UPDATE ON slack_messages
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
