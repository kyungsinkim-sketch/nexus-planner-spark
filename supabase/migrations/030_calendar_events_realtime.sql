-- Enable realtime for calendar_events table
-- Without this, the subscribeToEvents() realtime subscription in CalendarWidget
-- never fires because the table is not in the supabase_realtime publication.
-- This is needed for Brain AI confirmed events to appear in the calendar
-- without a page refresh.

-- Safely add to publication (ignore if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'calendar_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
  END IF;
END $$;

-- Also add personal_todos for real-time todo updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'personal_todos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE personal_todos;
  END IF;
END $$;
