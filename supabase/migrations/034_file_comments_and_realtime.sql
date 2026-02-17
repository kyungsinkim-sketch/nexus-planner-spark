-- Migration 034: Add file_comments table + realtime for file_items
--
-- 1. Create file_comments table for threaded comments on files
-- 2. Enable Supabase Realtime for file_items and file_comments
-- 3. Add RLS policies for authenticated users

-- ─── 1. Create file_comments table ───
CREATE TABLE IF NOT EXISTS file_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_item_id UUID NOT NULL REFERENCES file_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient comment lookups by file
CREATE INDEX IF NOT EXISTS idx_file_comments_file_item_id ON file_comments(file_item_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_created_at ON file_comments(created_at);

-- ─── 2. RLS for file_comments ───
ALTER TABLE file_comments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all comments
DROP POLICY IF EXISTS "Authenticated users can view file comments" ON file_comments;
CREATE POLICY "Authenticated users can view file comments" ON file_comments
    FOR SELECT USING ((select auth.uid()) IS NOT NULL);

-- Authenticated users can insert comments
DROP POLICY IF EXISTS "Authenticated users can insert file comments" ON file_comments;
CREATE POLICY "Authenticated users can insert file comments" ON file_comments
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Users can delete their own comments
DROP POLICY IF EXISTS "Users can delete own file comments" ON file_comments;
CREATE POLICY "Users can delete own file comments" ON file_comments
    FOR DELETE USING (user_id = (select auth.uid()));

-- ─── 3. Enable Realtime for file_items and file_comments ───
-- file_items: detect DELETE/INSERT/UPDATE across users
DO $$
BEGIN
  -- Add file_items to realtime publication if not already
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'file_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE file_items;
  END IF;

  -- Add file_comments to realtime publication if not already
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'file_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE file_comments;
  END IF;
END $$;
