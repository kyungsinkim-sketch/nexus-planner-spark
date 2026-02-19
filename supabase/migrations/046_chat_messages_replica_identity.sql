-- Enable REPLICA IDENTITY FULL on chat_messages
-- Required for Supabase Realtime DELETE events to include the old row data (id)
-- Without this, DELETE events only contain the primary key if using default REPLICA IDENTITY

ALTER TABLE chat_messages REPLICA IDENTITY FULL;
