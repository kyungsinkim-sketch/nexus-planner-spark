-- ============================================
-- Add location column to calendar_events
-- ============================================
-- Brain AI creates events with location data extracted from chat messages.
-- This column stores the location text (e.g., "강남역 9번출구").

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS location_url TEXT;
