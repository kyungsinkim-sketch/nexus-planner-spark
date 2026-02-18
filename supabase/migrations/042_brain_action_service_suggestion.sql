-- Migration 042: Add 'submit_service_suggestion' to brain_actions action_type CHECK constraint
--
-- The brain_actions.action_type column has a CHECK constraint that only allows:
--   'create_todo', 'create_event', 'update_event', 'share_location'
-- This migration adds 'submit_service_suggestion' for the Brain Report feature.

ALTER TABLE brain_actions DROP CONSTRAINT IF EXISTS brain_actions_action_type_check;
ALTER TABLE brain_actions ADD CONSTRAINT brain_actions_action_type_check
  CHECK (action_type IN ('create_todo', 'create_event', 'update_event', 'share_location', 'submit_service_suggestion'));
