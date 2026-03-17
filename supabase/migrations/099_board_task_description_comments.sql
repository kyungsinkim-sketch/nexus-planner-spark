-- 099: Add description to board_tasks + board_task_comments table

-- 1. Add description column
ALTER TABLE board_tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 2. Comments table
CREATE TABLE IF NOT EXISTS board_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES board_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_task_comments_task ON board_task_comments(task_id);

-- RLS
ALTER TABLE board_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "board_task_comments_select" ON board_task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "board_task_comments_insert" ON board_task_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "board_task_comments_update" ON board_task_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "board_task_comments_delete" ON board_task_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER board_task_comments_updated_at
  BEFORE UPDATE ON board_task_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
