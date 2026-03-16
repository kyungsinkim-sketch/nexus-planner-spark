-- Migration 098: Tighten calendar_events SELECT RLS
-- Regular users see ONLY their own events (owner or attendee)
-- R_TRAINING visible to all (welfare booking grid)
-- ADMIN sees everything

DROP POLICY IF EXISTS "Users can view related events" ON calendar_events;

CREATE POLICY "Users can view related events" ON calendar_events
FOR SELECT USING (
  owner_id = auth.uid()
  OR auth.uid() = ANY(COALESCE(attendee_ids, '{}'::UUID[]))
  OR type = 'R_TRAINING'
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
