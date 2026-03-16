-- Migration 096: Restrict calendar_events SELECT to user-related events only
-- Previously: USING (true) — all users see all events
-- Now: only see events where user is owner, attendee, or member of the event's project

DROP POLICY IF EXISTS "Users can view all events" ON calendar_events;

CREATE POLICY "Users can view related events" ON calendar_events
FOR SELECT USING (
  owner_id = auth.uid()
  OR auth.uid() = ANY(COALESCE(attendee_ids, '{}'::UUID[]))
  OR project_id IN (
    SELECT id FROM projects WHERE auth.uid() = ANY(team_member_ids)
  )
);
