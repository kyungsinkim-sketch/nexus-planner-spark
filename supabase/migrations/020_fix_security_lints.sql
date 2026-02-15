-- Migration 020: Fix Supabase Security Lints
-- Fixes: 1 ERROR + 10 WARNINGs + 2 RLS warnings

-- ============================================================
-- 1. FIX ERROR: attendance_monthly_summary SECURITY DEFINER view
-- The view enforces RLS of the view creator, not the querying user.
-- Recreate as SECURITY INVOKER (default) so RLS applies per user.
-- ============================================================
DROP VIEW IF EXISTS attendance_monthly_summary;
CREATE VIEW attendance_monthly_summary AS
SELECT
    user_id,
    DATE_TRUNC('month', work_date) AS month,
    COUNT(*) FILTER (WHERE status = 'completed') AS days_worked,
    COUNT(*) FILTER (WHERE check_in_type = 'remote') AS remote_days,
    COUNT(*) FILTER (WHERE check_in_type = 'overseas') AS overseas_days,
    COUNT(*) FILTER (WHERE check_in_type = 'filming') AS filming_days,
    SUM(working_minutes) AS total_minutes,
    ROUND(AVG(working_minutes)) AS avg_minutes_per_day
FROM nexus_attendance
WHERE status IN ('completed', 'early_leave')
GROUP BY user_id, DATE_TRUNC('month', work_date);

-- ============================================================
-- 2. FIX WARNINGs: Function search_path mutable (10 functions)
-- Set search_path to '' for all functions to prevent search_path attacks
-- ============================================================

-- 2a. sync_default_room_members
CREATE OR REPLACE FUNCTION sync_default_room_members()
RETURNS TRIGGER AS $$
DECLARE
    default_room_id UUID;
    member_id UUID;
BEGIN
    SELECT id INTO default_room_id
    FROM public.chat_rooms
    WHERE project_id = NEW.id AND is_default = TRUE
    LIMIT 1;

    IF default_room_id IS NOT NULL AND NEW.team_member_ids IS NOT NULL THEN
        FOREACH member_id IN ARRAY NEW.team_member_ids
        LOOP
            INSERT INTO public.chat_room_members (room_id, user_id)
            VALUES (default_room_id, member_id)
            ON CONFLICT (room_id, user_id) DO NOTHING;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2b. update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2c. handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, role)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'New User'), 'MEMBER');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2d. get_user_monthly_training_count
CREATE OR REPLACE FUNCTION get_user_monthly_training_count(p_user_id UUID, p_year INT, p_month INT)
RETURNS INTEGER AS $$
DECLARE
    training_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO training_count
    FROM public.calendar_events
    WHERE type = 'R_TRAINING'
    AND owner_id = p_user_id
    AND EXTRACT(YEAR FROM start_at) = p_year
    AND EXTRACT(MONTH FROM start_at) = p_month;
    RETURN COALESCE(training_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2e. get_user_total_training_count
CREATE OR REPLACE FUNCTION get_user_total_training_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    training_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO training_count
    FROM public.calendar_events
    WHERE type = 'R_TRAINING'
    AND owner_id = p_user_id;
    RETURN COALESCE(training_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2f. get_available_lockers
CREATE OR REPLACE FUNCTION get_available_lockers()
RETURNS TABLE (locker_number INT) AS $$
BEGIN
    RETURN QUERY
    SELECT l.locker_number
    FROM public.lockers l
    WHERE l.assigned_to IS NULL
    ORDER BY l.locker_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2g. update_attendance_updated_at
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2h. get_today_attendance
CREATE OR REPLACE FUNCTION get_today_attendance(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    check_in_at TIMESTAMPTZ,
    check_in_type TEXT,
    check_out_at TIMESTAMPTZ,
    status TEXT,
    working_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.check_in_at,
        a.check_in_type,
        a.check_out_at,
        a.status,
        a.working_minutes
    FROM public.nexus_attendance a
    WHERE a.user_id = p_user_id
    AND a.work_date = CURRENT_DATE
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2i. create_default_chat_room
CREATE OR REPLACE FUNCTION create_default_chat_room()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.chat_rooms (project_id, name, description, is_default, created_by)
    VALUES (NEW.id, '전체', '프로젝트 전체 채팅방', TRUE, NEW.pm_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2j. create_user_if_not_exists
CREATE OR REPLACE FUNCTION create_user_if_not_exists(
    p_email TEXT,
    p_name TEXT,
    p_role TEXT DEFAULT 'MEMBER'
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM public.profiles WHERE name = p_name LIMIT 1;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
    END IF;
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================
-- 3. FIX WARNINGs: RLS policies always true for INSERT
-- Restrict INSERT to authenticated users instead of true
-- ============================================================

-- 3a. notifications: restrict INSERT to authenticated users
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
CREATE POLICY "Authenticated users can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 3b. personal_todos: restrict INSERT to own todos only
DROP POLICY IF EXISTS "Users can create todos" ON personal_todos;
CREATE POLICY "Users can create own todos"
    ON personal_todos FOR INSERT
    WITH CHECK (auth.uid() = user_id);
