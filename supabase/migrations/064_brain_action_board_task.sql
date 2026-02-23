-- Migration 064: Add 'create_board_task' to brain_actions action_type CHECK constraint
--
-- Allows Brain AI to create project board tasks via chat commands.

ALTER TABLE brain_actions DROP CONSTRAINT IF EXISTS brain_actions_action_type_check;
ALTER TABLE brain_actions ADD CONSTRAINT brain_actions_action_type_check
  CHECK (action_type IN ('create_todo', 'create_event', 'update_event', 'share_location', 'submit_service_suggestion', 'create_board_task'));
