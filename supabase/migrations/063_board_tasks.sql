-- ============================================================
-- 063: Board Groups & Board Tasks for Project Board Widget
-- ============================================================

-- Board groups (phases/columns per project)
CREATE TABLE IF NOT EXISTS board_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0073EA',
  order_no INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Board tasks (individual tasks within a group)
CREATE TABLE IF NOT EXISTS board_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_group_id UUID NOT NULL REFERENCES board_groups(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('done', 'working', 'stuck', 'waiting', 'backlog', 'review')),
  owner_id UUID NOT NULL REFERENCES profiles(id),
  reviewer_ids UUID[] DEFAULT '{}',
  start_date DATE,
  end_date DATE,
  due_date DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  order_no INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_board_groups_project ON board_groups(project_id);
CREATE INDEX IF NOT EXISTS idx_board_tasks_project ON board_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_board_tasks_group ON board_tasks(board_group_id);
CREATE INDEX IF NOT EXISTS idx_board_tasks_owner ON board_tasks(owner_id);

-- RLS Policies
ALTER TABLE board_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_tasks ENABLE ROW LEVEL SECURITY;

-- Board groups: anyone authenticated can CRUD (project-level access is enforced at app layer)
CREATE POLICY "board_groups_select" ON board_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "board_groups_insert" ON board_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "board_groups_update" ON board_groups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "board_groups_delete" ON board_groups FOR DELETE TO authenticated USING (true);

CREATE POLICY "board_tasks_select" ON board_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "board_tasks_insert" ON board_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "board_tasks_update" ON board_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "board_tasks_delete" ON board_tasks FOR DELETE TO authenticated USING (true);

-- Auto-update updated_at trigger for board_tasks
CREATE OR REPLACE FUNCTION update_board_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER board_tasks_updated_at
  BEFORE UPDATE ON board_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_board_task_updated_at();
