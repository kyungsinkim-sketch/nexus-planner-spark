-- Migration 101: Add UPDATE policy for important_notes
-- Previously only INSERT/DELETE/SELECT policies existed.
-- Without UPDATE, edits to notes were silently blocked by RLS.

CREATE POLICY "Users can update notes"
  ON important_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
