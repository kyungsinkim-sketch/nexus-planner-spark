-- 068: Server-side stale user cleanup
-- Automatically sets work_status to NOT_AT_WORK for users
-- whose last_active_at is older than 30 minutes.
-- This ensures stale statuses are cleaned even if clients are offline.

-- Function to clean up stale work statuses
CREATE OR REPLACE FUNCTION cleanup_stale_work_status()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET work_status = 'NOT_AT_WORK',
      updated_at = now()
  WHERE work_status != 'NOT_AT_WORK'
    AND last_active_at IS NOT NULL
    AND last_active_at < now() - interval '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup every 10 minutes via pg_cron (if available)
-- Note: pg_cron must be enabled in Supabase dashboard → Extensions
-- SELECT cron.schedule(
--   'cleanup-stale-work-status',
--   '*/10 * * * *',
--   $$ SELECT cleanup_stale_work_status(); $$
-- );

-- Alternative: Run this manually or via Edge Function cron
-- SELECT cleanup_stale_work_status();
