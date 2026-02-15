-- Fix storage RLS: Add UPDATE policy for avatar upserts and general file updates
-- The avatar upload uses upsert: true, which requires both INSERT and UPDATE policies
-- Also increase file_size_limit on the bucket to 100MB for video/large file support

-- 1. Add UPDATE policy for storage.objects (needed for upsert operations)
DO $$
BEGIN
  -- Drop if exists to make migration idempotent
  DROP POLICY IF EXISTS "Authenticated users can update own files" ON storage.objects;

  CREATE POLICY "Authenticated users can update own files" ON storage.objects FOR UPDATE USING (
    bucket_id = 'project-files' AND auth.role() = 'authenticated'
  ) WITH CHECK (
    bucket_id = 'project-files' AND auth.role() = 'authenticated'
  );
END $$;

-- 2. Update bucket file size limit to 100MB (from default 50MB)
-- This allows larger video files and PDFs to be uploaded
UPDATE storage.buckets
SET file_size_limit = 104857600  -- 100MB in bytes
WHERE id = 'project-files';
