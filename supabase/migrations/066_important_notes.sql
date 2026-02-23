-- Migration 066: Important Notes table for project-wide sharing
-- Notes are auto-extracted from chat keywords and manually added.
-- All project team members can view/add notes.

CREATE TABLE IF NOT EXISTS important_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content text NOT NULL,
  source_message_id uuid,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Index for fast project-scoped queries
CREATE INDEX IF NOT EXISTS idx_important_notes_project ON important_notes(project_id);

-- RLS: project team members can read all notes for their projects
ALTER TABLE important_notes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read notes for projects they belong to
CREATE POLICY "Users can read notes for their projects"
  ON important_notes FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert notes
CREATE POLICY "Users can create notes"
  ON important_notes FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Allow note creators to delete their own notes
CREATE POLICY "Users can delete own notes"
  ON important_notes FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
