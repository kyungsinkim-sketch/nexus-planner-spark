-- Enable Supabase Realtime for notification_read_state table
-- This allows cross-device notification read sync via postgres_changes subscription
ALTER PUBLICATION supabase_realtime ADD TABLE notification_read_state;
