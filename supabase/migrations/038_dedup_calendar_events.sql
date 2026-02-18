-- Fix duplicate calendar events caused by repeated gcal-sync.
--
-- Root cause: gcal-sync batch insert didn't check for existing events
-- by google_event_id properly, and Phase 2 Push re-exported events
-- that were then re-imported as new rows.
--
-- Fix:
-- 1. Delete duplicate rows (keep the one with google_event_id if any, else the oldest)
-- 2. Add unique partial index on (google_event_id, owner_id) to prevent future dupes
-- 3. Clean up orphan PAULUS duplicates of GOOGLE events (same title+start_at+owner_id)

-- ============================================================
-- Step 1: Delete exact duplicate GOOGLE events
--   Keep first row per (google_event_id, owner_id), delete rest
-- ============================================================
DELETE FROM calendar_events
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY google_event_id, owner_id
             ORDER BY created_at ASC
           ) AS rn
    FROM calendar_events
    WHERE google_event_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- ============================================================
-- Step 2: Delete PAULUS duplicates that match a GOOGLE event
--   If both a PAULUS and GOOGLE event exist for same title+start_at+owner_id,
--   keep the GOOGLE one (it has the authoritative google_event_id).
-- ============================================================
DELETE FROM calendar_events p
WHERE p.source = 'PAULUS'
  AND p.google_event_id IS NULL
  AND EXISTS (
    SELECT 1 FROM calendar_events g
    WHERE g.owner_id = p.owner_id
      AND g.title = p.title
      AND g.start_at = p.start_at
      AND g.google_event_id IS NOT NULL
  );

-- ============================================================
-- Step 3: Delete remaining PAULUS duplicates (same title+start_at+owner_id)
--   Keep only the oldest row per group.
-- ============================================================
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

-- ============================================================
-- Step 4: Add unique partial index to prevent future google_event_id dupes
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_google_unique
  ON calendar_events (google_event_id, owner_id)
  WHERE google_event_id IS NOT NULL;
