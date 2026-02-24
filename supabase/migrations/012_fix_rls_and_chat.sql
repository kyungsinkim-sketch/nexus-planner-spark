-- =====================================================
-- FIX RLS POLICIES & CHAT INITIALIZATION
-- 1. Allow all authenticated users to create projects
-- 2. Enable realtime for chat_messages
-- =====================================================

-- 1. Drop old restrictive project insert policy (ADMIN only)
DROP POLICY IF EXISTS "Admins can insert projects" ON projects;

-- 2. Allow all authenticated users to create projects
CREATE POLICY "Authenticated users can insert projects" ON projects 
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Allow PM and team members to update projects (keep existing but safer)
DROP POLICY IF EXISTS "PM and admins can update projects" ON projects;
CREATE POLICY "PM, team members and admins can update projects" ON projects 
    FOR UPDATE USING (
        pm_id = auth.uid() OR 
        auth.uid()::uuid = ANY(team_member_ids) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 4. Allow project delete for PM and admins
DROP POLICY IF EXISTS "PM and admins can delete projects" ON projects;
CREATE POLICY "PM and admins can delete projects" ON projects 
    FOR DELETE USING (
        pm_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 5. Enable Realtime for chat tables (required for live chat)
-- These need to be run as superuser/service_role
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;

-- 6. Fix profiles update policy - admins can update any profile (for role changes)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile or admin can update any" ON profiles 
    FOR UPDATE USING (
        auth.uid() = id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );
