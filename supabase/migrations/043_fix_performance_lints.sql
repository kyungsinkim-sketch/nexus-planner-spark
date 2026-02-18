-- Migration 043: Fix Supabase Performance & Security Lints (2026-02-18)
--
-- Resolves ALL issues from Supabase Performance/Security Lint reports:
--
-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1: Unindexed Foreign Keys (14 items — INFO/PERFORMANCE)
-- ═══════════════════════════════════════════════════════════════════
-- Foreign keys without covering indexes cause slow DELETE/UPDATE on
-- the parent table (sequential scan of child table to check refs).
--
-- ┌──────────────────────────────┬──────────────────────────────────────────────────┐
-- │ Table                        │ Foreign Key                                      │
-- ├──────────────────────────────┼──────────────────────────────────────────────────┤
-- │ brain_actions                │ brain_actions_confirmed_by_fkey                  │
-- │ brain_processing_queue       │ brain_processing_queue_project_id_fkey           │
-- │ chat_rooms                   │ chat_rooms_created_by_fkey                       │
-- │ file_items                   │ file_items_uploaded_by_fkey                      │
-- │ notifications (×3)           │ from_user_id, project_id, user_id                │
-- │ peer_feedback (×2)           │ from_user_id, to_user_id                         │
-- │ personal_todos               │ requested_by_id                                  │
-- │ portfolio_items              │ project_id                                       │
-- │ project_contributions        │ user_id                                          │
-- │ project_milestones           │ project_id                                       │
-- │ projects                     │ completion_approved_by                            │
-- └──────────────────────────────┴──────────────────────────────────────────────────┘
--
-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2: Unused Indexes (35 items — INFO/PERFORMANCE)
-- ═══════════════════════════════════════════════════════════════════
-- Indexes that have never been used waste storage and slow writes.
-- Safe to drop since they've had zero scans since creation.
--
-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3: Duplicate Permissive RLS Policies (5 items — WARN)
-- ═══════════════════════════════════════════════════════════════════
-- google_calendar_sync_tokens has overlapping SELECT policies:
--   "Users can manage own sync tokens" (FOR ALL) covers SELECT already,
--   "Users can view own sync tokens" (FOR SELECT) is redundant.
-- Multiple permissive policies = each evaluated on every query = slower.
--

BEGIN;

-- ============================================================
-- SECTION 1: ADD MISSING FOREIGN KEY INDEXES
-- ============================================================
-- Naming convention: idx_{table}_{column}

-- brain_actions.confirmed_by
CREATE INDEX IF NOT EXISTS idx_brain_actions_confirmed_by
  ON public.brain_actions (confirmed_by);

-- brain_processing_queue.project_id
CREATE INDEX IF NOT EXISTS idx_brain_processing_queue_project_id
  ON public.brain_processing_queue (project_id);

-- chat_rooms.created_by
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by
  ON public.chat_rooms (created_by);

-- file_items.uploaded_by
CREATE INDEX IF NOT EXISTS idx_file_items_uploaded_by
  ON public.file_items (uploaded_by);

-- notifications: 3 foreign keys
CREATE INDEX IF NOT EXISTS idx_notifications_from_user_id
  ON public.notifications (from_user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_project_id
  ON public.notifications (project_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id);

-- peer_feedback: 2 foreign keys
CREATE INDEX IF NOT EXISTS idx_peer_feedback_from_user_id
  ON public.peer_feedback (from_user_id);

CREATE INDEX IF NOT EXISTS idx_peer_feedback_to_user_id
  ON public.peer_feedback (to_user_id);

-- personal_todos.requested_by_id
CREATE INDEX IF NOT EXISTS idx_personal_todos_requested_by_id
  ON public.personal_todos (requested_by_id);

-- portfolio_items.project_id
CREATE INDEX IF NOT EXISTS idx_portfolio_items_project_id
  ON public.portfolio_items (project_id);

-- project_contributions.user_id
CREATE INDEX IF NOT EXISTS idx_project_contributions_user_id
  ON public.project_contributions (user_id);

-- project_milestones.project_id
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id
  ON public.project_milestones (project_id);

-- projects.completion_approved_by
CREATE INDEX IF NOT EXISTS idx_projects_completion_approved_by
  ON public.projects (completion_approved_by);


-- ============================================================
-- SECTION 2: DROP UNUSED INDEXES
-- ============================================================
-- These indexes have never been used (0 scans since creation).
-- Removing them saves storage and speeds up INSERT/UPDATE/DELETE.

-- nexus_attendance (3 unused indexes)
DROP INDEX IF EXISTS public.idx_attendance_status;
DROP INDEX IF EXISTS public.idx_attendance_user_date;
DROP INDEX IF EXISTS public.idx_attendance_date;

-- projects (4 unused indexes)
DROP INDEX IF EXISTS public.idx_projects_dates;
DROP INDEX IF EXISTS public.idx_projects_status;
DROP INDEX IF EXISTS public.idx_projects_pm_id;
DROP INDEX IF EXISTS public.idx_projects_team_member_ids;

-- calendar_events
DROP INDEX IF EXISTS public.idx_calendar_events_project;

-- performance_snapshots
DROP INDEX IF EXISTS public.idx_performance_user;

-- portfolio_items (drop old unused, new FK index added above)
DROP INDEX IF EXISTS public.idx_portfolio_user;

-- project_contributions (drop old unused, new FK index added above)
DROP INDEX IF EXISTS public.idx_contributions_project;

-- training_sessions (3 unused indexes)
DROP INDEX IF EXISTS public.idx_training_sessions_user_id;
DROP INDEX IF EXISTS public.idx_training_sessions_date;
DROP INDEX IF EXISTS public.idx_training_sessions_date_time;

-- brain_actions (1 unused — note: we just added a different idx above)
DROP INDEX IF EXISTS public.idx_brain_actions_status;

-- locker_assignments
DROP INDEX IF EXISTS public.idx_locker_assignments_user_id;

-- completion_reviews (3 unused indexes)
DROP INDEX IF EXISTS public.idx_completion_reviews_project;
DROP INDEX IF EXISTS public.idx_completion_reviews_from;
DROP INDEX IF EXISTS public.idx_completion_reviews_to;

-- chat_digests (4 unused indexes)
DROP INDEX IF EXISTS public.idx_chat_digests_room;
DROP INDEX IF EXISTS public.idx_chat_digests_project;
DROP INDEX IF EXISTS public.idx_chat_digests_type;
DROP INDEX IF EXISTS public.idx_chat_digests_created;

-- brain_activity_log (3 unused indexes)
DROP INDEX IF EXISTS public.idx_brain_activity_log_project;
DROP INDEX IF EXISTS public.idx_brain_activity_log_type;
DROP INDEX IF EXISTS public.idx_brain_activity_log_created;

-- personal_todos (3 unused indexes — note: new FK idx_personal_todos_requested_by_id is different)
DROP INDEX IF EXISTS public.idx_personal_todos_assignees;
DROP INDEX IF EXISTS public.idx_personal_todos_status;
DROP INDEX IF EXISTS public.idx_personal_todos_project;

-- peer_feedback (1 unused — note: new FK indexes above are on different columns)
DROP INDEX IF EXISTS public.idx_feedback_project;

-- annual_financials
DROP INDEX IF EXISTS public.idx_annual_financials_year;

-- chat_room_members
DROP INDEX IF EXISTS public.idx_chat_room_members_room;

-- file_comments
DROP INDEX IF EXISTS public.idx_file_comments_created_at;

-- project_financials (2 unused indexes)
DROP INDEX IF EXISTS public.idx_project_financials_project;
DROP INDEX IF EXISTS public.idx_project_financials_status;


-- ============================================================
-- SECTION 3: FIX DUPLICATE PERMISSIVE RLS POLICIES
-- ============================================================
-- google_calendar_sync_tokens currently has:
--   1) "Users can view own sync tokens"   → FOR SELECT
--   2) "Users can manage own sync tokens" → FOR ALL (covers SELECT too)
--
-- This causes duplicate permissive evaluation on every SELECT.
-- Solution: Drop the FOR ALL policy and create explicit per-action policies.
-- This way each action has exactly ONE permissive policy.

-- Drop both existing overlapping policies
DROP POLICY IF EXISTS "Users can view own sync tokens" ON public.google_calendar_sync_tokens;
DROP POLICY IF EXISTS "Users can manage own sync tokens" ON public.google_calendar_sync_tokens;

-- Recreate with explicit per-action policies (no overlap)
CREATE POLICY "Users can view own sync tokens" ON public.google_calendar_sync_tokens
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own sync tokens" ON public.google_calendar_sync_tokens
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own sync tokens" ON public.google_calendar_sync_tokens
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own sync tokens" ON public.google_calendar_sync_tokens
  FOR DELETE USING (user_id = (select auth.uid()));

COMMIT;
