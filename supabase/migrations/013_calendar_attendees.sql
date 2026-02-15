-- Migration: Add attendee_ids to calendar_events
-- This enables inviting users to calendar events

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS attendee_ids UUID[] DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN calendar_events.attendee_ids IS 'Array of user IDs invited to this event';
