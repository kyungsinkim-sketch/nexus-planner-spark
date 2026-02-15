-- Migration 016: Fix Chat RLS policies
-- Issues:
-- 1. chat_rooms SELECT uses ANY(team_member_ids) without GIN index → timeout
-- 2. chat_room_members SELECT has circular self-reference → members can't see anything
-- 3. chat_messages SELECT uses ANY(team_member_ids) without GIN index → timeout
-- 4. Missing chat_room_members for seed projects (trigger may not have fired)

-- =====================================================
-- 1. ENSURE GIN INDEX EXISTS (idempotent)
-- This is the ROOT CAUSE of all timeout errors
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_projects_team_member_ids
ON projects USING GIN (team_member_ids);

-- =====================================================
-- 2. FIX chat_room_members SELECT policy
-- OLD: circular self-reference (can only see if already member)
-- NEW: project team members can see all room members in their projects
-- =====================================================
DROP POLICY IF EXISTS "Members can view room members" ON chat_room_members;
CREATE POLICY "Team members can view room members"
    ON chat_room_members FOR SELECT
    USING (
        room_id IN (
            SELECT cr.id FROM chat_rooms cr
            JOIN projects p ON p.id = cr.project_id
            WHERE auth.uid()::uuid = ANY(p.team_member_ids)
               OR p.pm_id = auth.uid()
               OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
        )
    );

-- =====================================================
-- 3. EXPAND chat_rooms SELECT policy to include PM and ADMIN
-- =====================================================
DROP POLICY IF EXISTS "Team members can view project chat rooms" ON chat_rooms;
CREATE POLICY "Team members can view project chat rooms"
    ON chat_rooms FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM projects
            WHERE auth.uid()::uuid = ANY(team_member_ids)
               OR pm_id = auth.uid()
               OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
        )
    );

-- =====================================================
-- 4. EXPAND chat_messages SELECT policy to include ADMIN and room members
-- =====================================================
DROP POLICY IF EXISTS "Users can view project messages" ON chat_messages;
CREATE POLICY "Users can view project messages" ON chat_messages FOR SELECT USING (
    -- Direct messages: sender or recipient
    user_id = auth.uid() OR
    direct_chat_user_id = auth.uid() OR
    -- Project messages: team member, PM, or admin
    project_id IN (
        SELECT id FROM projects
        WHERE auth.uid()::uuid = ANY(team_member_ids)
           OR pm_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    )
);

-- =====================================================
-- 5. ENSURE all seed projects have default chat rooms
-- (in case trigger didn't fire during seed)
-- =====================================================
INSERT INTO chat_rooms (project_id, name, description, is_default, created_by)
SELECT p.id, '전체', '프로젝트 전체 채팅방', TRUE, p.pm_id
FROM projects p
WHERE NOT EXISTS (
    SELECT 1 FROM chat_rooms cr WHERE cr.project_id = p.id AND cr.is_default = TRUE
);

-- =====================================================
-- 6. ENSURE all team members are in their project's default chat room
-- (in case the sync trigger didn't fire)
-- =====================================================
INSERT INTO chat_room_members (room_id, user_id)
SELECT cr.id, unnest(p.team_member_ids)
FROM projects p
JOIN chat_rooms cr ON cr.project_id = p.id AND cr.is_default = TRUE
WHERE p.team_member_ids IS NOT NULL
ON CONFLICT (room_id, user_id) DO NOTHING;

-- =====================================================
-- 7. FIX chat_rooms INSERT policy to also include PM
-- =====================================================
DROP POLICY IF EXISTS "Team members can create chat rooms" ON chat_rooms;
CREATE POLICY "Team members can create chat rooms"
    ON chat_rooms FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM projects
            WHERE auth.uid()::uuid = ANY(team_member_ids)
               OR pm_id = auth.uid()
               OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
        )
    );

-- =====================================================
-- 8. EXPAND file_groups policies (ensure these exist)
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
-- 9. FIX calendar_events UPDATE policy
-- =====================================================
DROP POLICY IF EXISTS "Users can update own events" ON calendar_events;
DROP POLICY IF EXISTS "Users can update own or attending events" ON calendar_events;
CREATE POLICY "Users can update own or attending events" ON calendar_events
    FOR UPDATE USING (
        owner_id = auth.uid()
        OR auth.uid()::uuid = ANY(COALESCE(attendee_ids, '{}'::UUID[]))
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );
