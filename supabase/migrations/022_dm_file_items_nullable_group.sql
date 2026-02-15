-- Migration 022: Allow file_items without file_group for DM file uploads
-- DM (direct message) file uploads don't belong to a project file_group,
-- so file_group_id must be nullable.

-- 1. Drop the NOT NULL constraint on file_group_id
ALTER TABLE file_items ALTER COLUMN file_group_id DROP NOT NULL;

-- 2. The existing FOREIGN KEY (file_group_id REFERENCES file_groups(id) ON DELETE CASCADE)
--    already handles NULLs correctly — NULL foreign keys are ignored by FK checks.
--    No FK change needed.
