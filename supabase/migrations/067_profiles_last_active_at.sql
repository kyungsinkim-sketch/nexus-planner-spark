-- 067: Add last_active_at to profiles for heartbeat-based stale detection
-- When a user is active in the app, last_active_at is updated every 5 minutes.
-- When loading users, if last_active_at is older than 30 minutes, the user is treated as NOT_AT_WORK.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- Set all existing users' last_active_at to now
UPDATE profiles SET last_active_at = now() WHERE last_active_at IS NULL;

-- Index for efficient stale-user queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON profiles(last_active_at);

-- Allow RLS update on last_active_at (users can update their own heartbeat)
-- (Existing RLS policies should already allow users to update their own profile row)
