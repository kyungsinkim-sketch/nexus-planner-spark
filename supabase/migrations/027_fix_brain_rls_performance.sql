-- Fix RLS Performance & Security Lint issues for Brain AI tables
--
-- Issues addressed:
-- 1. auth_rls_initplan: Replace auth.role()/auth.uid() with (select auth.role())/(select auth.uid())
--    to prevent per-row re-evaluation (massive performance improvement at scale)
-- 2. multiple_permissive_policies: Remove overly permissive "Service can manage" policies
--    that used FOR ALL USING (true) which applies to ALL roles.
--    Edge functions use service_role which bypasses RLS entirely, so these are unnecessary.

-- ============================================================
-- 1. brain_actions — Fix auth.role() → (select auth.role())
-- ============================================================
DO $$
BEGIN
  -- Drop and recreate SELECT policy with subselect
  DROP POLICY IF EXISTS "Authenticated users can view brain actions" ON brain_actions;
  CREATE POLICY "Authenticated users can view brain actions" ON brain_actions
    FOR SELECT USING ((select auth.role()) = 'authenticated');

  -- Drop and recreate UPDATE policy with subselect
  DROP POLICY IF EXISTS "Authenticated users can update brain actions" ON brain_actions;
  CREATE POLICY "Authenticated users can update brain actions" ON brain_actions
    FOR UPDATE USING ((select auth.role()) = 'authenticated');

  -- INSERT policy stays as-is (WITH CHECK (true) is fine for service_role inserts)
END $$;

-- ============================================================
-- 2. chat_digests — Fix auth + remove duplicate permissive
-- ============================================================
DO $$
BEGIN
  -- Remove the overly permissive "Service can manage" policy
  -- (Edge functions use service_role which bypasses RLS — this policy is unnecessary
  -- and creates conflicting permissive policies for all roles)
  DROP POLICY IF EXISTS "Service can manage digests" ON chat_digests;

  -- Fix SELECT policy with subselect
  DROP POLICY IF EXISTS "Authenticated users can view digests" ON chat_digests;
  CREATE POLICY "Authenticated users can view digests" ON chat_digests
    FOR SELECT USING ((select auth.role()) = 'authenticated');

  -- Add explicit INSERT policy for service_role clarity (though service_role bypasses RLS)
  DROP POLICY IF EXISTS "Service can insert digests" ON chat_digests;
  CREATE POLICY "Service can insert digests" ON chat_digests
    FOR INSERT WITH CHECK (true);
END $$;

-- ============================================================
-- 3. brain_processing_queue — Fix auth + remove duplicate permissive
-- ============================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Service can manage queue" ON brain_processing_queue;

  DROP POLICY IF EXISTS "Authenticated users can view queue" ON brain_processing_queue;
  CREATE POLICY "Authenticated users can view queue" ON brain_processing_queue
    FOR SELECT USING ((select auth.role()) = 'authenticated');

  -- Queue updates happen via trigger (increment_brain_queue) which runs as definer,
  -- and via edge functions (service_role). No explicit UPDATE policy needed for clients.
END $$;

-- ============================================================
-- 4. project_context_snapshots — Fix auth + remove duplicate permissive
-- ============================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Service can manage context" ON project_context_snapshots;

  DROP POLICY IF EXISTS "Authenticated users can view context" ON project_context_snapshots;
  CREATE POLICY "Authenticated users can view context" ON project_context_snapshots
    FOR SELECT USING ((select auth.role()) = 'authenticated');
END $$;

-- ============================================================
-- 5. brain_activity_log — Fix auth
-- ============================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view activity log" ON brain_activity_log;
  CREATE POLICY "Authenticated users can view activity log" ON brain_activity_log
    FOR SELECT USING ((select auth.role()) = 'authenticated');

  -- INSERT stays as-is (WITH CHECK (true) for service_role/trigger inserts)
END $$;
