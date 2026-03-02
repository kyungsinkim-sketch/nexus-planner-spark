-- ============================================================
-- Migration 077: Fix user creation triggers
-- ============================================================
-- Root cause: sync_profile_email trigger fired on INSERT but
-- profile didn't exist yet (handle_new_user creates it).
-- Fix: email sync trigger only on UPDATE, add exception handlers.
-- ============================================================

-- 1. Update handle_new_user to include org membership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $func$
BEGIN
    INSERT INTO public.profiles (id, name, role, current_org_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
      'MEMBER',
      'a0000000-0000-0000-0000-000000000001'
    );

    INSERT INTO public.memberships (user_id, org_id, role, status)
    VALUES (
      NEW.id,
      'a0000000-0000-0000-0000-000000000001',
      'member',
      'active'
    )
    ON CONFLICT (user_id, org_id) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix sync_profile_email with exception handler
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $func$
BEGIN
  UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate triggers in correct order
DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Email sync only on UPDATE (not INSERT - handle_new_user handles initial profile)
CREATE TRIGGER on_auth_user_email_sync
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_profile_email();
