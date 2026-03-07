-- Migration 084: Add reply_to_message_id for message quoting/replying
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply ON chat_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
