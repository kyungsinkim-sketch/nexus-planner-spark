-- Migration 065: Add 'email' column to profiles table
--
-- The profiles table currently has no email column. The email lives in
-- auth.users, which is inaccessible from the client SDK. This makes
-- domain-based project sharing impossible because getAllUsers() returns
-- users without email addresses.
--
-- Fix: Add an email column to profiles and backfill from auth.users.
-- Also create a trigger to keep it in sync on new sign-ups / updates.

-- 1. Add the column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill existing profiles from auth.users
UPDATE profiles p
SET email = a.email
FROM auth.users a
WHERE p.id = a.id
  AND p.email IS NULL;

-- 3. Create a trigger function to auto-sync email from auth.users
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger on auth.users (fires on insert and update)
DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
CREATE TRIGGER on_auth_user_email_sync
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_email();
