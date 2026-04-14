-- Migration 102: Tighten important_notes visibility to project members
--
-- Previously SELECT policy was USING (true) and UPDATE policy (from mig 101)
-- was USING (true)/WITH CHECK (true). That means every authenticated user
-- could read and edit every note regardless of project membership.
--
-- This migration replaces both policies so that only users present in the
-- owning project's team_member_ids array can read/update/delete notes.
-- DELETE is also broadened from "author only" to "any project member" so
-- the team can collaboratively curate shared notes.

-- SELECT: project members only
DROP POLICY IF EXISTS "Users can read notes for their projects" ON important_notes;
CREATE POLICY "Users can read notes for their projects"
  ON important_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = important_notes.project_id
        AND auth.uid() = ANY(p.team_member_ids)
    )
  );

-- UPDATE: project members only (replaces migration 101's USING (true))
DROP POLICY IF EXISTS "Users can update notes" ON important_notes;
CREATE POLICY "Users can update notes"
  ON important_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = important_notes.project_id
        AND auth.uid() = ANY(p.team_member_ids)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = important_notes.project_id
        AND auth.uid() = ANY(p.team_member_ids)
    )
  );

-- DELETE: project members only (replaces mig 066's author-only policy)
DROP POLICY IF EXISTS "Users can delete own notes" ON important_notes;
CREATE POLICY "Users can delete notes for their projects"
  ON important_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = important_notes.project_id
        AND auth.uid() = ANY(p.team_member_ids)
    )
  );
