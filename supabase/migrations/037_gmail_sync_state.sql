-- Gmail Sync State — Stores historyId for incremental Gmail fetching.
--
-- Used by the `gmail-fetch` Edge Function to track which emails have
-- already been fetched per user, using Gmail's historyId mechanism.
-- Same incremental sync pattern as google_calendar_sync_tokens (032).

-- ============================================================
-- 1. Create gmail_sync_state table
-- ============================================================
CREATE TABLE IF NOT EXISTS gmail_sync_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  history_id TEXT,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. RLS Policies
-- ============================================================
ALTER TABLE gmail_sync_state ENABLE ROW LEVEL SECURITY;

-- Users can view their own sync state (for UI display of last sync time)
CREATE POLICY "Users can view own gmail sync state" ON gmail_sync_state
  FOR SELECT USING ((select auth.uid()) = user_id);

-- Edge Functions use service_role (bypasses RLS) for INSERT/UPDATE/DELETE.
-- No additional write policies needed for authenticated users.
