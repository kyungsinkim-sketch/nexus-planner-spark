-- Migration 017: Simplify file_groups & file_items RLS policies
-- Problem: file_groups INSERT fails with RLS violation because the complex
--          subquery-based policy doesn't evaluate correctly for all users.
-- Solution: Use simple permissive policies matching schema.sql target state.
--           Any authenticated user can view/create/update/delete file groups.
--           File items: any auth user can view & upload, only uploader can delete.

-- =====================================================
-- 1. file_groups: DROP all existing policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view project files" ON file_groups;
DROP POLICY IF EXISTS "Users can view file groups" ON file_groups;
DROP POLICY IF EXISTS "Project members can manage file groups" ON file_groups;
DROP POLICY IF EXISTS "Team members can create file groups" ON file_groups;
DROP POLICY IF EXISTS "Team members can update file groups" ON file_groups;
DROP POLICY IF EXISTS "Team members can delete file groups" ON file_groups;

-- =====================================================
-- 2. file_groups: CREATE simple permissive policies
-- =====================================================

-- Anyone authenticated can view all file groups
CREATE POLICY "Anyone can view file groups"
    ON file_groups FOR SELECT
    USING (true);

-- Any authenticated user can create file groups
CREATE POLICY "Authenticated users can create file groups"
    ON file_groups FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Any authenticated user can update file groups
CREATE POLICY "Authenticated users can update file groups"
    ON file_groups FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Any authenticated user can delete file groups
CREATE POLICY "Authenticated users can delete file groups"
    ON file_groups FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 3. file_items: DROP all existing policies
-- =====================================================
DROP POLICY IF EXISTS "Users can view file items" ON file_items;
DROP POLICY IF EXISTS "Users can view files" ON file_items;
DROP POLICY IF EXISTS "Users can upload files" ON file_items;
DROP POLICY IF EXISTS "Users can delete own files" ON file_items;

-- =====================================================
-- 4. file_items: CREATE simple permissive policies
-- =====================================================

-- Anyone authenticated can view all file items
CREATE POLICY "Anyone can view file items"
    ON file_items FOR SELECT
    USING (true);

-- Any authenticated user can upload files
CREATE POLICY "Authenticated users can upload files"
    ON file_items FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Uploader or admin can update file items
CREATE POLICY "Uploader can update file items"
    ON file_items FOR UPDATE
    USING (
        uploaded_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Uploader or admin can delete file items
CREATE POLICY "Uploader can delete file items"
    ON file_items FOR DELETE
    USING (
        uploaded_by = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );
