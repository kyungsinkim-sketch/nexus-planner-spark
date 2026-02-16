-- URGENT FIX: brain_processing_queue RLS was too restrictive after migration 027
--
-- The trigger `increment_brain_queue` fires AFTER INSERT on chat_messages.
-- It runs as the calling user (authenticated role), NOT as service_role.
-- Migration 027 removed the "Service can manage queue" FOR ALL policy,
-- which broke the trigger's ability to INSERT/UPDATE the queue.
--
-- Fix: Add explicit INSERT and UPDATE policies for authenticated users
-- so the trigger can function. Also fix chat_digests and project_context_snapshots
-- which may need similar write access from triggers or edge functions.

-- ============================================================
-- brain_processing_queue: allow trigger to INSERT + UPDATE
-- ============================================================
DO $$
BEGIN
  -- Allow the trigger (running as authenticated) to insert new queue entries
  DROP POLICY IF EXISTS "Trigger can insert queue entries" ON brain_processing_queue;
  CREATE POLICY "Trigger can insert queue entries" ON brain_processing_queue
    FOR INSERT WITH CHECK (true);

  -- Allow the trigger to update queue counters (ON CONFLICT DO UPDATE)
  DROP POLICY IF EXISTS "Trigger can update queue entries" ON brain_processing_queue;
  CREATE POLICY "Trigger can update queue entries" ON brain_processing_queue
    FOR UPDATE USING (true);
END $$;

-- ============================================================
-- chat_digests: restore INSERT capability (for edge functions via service_role
-- this isn't strictly needed, but for safety add it back)
-- ============================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Service can insert digests" ON chat_digests;
  CREATE POLICY "Service can insert digests" ON chat_digests
    FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS "Service can update digests" ON chat_digests;
  CREATE POLICY "Service can update digests" ON chat_digests
    FOR UPDATE USING (true);
END $$;

-- ============================================================
-- project_context_snapshots: restore write capability
-- ============================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Service can insert context" ON project_context_snapshots;
  CREATE POLICY "Service can insert context" ON project_context_snapshots
    FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS "Service can update context" ON project_context_snapshots;
  CREATE POLICY "Service can update context" ON project_context_snapshots
    FOR UPDATE USING (true);
END $$;
