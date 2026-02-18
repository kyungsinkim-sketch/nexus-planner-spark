-- Add PRODUCER and TRAINER to the role constraint on profiles table
-- Fixes 400 error when updating user role to PRODUCER or TRAINER

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('ADMIN', 'MANAGER', 'PRODUCER', 'TRAINER', 'MEMBER'));
