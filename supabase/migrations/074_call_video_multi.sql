-- 074: Add video call flag + multi-party support

-- Add is_video column to call_rooms
ALTER TABLE call_rooms ADD COLUMN IF NOT EXISTS is_video BOOLEAN DEFAULT false;

-- Allow multiple participants (index for faster queries)
CREATE INDEX IF NOT EXISTS idx_call_participants_room_user ON call_participants(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_call_rooms_status ON call_rooms(status);
