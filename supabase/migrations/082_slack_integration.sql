-- Migration 082: Slack integration tables
-- Stores per-user/per-org Slack OAuth tokens and cached channel/message data.
-- Follows the same pattern as notion_tokens (migration 051).

-- ─── Slack OAuth Tokens ─────────────────────────────
CREATE TABLE IF NOT EXISTS slack_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,             -- Bot token (xoxb-...)
    user_access_token TEXT,                 -- User token (xoxp-...) for user-level actions
    bot_user_id TEXT,                       -- Slack bot user ID
    team_id TEXT NOT NULL,                  -- Slack workspace/team ID
    team_name TEXT,                         -- Slack workspace name
    team_icon TEXT,                         -- Slack workspace icon URL
    scope TEXT,                             -- Granted bot scopes
    user_scope TEXT,                        -- Granted user scopes
    incoming_webhook_url TEXT,              -- Incoming webhook URL if configured
    incoming_webhook_channel TEXT,          -- Webhook default channel
    authed_user_id TEXT,                    -- Slack user ID of the person who installed
    connected_email TEXT,                   -- User's Slack account email
    sync_status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK (sync_status IN ('CONNECTED', 'SYNCING', 'ERROR', 'DISCONNECTED')),
    sync_error TEXT,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each user can have one Slack connection per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_tokens_user_team ON slack_tokens(user_id, team_id);

ALTER TABLE slack_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own slack tokens" ON slack_tokens;
CREATE POLICY "Users can view own slack tokens" ON slack_tokens
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage own slack tokens" ON slack_tokens;
CREATE POLICY "Users can manage own slack tokens" ON slack_tokens
    FOR ALL USING (user_id = (select auth.uid()));

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_slack_tokens_updated_at') THEN
        CREATE TRIGGER update_slack_tokens_updated_at BEFORE UPDATE ON slack_tokens
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ─── Slack Channel Links ─────────────────────────────
-- Maps Slack channels to Re-Be projects for contextual display
CREATE TABLE IF NOT EXISTS slack_channel_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    slack_token_id UUID NOT NULL REFERENCES slack_tokens(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,               -- Slack channel ID (C0...)
    channel_name TEXT,                      -- Cached channel name
    channel_type TEXT DEFAULT 'channel' CHECK (channel_type IN ('channel', 'group', 'im', 'mpim')),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    last_message_at TIMESTAMPTZ,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_channel_links_unique
    ON slack_channel_links(user_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_channel_links_project
    ON slack_channel_links(project_id);

ALTER TABLE slack_channel_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own slack channels" ON slack_channel_links;
CREATE POLICY "Users can view own slack channels" ON slack_channel_links
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage own slack channels" ON slack_channel_links;
CREATE POLICY "Users can manage own slack channels" ON slack_channel_links
    FOR ALL USING (user_id = (select auth.uid()));

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_slack_channel_links_updated_at') THEN
        CREATE TRIGGER update_slack_channel_links_updated_at BEFORE UPDATE ON slack_channel_links
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ─── Slack Brain Extractions ─────────────────────────
-- Brain AI extracted items from Slack messages (client requests, deadlines, decisions)
CREATE TABLE IF NOT EXISTS slack_brain_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    message_ts TEXT NOT NULL,                -- Slack message timestamp (unique ID)
    extraction_type TEXT NOT NULL CHECK (extraction_type IN ('schedule', 'todo', 'decision', 'risk', 'request')),
    title TEXT NOT NULL,
    description TEXT,
    extracted_data JSONB,                    -- Structured extraction (dates, assignees, etc.)
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'dismissed')),
    linked_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
    linked_todo_id UUID REFERENCES personal_todos(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slack_brain_user ON slack_brain_extractions(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_brain_channel ON slack_brain_extractions(channel_id);

ALTER TABLE slack_brain_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own slack extractions" ON slack_brain_extractions;
CREATE POLICY "Users can view own slack extractions" ON slack_brain_extractions
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage own slack extractions" ON slack_brain_extractions;
CREATE POLICY "Users can manage own slack extractions" ON slack_brain_extractions
    FOR ALL USING (user_id = (select auth.uid()));
