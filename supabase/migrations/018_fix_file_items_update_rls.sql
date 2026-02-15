-- Migration 018: Allow project team members to update any file in their project
-- Problem: Only the uploader or ADMIN can update file_items (comment, rename, important).
--          Team members like MANAGER cannot add comments to files uploaded by others.
-- Solution: Allow any authenticated user to update file_items (matching file_groups policy).

DROP POLICY IF EXISTS "Uploader can update file items" ON file_items;
DROP POLICY IF EXISTS "Authenticated users can update file items" ON file_items;
CREATE POLICY "Authenticated users can update file items"
    ON file_items FOR UPDATE
    USING (auth.uid() IS NOT NULL);
