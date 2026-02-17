-- Migration 032: Google Calendar OAuth tokens table
-- Stores per-user Google OAuth tokens for calendar sync.
-- Tokens are encrypted at rest by Supabase's storage layer.
-- Uses IF NOT EXISTS / DROP IF EXISTS for idempotent re-runs.

CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT NOT NULL DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT,
    connected_email TEXT,        -- The Google account email
    calendar_id TEXT DEFAULT 'primary', -- Which Google Calendar to sync
    auto_sync BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK (sync_status IN ('CONNECTED', 'SYNCING', 'ERROR', 'DISCONNECTED')),
    sync_error TEXT,              -- Last sync error message
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each user can only have one Google Calendar connection
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcal_tokens_user ON google_calendar_tokens(user_id);

-- Enable RLS
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view/manage their own tokens
DROP POLICY IF EXISTS "Users can view own gcal tokens" ON google_calendar_tokens;
CREATE POLICY "Users can view own gcal tokens" ON google_calendar_tokens
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own gcal tokens" ON google_calendar_tokens;
CREATE POLICY "Users can insert own gcal tokens" ON google_calendar_tokens
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own gcal tokens" ON google_calendar_tokens;
CREATE POLICY "Users can update own gcal tokens" ON google_calendar_tokens
    FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own gcal tokens" ON google_calendar_tokens;
CREATE POLICY "Users can delete own gcal tokens" ON google_calendar_tokens
    FOR DELETE USING (user_id = (select auth.uid()));

-- Service role (Edge Functions) needs bypass — they use service_role key which bypasses RLS

-- Add trigger for updated_at (use DO block to avoid duplicate trigger error)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_gcal_tokens_updated_at') THEN
        CREATE TRIGGER update_gcal_tokens_updated_at BEFORE UPDATE ON google_calendar_tokens
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Also create a sync_token table for incremental sync
CREATE TABLE IF NOT EXISTS google_calendar_sync_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sync_token TEXT,              -- Google's incrementalSync nextSyncToken
    page_token TEXT,              -- For paginated initial syncs
    full_sync_completed BOOLEAN NOT NULL DEFAULT FALSE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gcal_sync_tokens_user ON google_calendar_sync_tokens(user_id);

ALTER TABLE google_calendar_sync_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sync tokens" ON google_calendar_sync_tokens;
CREATE POLICY "Users can view own sync tokens" ON google_calendar_sync_tokens
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage own sync tokens" ON google_calendar_sync_tokens;
CREATE POLICY "Users can manage own sync tokens" ON google_calendar_sync_tokens
    FOR ALL USING (user_id = (select auth.uid()));

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_gcal_sync_tokens_updated_at') THEN
        CREATE TRIGGER update_gcal_sync_tokens_updated_at BEFORE UPDATE ON google_calendar_sync_tokens
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
