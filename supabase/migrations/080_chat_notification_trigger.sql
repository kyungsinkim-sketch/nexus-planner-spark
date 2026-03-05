-- Migration 080: Auto-create notification when a chat message is inserted
-- This bridges chat_messages → notifications table so InboxPage shows chat alerts.

CREATE OR REPLACE FUNCTION notify_on_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  proj_title TEXT;
  recipient RECORD;
  msg_preview TEXT;
  notif_title TEXT;
BEGIN
  -- Skip bot messages (Brain AI)
  IF NEW.user_id = '00000000-0000-0000-0000-000000000099' THEN
    RETURN NEW;
  END IF;

  -- Get sender name
  SELECT name INTO sender_name FROM profiles WHERE id = NEW.user_id;
  IF sender_name IS NULL THEN sender_name := 'Unknown'; END IF;

  -- Build preview (truncate to 100 chars)
  msg_preview := LEFT(NEW.content, 100);
  IF NEW.message_type = 'file' THEN
    msg_preview := '📎 ' || LEFT(NEW.content, 80);
  END IF;

  -- === Direct messages ===
  IF NEW.direct_chat_user_id IS NOT NULL THEN
    -- Notify the recipient (not the sender)
    IF NEW.direct_chat_user_id != NEW.user_id THEN
      INSERT INTO notifications (type, title, description, from_user_id, user_id, project_id)
      VALUES (
        'message',
        sender_name,
        msg_preview,
        NEW.user_id,
        NEW.direct_chat_user_id,
        NULL
      );
    END IF;
    RETURN NEW;
  END IF;

  -- === Project/room messages ===
  -- Get project title
  IF NEW.project_id IS NOT NULL THEN
    SELECT title INTO proj_title FROM projects WHERE id = NEW.project_id;
  END IF;
  notif_title := COALESCE(proj_title, 'Chat') || ' · ' || sender_name;

  -- Notify all project team members except sender
  IF NEW.project_id IS NOT NULL THEN
    FOR recipient IN
      SELECT unnest(team_member_ids) AS uid FROM projects WHERE id = NEW.project_id
    LOOP
      IF recipient.uid != NEW.user_id THEN
        INSERT INTO notifications (type, title, description, from_user_id, user_id, project_id)
        VALUES (
          'message',
          notif_title,
          msg_preview,
          NEW.user_id,
          recipient.uid,
          NEW.project_id
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_chat_notification ON chat_messages;
CREATE TRIGGER trg_chat_notification
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_chat_message();
