-- Migration 104: Tighten important_notes INSERT policy to project members
--
-- Background
--   Migration 066 created an INSERT policy on `important_notes` with
--
--       WITH CHECK (created_by = auth.uid())
--
--   which only validates that the inserting user's auth.uid() equals the
--   `created_by` column. It does NOT check that the target `project_id`
--   belongs to a project the user is actually a member of.
--
--   Migration 102 tightened SELECT / UPDATE / DELETE to
--   `auth.uid() = ANY(projects.team_member_ids)` but left INSERT alone,
--   so a malicious authenticated user can still create notes under any
--   arbitrary project_id (the note is invisible to them afterward via
--   the SELECT policy, but it pollutes the victim project's note list
--   and surfaces to legitimate members).
--
-- This migration replaces the INSERT policy so:
--   1. `created_by` must match auth.uid() (unchanged audit intent)
--   2. The user must be a member of the target project
--
--   Safe to re-run: idempotent via DROP POLICY IF EXISTS.

DROP POLICY IF EXISTS "Users can create notes" ON important_notes;
CREATE POLICY "Users can create notes"
  ON important_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = important_notes.project_id
        AND auth.uid() = ANY(p.team_member_ids)
    )
  );
