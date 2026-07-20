-- 105_group_room_push.sql
--
-- Fix: pure group-room chat messages (room_id set, project_id NULL, not a DM)
-- never queued a push notification. The original trigger
-- (fn_queue_push_on_chat_message, migration 070) only branched on
-- direct_chat_user_id (DM) and project_id (project chat), so messages sent in
-- a standalone group room like "전체 / Paulus All" reached no one via push.
--
-- This replaces the function, adding a group-room branch as an ELSIF after the
-- project branch (ELSIF, not IF, so project rooms — which also have a room_id —
-- are never double-notified). Group-room recipients come from chat_room_members.

CREATE OR REPLACE FUNCTION fn_queue_push_on_chat_message()
RETURNS TRIGGER AS $$
DECLARE
    _sender_name TEXT;
    _project_title TEXT;
    _team_ids UUID[];
    _member_id UUID;
    _room_name TEXT;
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

    -- Pure group room (no project): notify all room members except sender.
    -- ELSIF (not IF) so project rooms — which also carry a room_id — are not
    -- double-notified here.
    ELSIF NEW.room_id IS NOT NULL THEN
        SELECT name INTO _room_name FROM chat_rooms WHERE id = NEW.room_id;

        INSERT INTO push_notification_queue (
            recipient_user_id, title, body, notification_type, payload
        )
        SELECT
            crm.user_id,
            COALESCE(_sender_name, 'New message') || COALESCE(' · ' || _room_name, ''),
            COALESCE(_preview, ''),
            'chat',
            jsonb_build_object(
                'messageId', NEW.id::text,
                'projectId', NULL,
                'roomId', NEW.room_id,
                'senderId', NEW.user_id::text
            )
        FROM chat_room_members crm
        WHERE crm.room_id = NEW.room_id
          AND crm.user_id != NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
