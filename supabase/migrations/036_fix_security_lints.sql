-- Fix Supabase Security Lint Issues (Report 2026-02)
--
-- Issues resolved:
-- ┌─────────────────────────────────┬────────┬───────────────────────────────────────────────────┐
-- │ Table                           │ Level  │ Issue                                             │
-- ├─────────────────────────────────┼────────┼───────────────────────────────────────────────────┤
-- │ brain_actions                   │ WARN   │ INSERT WITH CHECK (true) — any role can insert    │
-- │ brain_activity_log              │ WARN   │ INSERT WITH CHECK (true) — any role can insert    │
-- │ brain_processing_queue          │ WARN   │ INSERT WITH CHECK (true) — any role can insert    │
-- │ brain_processing_queue          │ WARN   │ UPDATE USING (true) — any role can update         │
-- │ chat_digests                    │ WARN   │ INSERT WITH CHECK (true) — any role can insert    │
-- │ chat_digests                    │ WARN   │ UPDATE USING (true) — any role can update         │
-- │ project_context_snapshots       │ WARN   │ INSERT WITH CHECK (true) — any role can insert    │
-- │ project_context_snapshots       │ WARN   │ UPDATE USING (true) — any role can update         │
-- │ project_contributions           │ INFO   │ RLS enabled but no policies exist                 │
-- │ project_milestones              │ INFO   │ RLS enabled but no policies exist                 │
-- │ auth.leaked_password_protection │ WARN   │ Disabled (must enable via Supabase Dashboard)     │
-- └─────────────────────────────────┴────────┴───────────────────────────────────────────────────┘
--
-- Root cause: brain_processing_queue trigger `increment_brain_queue()` fires
-- AFTER INSERT on chat_messages as the calling user (authenticated role).
-- Previous fix (028) added WITH CHECK (true) to let the trigger work.
--
-- Solution: Make the trigger function SECURITY DEFINER so it runs with the
-- function owner's privileges (postgres), bypassing RLS entirely.
-- Then we can safely remove all overly permissive INSERT/UPDATE policies.
-- Edge functions already use service_role key which bypasses RLS.

-- ============================================================
-- 1. CRITICAL: Make increment_brain_queue() SECURITY DEFINER
--    so the trigger bypasses RLS regardless of calling user.
--    Also set search_path for safety.
-- ============================================================
CREATE OR REPLACE FUNCTION increment_brain_queue()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process messages in rooms (not direct messages without rooms)
  -- Skip bot messages (brain bot user)
  IF NEW.room_id IS NOT NULL AND NEW.user_id != '00000000-0000-0000-0000-000000000099' THEN
    INSERT INTO brain_processing_queue (room_id, project_id, pending_message_count)
    VALUES (NEW.room_id, NEW.project_id, 1)
    ON CONFLICT (room_id) DO UPDATE
    SET pending_message_count = brain_processing_queue.pending_message_count + 1,
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. brain_processing_queue — Remove overly permissive policies
--    Trigger now runs as SECURITY DEFINER (bypasses RLS).
--    Edge functions use service_role (bypasses RLS).
--    Only authenticated SELECT is needed for clients.
-- ============================================================
DO $$
BEGIN
  -- Drop the overly permissive INSERT/UPDATE policies added in 028
  DROP POLICY IF EXISTS "Trigger can insert queue entries" ON brain_processing_queue;
  DROP POLICY IF EXISTS "Trigger can update queue entries" ON brain_processing_queue;

  -- SELECT policy already exists from 027, ensure it's correct
  DROP POLICY IF EXISTS "Authenticated users can view queue" ON brain_processing_queue;
  CREATE POLICY "Authenticated users can view queue" ON brain_processing_queue
    FOR SELECT USING ((select auth.role()) = 'authenticated');
END $$;

-- ============================================================
-- 3. brain_actions — Remove overly permissive INSERT policy
--    Only edge functions (service_role) insert brain actions.
--    Authenticated users only need SELECT + UPDATE (confirm/reject).
-- ============================================================
DO $$
BEGIN
  -- Drop the WITH CHECK (true) INSERT policy
  DROP POLICY IF EXISTS "Service can insert brain actions" ON brain_actions;

  -- SELECT and UPDATE policies already exist from 027 with proper auth check
  -- Recreate them to ensure they're correct
  DROP POLICY IF EXISTS "Authenticated users can view brain actions" ON brain_actions;
  CREATE POLICY "Authenticated users can view brain actions" ON brain_actions
    FOR SELECT USING ((select auth.role()) = 'authenticated');

  DROP POLICY IF EXISTS "Authenticated users can update brain actions" ON brain_actions;
  CREATE POLICY "Authenticated users can update brain actions" ON brain_actions
    FOR UPDATE USING ((select auth.role()) = 'authenticated');
END $$;

-- ============================================================
-- 4. brain_activity_log — Remove overly permissive INSERT policy
--    Only edge functions (service_role) insert activity logs.
-- ============================================================
DO $$
BEGIN
  -- Drop the WITH CHECK (true) INSERT policy
  DROP POLICY IF EXISTS "Service can insert activity log" ON brain_activity_log;

  -- SELECT policy already exists, ensure it's correct
  DROP POLICY IF EXISTS "Authenticated users can view activity log" ON brain_activity_log;
  CREATE POLICY "Authenticated users can view activity log" ON brain_activity_log
    FOR SELECT USING ((select auth.role()) = 'authenticated');
END $$;

-- ============================================================
-- 5. chat_digests — Remove overly permissive INSERT/UPDATE policies
--    Only edge functions (service_role) manage digests.
-- ============================================================
DO $$
BEGIN
  -- Drop WITH CHECK (true) policies added in 028
  DROP POLICY IF EXISTS "Service can insert digests" ON chat_digests;
  DROP POLICY IF EXISTS "Service can update digests" ON chat_digests;

  -- SELECT policy already exists, ensure it's correct
  DROP POLICY IF EXISTS "Authenticated users can view digests" ON chat_digests;
  CREATE POLICY "Authenticated users can view digests" ON chat_digests
    FOR SELECT USING ((select auth.role()) = 'authenticated');
END $$;

-- ============================================================
-- 6. project_context_snapshots — Remove overly permissive INSERT/UPDATE
--    Only edge functions (service_role) manage context snapshots.
-- ============================================================
DO $$
BEGIN
  -- Drop WITH CHECK (true) policies added in 028
  DROP POLICY IF EXISTS "Service can insert context" ON project_context_snapshots;
  DROP POLICY IF EXISTS "Service can update context" ON project_context_snapshots;

  -- SELECT policy already exists, ensure it's correct
  DROP POLICY IF EXISTS "Authenticated users can view context" ON project_context_snapshots;
  CREATE POLICY "Authenticated users can view context" ON project_context_snapshots
    FOR SELECT USING ((select auth.role()) = 'authenticated');
END $$;

-- ============================================================
-- 7. project_milestones — Add missing RLS policies
--    (RLS enabled in 001 but no policies were ever created)
-- ============================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view milestones" ON project_milestones;
  CREATE POLICY "Authenticated users can view milestones" ON project_milestones
    FOR SELECT USING ((select auth.role()) = 'authenticated');

  DROP POLICY IF EXISTS "Authenticated users can insert milestones" ON project_milestones;
  CREATE POLICY "Authenticated users can insert milestones" ON project_milestones
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

  DROP POLICY IF EXISTS "Authenticated users can update milestones" ON project_milestones;
  CREATE POLICY "Authenticated users can update milestones" ON project_milestones
    FOR UPDATE USING ((select auth.role()) = 'authenticated');

  DROP POLICY IF EXISTS "Authenticated users can delete milestones" ON project_milestones;
  CREATE POLICY "Authenticated users can delete milestones" ON project_milestones
    FOR DELETE USING ((select auth.role()) = 'authenticated');
END $$;

-- ============================================================
-- 8. project_contributions — Add missing RLS policies
--    (RLS enabled in 001 but no policies were ever created)
-- ============================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view contributions" ON project_contributions;
  CREATE POLICY "Authenticated users can view contributions" ON project_contributions
    FOR SELECT USING ((select auth.role()) = 'authenticated');

  DROP POLICY IF EXISTS "Authenticated users can insert contributions" ON project_contributions;
  CREATE POLICY "Authenticated users can insert contributions" ON project_contributions
    FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

  DROP POLICY IF EXISTS "Authenticated users can update contributions" ON project_contributions;
  CREATE POLICY "Authenticated users can update contributions" ON project_contributions
    FOR UPDATE USING ((select auth.role()) = 'authenticated');

  DROP POLICY IF EXISTS "Authenticated users can delete contributions" ON project_contributions;
  CREATE POLICY "Authenticated users can delete contributions" ON project_contributions
    FOR DELETE USING ((select auth.role()) = 'authenticated');
END $$;

-- ============================================================
-- 9. auth.leaked_password_protection — CANNOT be fixed via SQL
--    Must be enabled via Supabase Dashboard:
--    Project Settings → Auth → Security → Enable "Leaked Password Protection"
-- ============================================================
-- NOTE: Go to https://supabase.com/dashboard/project/ciuzbyjiqvtkwdlqovst/settings/auth
-- and toggle ON "Leaked Password Protection" under the Security section.
