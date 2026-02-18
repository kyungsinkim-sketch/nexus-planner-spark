-- Second round dedup after re-auth caused fresh duplicates.
--
-- Strategy:
-- 1. Among events WITH google_event_id: keep oldest per (google_event_id, owner_id)
-- 2. Remove PAULUS events that duplicate a GOOGLE event (same title+start_at+owner_id)
-- 3. Remove any remaining title+start_at+owner_id duplicates (keep oldest)

-- ============================================================
-- Step 1: Delete google_event_id duplicates (keep oldest)
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
-- Step 2: Where PAULUS and GOOGLE event co-exist for same
--         title+start_at+owner_id, delete the PAULUS one
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
-- Step 3: Delete any remaining title+start_at+owner_id dupes
--         (keep oldest per group — this catches PAULUS↔PAULUS dupes)
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
