-- Migration 015: Fix RLS policies and add indexes
-- Fixes: project update timeout, file_groups INSERT, calendar event update
-- Data seeding is handled by the app's Admin > Seed Database button

-- =====================================================
-- 1. ADD GIN INDEX on projects.team_member_ids
-- Fixes: "statement timeout" on project update due to
-- RLS policy checking auth.uid()::uuid = ANY(team_member_ids)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_projects_team_member_ids
ON projects USING GIN (team_member_ids);

-- =====================================================
-- 2. ADD INSERT POLICY for file_groups
-- Fixes: "new row violates row-level security policy for table file_groups"
-- =====================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'file_groups' AND policyname = 'Team members can create file groups') THEN
        CREATE POLICY "Team members can create file groups" ON file_groups
            FOR INSERT WITH CHECK (
                project_id IN (
                    SELECT id FROM projects
                    WHERE auth.uid() = pm_id
                       OR auth.uid()::uuid = ANY(team_member_ids)
                       OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
                )
            );
    END IF;
END $$;

-- Also add UPDATE and DELETE policies for file_groups
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'file_groups' AND policyname = 'Team members can update file groups') THEN
        CREATE POLICY "Team members can update file groups" ON file_groups
            FOR UPDATE USING (
                project_id IN (
                    SELECT id FROM projects
                    WHERE auth.uid() = pm_id
                       OR auth.uid()::uuid = ANY(team_member_ids)
                       OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
                )
            );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'file_groups' AND policyname = 'Team members can delete file groups') THEN
        CREATE POLICY "Team members can delete file groups" ON file_groups
            FOR DELETE USING (
                project_id IN (
                    SELECT id FROM projects
                    WHERE auth.uid() = pm_id
                       OR auth.uid()::uuid = ANY(team_member_ids)
                       OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
                )
            );
    END IF;
END $$;

-- =====================================================
-- 3. UPDATE calendar_events policies
-- Allow attendees to update events they're invited to
-- =====================================================
DROP POLICY IF EXISTS "Users can update own events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update own or attending events" ON calendar_events;
CREATE POLICY "Users can update own or attending events" ON calendar_events
    FOR UPDATE USING (
        owner_id = auth.uid()
        OR auth.uid()::uuid = ANY(COALESCE(attendee_ids, '{}'::UUID[]))
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );
