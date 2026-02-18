-- Third round dedup: the timezone format mismatch (+00:00 vs +09:00)
-- caused title+start_at matching to fail. Clean up duplicates once more.
-- Keep oldest per (title, start_at, owner_id).

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
