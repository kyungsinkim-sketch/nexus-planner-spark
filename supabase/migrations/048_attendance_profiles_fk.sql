-- Fix: nexus_attendance 400 error when joining profiles
-- The table references auth.users(id) but PostgREST can't infer
-- the relationship to profiles. Add explicit FK to profiles.
-- (profiles.id = auth.users.id, so this is a valid FK)

ALTER TABLE nexus_attendance
    ADD CONSTRAINT fk_attendance_profiles
    FOREIGN KEY (user_id) REFERENCES profiles(id)
    ON DELETE CASCADE
    NOT VALID; -- NOT VALID skips checking existing rows (faster)

-- Validate separately (checks existing data)
ALTER TABLE nexus_attendance VALIDATE CONSTRAINT fk_attendance_profiles;
