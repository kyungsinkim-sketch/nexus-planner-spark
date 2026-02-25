-- Migration 070: Push Notifications & Cross-Device Notification Read Sync
--
-- Tables:
--   1. device_tokens          — APNs/FCM device tokens per user
--   2. notification_read_state — Cross-device read/dismiss sync
--   3. push_notification_queue — Pending pushes (processed by Edge Function)
--
-- Triggers:
--   1. fn_queue_push_on_chat_message → queues push on chat_messages INSERT
--   2. fn_process_push_queue         → calls Edge Function via pg_net

-- ============================================
-- 1. DEVICE TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'macos')),
    token TEXT NOT NULL,
    environment TEXT CHECK (environment IN ('sandbox', 'production')),
    bundle_id TEXT DEFAULT 'io.re-be.app',
    device_name TEXT,
    app_version TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
    ON device_tokens(user_id) WHERE is_active = TRUE;

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own device tokens"
    ON device_tokens FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. NOTIFICATION READ STATE
-- ============================================
CREATE TABLE IF NOT EXISTS notification_read_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('chat', 'todo', 'event', 'brain', 'company')),
    source_id TEXT,
    project_id UUID,
    room_id TEXT,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_on_platform TEXT CHECK (read_on_platform IN ('ios', 'android', 'web', 'macos')),

    UNIQUE(user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_read_user_recent
    ON notification_read_state(user_id, read_at DESC);

ALTER TABLE notification_read_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own read state"
    ON notification_read_state FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Enable Realtime for cross-device sync
ALTER TABLE notification_read_state REPLICA IDENTITY FULL;

-- ============================================
-- 3. PUSH NOTIFICATION QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS push_notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_queue_pending
    ON push_notification_queue(status) WHERE status = 'pending';

ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;

-- Only service_role can access push queue (triggered by PG functions)
-- No user-facing policy needed.

-- ============================================
-- 4. TRIGGER: Queue push on chat_messages INSERT
-- ============================================
CREATE OR REPLACE FUNCTION fn_queue_push_on_chat_message()
RETURNS TRIGGER AS $$
DECLARE
    _sender_name TEXT;
    _project_title TEXT;
    _team_ids UUID[];
    _member_id UUID;
    _preview TEXT;
BEGIN
    -- Skip brain bot DM messages
    IF NEW.user_id = '00000000-0000-0000-0000-000000000099'
       AND NEW.direct_chat_user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Get sender name
    SELECT name INTO _sender_name FROM profiles WHERE id = NEW.user_id;

    -- Build message preview
    IF NEW.message_type IN ('brain_action', 'persona_response') THEN
        _preview := 'AI 응답이 도착했습니다';
    ELSIF NEW.message_type = 'file' THEN
        _preview := LEFT(NEW.content, 80);
    ELSIF NEW.message_type = 'location' THEN
        _preview := LEFT(NEW.content, 60);
    ELSIF NEW.message_type = 'schedule' THEN
        _preview := LEFT(NEW.content, 60);
    ELSIF NEW.message_type = 'decision' THEN
        _preview := LEFT(NEW.content, 60);
    ELSE
        _preview := LEFT(NEW.content, 100);
    END IF;

    -- DM: notify the recipient
    IF NEW.direct_chat_user_id IS NOT NULL THEN
        -- Don't push to sender
        IF NEW.direct_chat_user_id != NEW.user_id THEN
            INSERT INTO push_notification_queue (
                recipient_user_id, title, body, notification_type, payload
            ) VALUES (
                NEW.direct_chat_user_id,
                COALESCE(_sender_name, 'New message'),
                COALESCE(_preview, ''),
                'chat',
                jsonb_build_object(
                    'messageId', NEW.id::text,
                    'projectId', NEW.project_id::text,
                    'roomId', NEW.room_id,
                    'senderId', NEW.user_id::text,
                    'isDM', true
                )
            );
        END IF;
        RETURN NEW;
    END IF;

    -- Project chat: notify all team members except sender
    IF NEW.project_id IS NOT NULL THEN
        SELECT title, team_member_ids
        INTO _project_title, _team_ids
        FROM projects
        WHERE id = NEW.project_id;

        IF _team_ids IS NOT NULL THEN
            FOREACH _member_id IN ARRAY _team_ids LOOP
                IF _member_id != NEW.user_id THEN
                    INSERT INTO push_notification_queue (
                        recipient_user_id, title, body, notification_type, payload
                    ) VALUES (
                        _member_id,
                        COALESCE(_sender_name, 'New message') || COALESCE(' · ' || _project_title, ''),
                        COALESCE(_preview, ''),
                        'chat',
                        jsonb_build_object(
                            'messageId', NEW.id::text,
                            'projectId', NEW.project_id::text,
                            'roomId', NEW.room_id,
                            'senderId', NEW.user_id::text
                        )
                    );
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chat_message_push ON chat_messages;
CREATE TRIGGER trg_chat_message_push
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION fn_queue_push_on_chat_message();

-- ============================================
-- 5. TRIGGER: Process push queue via pg_net
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION fn_process_push_queue()
RETURNS TRIGGER AS $$
DECLARE
    _supabase_url TEXT;
    _service_key TEXT;
BEGIN
    -- Read settings (set via: ALTER DATABASE postgres SET app.settings.supabase_url = '...')
    _supabase_url := current_setting('app.settings.supabase_url', true);
    _service_key  := current_setting('app.settings.service_role_key', true);

    -- If settings not configured yet, skip silently
    IF _supabase_url IS NULL OR _service_key IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM net.http_post(
        url     := _supabase_url || '/functions/v1/push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _service_key
        ),
        body    := jsonb_build_object(
            'queueId', NEW.id::text,
            'recipientUserId', NEW.recipient_user_id::text,
            'title', NEW.title,
            'body', NEW.body,
            'notificationType', NEW.notification_type,
            'payload', NEW.payload
        )
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_process_push_queue ON push_notification_queue;
CREATE TRIGGER trg_process_push_queue
    AFTER INSERT ON push_notification_queue
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION fn_process_push_queue();
