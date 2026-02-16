-- Fix function_search_path_mutable lint warning on increment_brain_queue
-- Sets an explicit search_path to prevent mutable search_path vulnerability.
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

CREATE OR REPLACE FUNCTION increment_brain_queue()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
  -- Only process messages in rooms (not direct messages without rooms)
  -- Skip bot messages (brain bot user)
  IF NEW.room_id IS NOT NULL AND NEW.user_id != '00000000-0000-0000-0000-000000000099' THEN
    INSERT INTO brain_processing_queue (room_id, project_id, pending_message_count)
    VALUES (NEW.room_id, NEW.project_id, 1)
    ON CONFLICT (room_id) DO UPDATE
    SET pending_message_count = brain_processing_queue.pending_message_count + 1,
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
