-- Migration 033: Add 'update_event' to brain_actions action_type CHECK constraint
--
-- The brain_actions.action_type column has a CHECK constraint that only allows:
--   'create_todo', 'create_event', 'share_location'
-- This migration adds 'update_event' to allow Brain AI to modify existing events.

-- Drop the old constraint and create a new one with 'update_event' added
ALTER TABLE brain_actions DROP CONSTRAINT IF EXISTS brain_actions_action_type_check;
ALTER TABLE brain_actions ADD CONSTRAINT brain_actions_action_type_check
  CHECK (action_type IN ('create_todo', 'create_event', 'update_event', 'share_location'));
