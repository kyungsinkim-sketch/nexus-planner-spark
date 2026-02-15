-- Migration 021: Fix RLS Performance Warnings
-- 1. auth_rls_initplan: wrap auth.uid() with (select auth.uid()) to avoid per-row re-evaluation
-- 2. multiple_permissive_policies: merge duplicate permissive policies into single policies

-- ============================================================
-- PART 1: Fix auth_rls_initplan warnings
-- Replace auth.uid() → (select auth.uid()) in all affected policies
-- ============================================================

-- ---- calendar_events ----
DROP POLICY IF EXISTS "Users can insert own events" ON calendar_events;
CREATE POLICY "Users can insert own events" ON calendar_events
    FOR INSERT WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own events" ON calendar_events;
CREATE POLICY "Users can delete own events" ON calendar_events
    FOR DELETE USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own or attending events" ON calendar_events;
CREATE POLICY "Users can update own or attending events" ON calendar_events
    FOR UPDATE USING (
        owner_id = (select auth.uid())
        OR (select auth.uid()) = ANY(attendee_ids)
    );

-- ---- personal_todos ----
DROP POLICY IF EXISTS "Users can view todos assigned to them" ON personal_todos;
CREATE POLICY "Users can view todos assigned to them" ON personal_todos
    FOR SELECT USING (
        requested_by_id = (select auth.uid())
        OR (select auth.uid()) = ANY(assignee_ids)
    );

DROP POLICY IF EXISTS "Assignees can update their todos" ON personal_todos;
CREATE POLICY "Assignees can update their todos" ON personal_todos
    FOR UPDATE USING (
        requested_by_id = (select auth.uid())
        OR (select auth.uid()) = ANY(assignee_ids)
    );

DROP POLICY IF EXISTS "Creators can delete todos" ON personal_todos;
CREATE POLICY "Creators can delete todos" ON personal_todos
    FOR DELETE USING (requested_by_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own todos" ON personal_todos;
CREATE POLICY "Users can create own todos" ON personal_todos
    FOR INSERT WITH CHECK ((select auth.uid()) = requested_by_id);

-- ---- chat_messages ----
DROP POLICY IF EXISTS "Users can send messages" ON chat_messages;
CREATE POLICY "Users can send messages" ON chat_messages
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view project messages" ON chat_messages;
CREATE POLICY "Users can view project messages" ON chat_messages
    FOR SELECT USING (
        -- Direct messages: sender or recipient
        user_id = (select auth.uid())
        OR direct_chat_user_id = (select auth.uid())
        -- Project messages: team member, PM, or admin
        OR project_id IN (
            SELECT id FROM projects
            WHERE (select auth.uid())::uuid = ANY(team_member_ids)
               OR pm_id = (select auth.uid())
               OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
CREATE POLICY "Users can delete own messages" ON chat_messages
    FOR DELETE USING (
        user_id = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

-- ---- peer_feedback ----
DROP POLICY IF EXISTS "Users can give feedback" ON peer_feedback;
CREATE POLICY "Users can give feedback" ON peer_feedback
    FOR INSERT WITH CHECK (from_user_id = (select auth.uid()));

-- ---- training_sessions (merge user + admin into single policies) ----
DROP POLICY IF EXISTS "Users can create own training sessions" ON training_sessions;
DROP POLICY IF EXISTS "Admins can create any training session" ON training_sessions;
CREATE POLICY "Users or admins can create training sessions" ON training_sessions
    FOR INSERT WITH CHECK (
        user_id = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Users can update own training sessions" ON training_sessions;
DROP POLICY IF EXISTS "Admins can update any training session" ON training_sessions;
CREATE POLICY "Users or admins can update training sessions" ON training_sessions
    FOR UPDATE USING (
        user_id = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Users can delete own training sessions" ON training_sessions;
DROP POLICY IF EXISTS "Admins can delete any training session" ON training_sessions;
CREATE POLICY "Users or admins can delete training sessions" ON training_sessions
    FOR DELETE USING (
        user_id = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

-- ---- locker_assignments (merge admin + user view into single) ----
DROP POLICY IF EXISTS "Admins can manage locker assignments" ON locker_assignments;
DROP POLICY IF EXISTS "Users can view all locker assignments" ON locker_assignments;
CREATE POLICY "Authenticated users can view locker assignments" ON locker_assignments
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "Admins can manage locker assignments" ON locker_assignments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

-- ---- nexus_departments ----
DROP POLICY IF EXISTS "Allow authenticated insert" ON nexus_departments;
CREATE POLICY "Allow authenticated insert" ON nexus_departments
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated update" ON nexus_departments;
CREATE POLICY "Allow authenticated update" ON nexus_departments
    FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated delete" ON nexus_departments;
CREATE POLICY "Allow authenticated delete" ON nexus_departments
    FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- ---- nexus_employees ----
DROP POLICY IF EXISTS "Allow authenticated insert" ON nexus_employees;
CREATE POLICY "Allow authenticated insert" ON nexus_employees
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated update" ON nexus_employees;
CREATE POLICY "Allow authenticated update" ON nexus_employees
    FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated delete" ON nexus_employees;
CREATE POLICY "Allow authenticated delete" ON nexus_employees
    FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- ---- nexus_salary_grades ----
DROP POLICY IF EXISTS "Allow authenticated insert" ON nexus_salary_grades;
CREATE POLICY "Allow authenticated insert" ON nexus_salary_grades
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated update" ON nexus_salary_grades;
CREATE POLICY "Allow authenticated update" ON nexus_salary_grades
    FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated delete" ON nexus_salary_grades;
CREATE POLICY "Allow authenticated delete" ON nexus_salary_grades
    FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- ---- nexus_attendance (merge user + admin view into single) ----
DROP POLICY IF EXISTS "Users can view own attendance" ON nexus_attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON nexus_attendance;
CREATE POLICY "Users can view own or admin all attendance" ON nexus_attendance
    FOR SELECT USING (
        user_id = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Users can insert own attendance" ON nexus_attendance;
CREATE POLICY "Users can insert own attendance" ON nexus_attendance
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own attendance" ON nexus_attendance;
CREATE POLICY "Users can update own attendance" ON nexus_attendance
    FOR UPDATE USING (user_id = (select auth.uid()));

-- ---- notifications ----
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications" ON notifications
    FOR DELETE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications" ON notifications
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ---- chat_rooms ----
DROP POLICY IF EXISTS "Creator or admin can update chat rooms" ON chat_rooms;
CREATE POLICY "Creator or admin can update chat rooms" ON chat_rooms
    FOR UPDATE USING (
        created_by = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Creator or admin can delete non-default rooms" ON chat_rooms;
CREATE POLICY "Creator or admin can delete non-default rooms" ON chat_rooms
    FOR DELETE USING (
        NOT is_default AND (
            created_by = (select auth.uid())
            OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "Team members can view project chat rooms" ON chat_rooms;
CREATE POLICY "Team members can view project chat rooms" ON chat_rooms
    FOR SELECT USING (
        project_id IN (
            SELECT id FROM projects
            WHERE (select auth.uid())::uuid = ANY(team_member_ids)
               OR pm_id = (select auth.uid())
               OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "Team members can create chat rooms" ON chat_rooms;
CREATE POLICY "Team members can create chat rooms" ON chat_rooms
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT id FROM projects
            WHERE (select auth.uid())::uuid = ANY(team_member_ids)
               OR pm_id = (select auth.uid())
               OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
        )
    );

-- ---- chat_room_members ----
DROP POLICY IF EXISTS "Team members can add room members" ON chat_room_members;
CREATE POLICY "Team members can add room members" ON chat_room_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_rooms cr
            JOIN projects p ON p.id = cr.project_id
            WHERE cr.id = chat_room_members.room_id
            AND (
                (select auth.uid())::uuid = ANY(p.team_member_ids)
                OR p.pm_id = (select auth.uid())
                OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
            )
        )
    );

DROP POLICY IF EXISTS "Members can leave or admin can remove" ON chat_room_members;
CREATE POLICY "Members can leave or admin can remove" ON chat_room_members
    FOR DELETE USING (
        user_id = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Team members can view room members" ON chat_room_members;
CREATE POLICY "Team members can view room members" ON chat_room_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_rooms cr
            JOIN projects p ON p.id = cr.project_id
            WHERE cr.id = chat_room_members.room_id
            AND (
                (select auth.uid())::uuid = ANY(p.team_member_ids)
                OR p.pm_id = (select auth.uid())
                OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
            )
        )
    );

-- ---- completion_reviews (merge admin + team member view into single) ----
DROP POLICY IF EXISTS "Team members can view completion reviews" ON completion_reviews;
DROP POLICY IF EXISTS "Admins can view all completion reviews" ON completion_reviews;
CREATE POLICY "Team members or admins can view completion reviews" ON completion_reviews
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = completion_reviews.project_id
            AND (select auth.uid()) = ANY(p.team_member_ids)
        )
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Team members can create completion reviews" ON completion_reviews;
CREATE POLICY "Team members can create completion reviews" ON completion_reviews
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = completion_reviews.project_id
            AND (select auth.uid()) = ANY(p.team_member_ids)
        )
    );

-- ---- project_financials (merge admin + PM view into single) ----
DROP POLICY IF EXISTS "Admins can view project financials" ON project_financials;
DROP POLICY IF EXISTS "PMs can view own project financials" ON project_financials;
CREATE POLICY "Admins or PMs can view project financials" ON project_financials
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
        OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_financials.project_id AND p.pm_id = (select auth.uid()))
    );

DROP POLICY IF EXISTS "Admins can insert project financials" ON project_financials;
CREATE POLICY "Admins can insert project financials" ON project_financials
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Admins can update project financials" ON project_financials;
CREATE POLICY "Admins can update project financials" ON project_financials
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

-- ---- annual_financials ----
DROP POLICY IF EXISTS "Admins can view annual financials" ON annual_financials;
CREATE POLICY "Admins can view annual financials" ON annual_financials
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Admins can insert annual financials" ON annual_financials;
CREATE POLICY "Admins can insert annual financials" ON annual_financials
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Admins can update annual financials" ON annual_financials;
CREATE POLICY "Admins can update annual financials" ON annual_financials
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

-- ---- profiles ----
DROP POLICY IF EXISTS "Users can update own profile or admin can update any" ON profiles;
CREATE POLICY "Users can update own profile or admin can update any" ON profiles
    FOR UPDATE USING (
        id = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = (select auth.uid()) AND p2.role = 'ADMIN')
    );

-- ---- file_groups ----
DROP POLICY IF EXISTS "Authenticated users can create file groups" ON file_groups;
CREATE POLICY "Authenticated users can create file groups" ON file_groups
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update file groups" ON file_groups;
CREATE POLICY "Authenticated users can update file groups" ON file_groups
    FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete file groups" ON file_groups;
CREATE POLICY "Authenticated users can delete file groups" ON file_groups
    FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- ---- file_items ----
DROP POLICY IF EXISTS "Authenticated users can upload files" ON file_items;
CREATE POLICY "Authenticated users can upload files" ON file_items
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Uploader can delete file items" ON file_items;
CREATE POLICY "Uploader can delete file items" ON file_items
    FOR DELETE USING (
        uploaded_by = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "Authenticated users can update file items" ON file_items;
CREATE POLICY "Authenticated users can update file items" ON file_items
    FOR UPDATE USING ((select auth.uid()) IS NOT NULL);

-- ---- projects ----
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON projects;
CREATE POLICY "Authenticated users can insert projects" ON projects
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "PM, team members and admins can update projects" ON projects;
CREATE POLICY "PM, team members and admins can update projects" ON projects
    FOR UPDATE USING (
        pm_id = (select auth.uid())
        OR (select auth.uid()) = ANY(team_member_ids)
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS "PM and admins can delete projects" ON projects;
CREATE POLICY "PM and admins can delete projects" ON projects
    FOR DELETE USING (
        pm_id = (select auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND role = 'ADMIN')
    );
