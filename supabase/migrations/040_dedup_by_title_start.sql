-- Dedup events that have the same title+start_at+owner_id but different google_event_ids.
-- These come from Google Calendar having multiple events (recurring instances, copies)
-- with identical title and start time. Keep the one with the earliest created_at.

DELETE FROM calendar_events
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY title, start_at, owner_id
             ORDER BY created_at ASC
           ) AS rn
    FROM calendar_events
  ) sub
  WHERE rn > 1
);
