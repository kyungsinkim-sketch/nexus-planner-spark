-- Migration 051: Notion API integration tables
-- Stores per-user Notion OAuth tokens and synced page references.
-- Follows the same pattern as google_calendar_tokens (migration 032).
-- Uses IF NOT EXISTS / DROP IF EXISTS for idempotent re-runs.

-- ─── Notion OAuth Tokens ─────────────────────────────
CREATE TABLE IF NOT EXISTS notion_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    bot_id TEXT,                       -- Notion bot ID for this integration
    workspace_id TEXT,                 -- Notion workspace ID
    workspace_name TEXT,               -- Notion workspace display name
    workspace_icon TEXT,               -- Notion workspace icon URL or emoji
    connected_email TEXT,              -- User's Notion account email
    token_type TEXT NOT NULL DEFAULT 'bearer',
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK (sync_status IN ('CONNECTED', 'SYNCING', 'ERROR', 'DISCONNECTED')),
    sync_error TEXT,
    auto_sync BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each user can only have one Notion connection
CREATE UNIQUE INDEX IF NOT EXISTS idx_notion_tokens_user ON notion_tokens(user_id);

-- Enable RLS
ALTER TABLE notion_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notion tokens" ON notion_tokens;
CREATE POLICY "Users can view own notion tokens" ON notion_tokens
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own notion tokens" ON notion_tokens;
CREATE POLICY "Users can insert own notion tokens" ON notion_tokens
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own notion tokens" ON notion_tokens;
CREATE POLICY "Users can update own notion tokens" ON notion_tokens
    FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own notion tokens" ON notion_tokens;
CREATE POLICY "Users can delete own notion tokens" ON notion_tokens
    FOR DELETE USING (user_id = (select auth.uid()));

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notion_tokens_updated_at') THEN
        CREATE TRIGGER update_notion_tokens_updated_at BEFORE UPDATE ON notion_tokens
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ─── Notion Synced Pages ─────────────────────────────
-- Tracks which Notion pages/databases the user has bookmarked/pinned for quick access
CREATE TABLE IF NOT EXISTS notion_synced_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notion_page_id TEXT NOT NULL,          -- Notion page/database UUID (without hyphens)
    notion_object_type TEXT NOT NULL DEFAULT 'page' CHECK (notion_object_type IN ('page', 'database')),
    title TEXT,                            -- Cached page title
    icon TEXT,                             -- Cached icon (emoji or URL)
    parent_type TEXT,                      -- 'workspace', 'page_id', 'database_id'
    parent_id TEXT,                        -- Parent page/database Notion ID
    url TEXT,                              -- Notion URL for opening in browser
    last_edited_at TIMESTAMPTZ,            -- Last edit time from Notion API
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,  -- Link to Re-Be project
    cached_content JSONB,                  -- Cached page blocks for offline/quick viewing
    cached_at TIMESTAMPTZ,                 -- When content was last cached
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: one user can't pin the same page twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_notion_synced_pages_user_page
    ON notion_synced_pages(user_id, notion_page_id);

CREATE INDEX IF NOT EXISTS idx_notion_synced_pages_user ON notion_synced_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_synced_pages_project ON notion_synced_pages(project_id);

ALTER TABLE notion_synced_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notion pages" ON notion_synced_pages;
CREATE POLICY "Users can view own notion pages" ON notion_synced_pages
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage own notion pages" ON notion_synced_pages;
CREATE POLICY "Users can manage own notion pages" ON notion_synced_pages
    FOR ALL USING (user_id = (select auth.uid()));

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notion_synced_pages_updated_at') THEN
        CREATE TRIGGER update_notion_synced_pages_updated_at BEFORE UPDATE ON notion_synced_pages
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ─── Notion Brain Extractions ────────────────────────
-- Brain AI extracted items from Notion pages (schedules, todos, decisions)
CREATE TABLE IF NOT EXISTS notion_brain_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notion_page_id TEXT NOT NULL,
    extraction_type TEXT NOT NULL CHECK (extraction_type IN ('schedule', 'todo', 'decision', 'risk', 'mention')),
    title TEXT NOT NULL,
    description TEXT,
    extracted_data JSONB,                  -- Structured extraction (dates, assignees, etc.)
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'dismissed')),
    linked_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
    linked_todo_id UUID REFERENCES personal_todos(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notion_brain_user ON notion_brain_extractions(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_brain_page ON notion_brain_extractions(notion_page_id);

ALTER TABLE notion_brain_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notion extractions" ON notion_brain_extractions;
CREATE POLICY "Users can view own notion extractions" ON notion_brain_extractions
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage own notion extractions" ON notion_brain_extractions;
CREATE POLICY "Users can manage own notion extractions" ON notion_brain_extractions
    FOR ALL USING (user_id = (select auth.uid()));

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_notion_brain_updated_at') THEN
        CREATE TRIGGER update_notion_brain_updated_at BEFORE UPDATE ON notion_brain_extractions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
