-- Migration 097: Fix calendar_events SELECT RLS
-- Allow users to see:
-- 1. Events they own
-- 2. Events where they are an attendee
-- 3. Events in their projects
-- 4. R_TRAINING events (welfare booking — visible to all authenticated users for scheduling)
-- 5. All events if user is ADMIN

DROP POLICY IF EXISTS "Users can view related events" ON calendar_events;

CREATE POLICY "Users can view related events" ON calendar_events
FOR SELECT USING (
  owner_id = auth.uid()
  OR auth.uid() = ANY(COALESCE(attendee_ids, '{}'::UUID[]))
  OR project_id IN (
    SELECT id FROM projects WHERE auth.uid() = ANY(team_member_ids)
  )
  OR type = 'R_TRAINING'
  OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
  )
);
