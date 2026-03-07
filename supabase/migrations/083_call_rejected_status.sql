-- Migration 083: Add 'rejected' to call_rooms status
ALTER TABLE call_rooms DROP CONSTRAINT IF EXISTS call_rooms_status_check;
ALTER TABLE call_rooms ADD CONSTRAINT call_rooms_status_check
  CHECK (status IN ('waiting', 'active', 'ended', 'processing', 'completed', 'rejected'));
