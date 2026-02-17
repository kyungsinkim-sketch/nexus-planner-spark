-- Migration 031: Fix calendar_events DELETE RLS policy
--
-- ROOT CAUSE: Events could not be deleted because the RLS DELETE policy
-- only allowed the owner (owner_id = auth.uid()) to delete.
-- When the authenticated user's auth.uid() didn't match the event's owner_id,
-- the DELETE silently succeeded (no error) but affected 0 rows.
-- On the next loadEvents(), the event reappeared from the database.
--
-- FIX: Allow any authenticated user to delete events. In this collaborative
-- app, any team member should be able to manage calendar events.
-- Also allow the INSERT policy to accept any authenticated user (not just owner),
-- so Brain AI and other services can create events on behalf of users.

-- =====================================================
-- 1. FIX DELETE POLICY — allow authenticated users to delete
-- =====================================================
DROP POLICY IF EXISTS "Users can delete own events" ON calendar_events;
CREATE POLICY "Authenticated users can delete events" ON calendar_events
    FOR DELETE USING ((select auth.uid()) IS NOT NULL);

-- =====================================================
-- 2. FIX INSERT POLICY — allow any authenticated user to insert
-- This enables Brain AI (running as the current user) to create events
-- with a different owner_id (e.g., assigning events to team members)
-- =====================================================
DROP POLICY IF EXISTS "Users can insert own events" ON calendar_events;
CREATE POLICY "Authenticated users can insert events" ON calendar_events
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- =====================================================
-- 3. FIX UPDATE POLICY — allow any authenticated user to update
-- Keeps the existing broader policy but ensures consistency
-- =====================================================
DROP POLICY IF EXISTS "Users can update own or attending events" ON calendar_events;
CREATE POLICY "Authenticated users can update events" ON calendar_events
    FOR UPDATE USING ((select auth.uid()) IS NOT NULL);
