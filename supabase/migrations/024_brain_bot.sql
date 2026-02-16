-- Brain AI: Bot user, brain_actions table, message_type extension
-- Enables @brain mention in chat rooms to trigger AI-powered action extraction

-- 1. Insert bot system user into profiles
-- Note: profiles has FK to auth.users, so we need to handle this carefully.
-- We insert into auth.users first with a placeholder, then profiles.
DO $$
BEGIN
  -- Insert placeholder into auth.users if not exists
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'brain@re-be.io',
    '$2a$10$placeholder_not_a_real_hash_for_bot_user',
    NOW(),
    NOW(),
    NOW(),
    '',
    '{"provider":"email","providers":["email"]}',
    '{"name":"Re-Be Brain"}',
    false
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert bot profile
  INSERT INTO profiles (id, name, avatar, role, department)
  VALUES (
    '00000000-0000-0000-0000-000000000099',
    'Re-Be Brain',
    NULL,
    'MEMBER',
    'AI'
  ) ON CONFLICT (id) DO NOTHING;
END $$;

-- 2. Extend chat_messages message_type to include 'brain_action'
DO $$
BEGIN
  -- Add brain_action_data column for storing action proposals
  ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS brain_action_data JSONB;

  -- Drop existing constraint and recreate with brain_action
  ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;

  ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_message_type_check
    CHECK (message_type IN ('text','file','location','schedule','decision','brain_action'));
END $$;

-- 3. Create brain_actions table for tracking extracted actions
CREATE TABLE IF NOT EXISTS brain_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('create_todo','create_event','share_location')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','executed','failed')),
  extracted_data JSONB NOT NULL,
  executed_data JSONB,
  confirmed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

-- Indexes for brain_actions
CREATE INDEX IF NOT EXISTS idx_brain_actions_message_id ON brain_actions(message_id);
CREATE INDEX IF NOT EXISTS idx_brain_actions_status ON brain_actions(status);

-- 4. RLS for brain_actions
ALTER TABLE brain_actions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view brain actions (they'll see them through chat messages)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view brain actions" ON brain_actions;
  CREATE POLICY "Authenticated users can view brain actions" ON brain_actions
    FOR SELECT USING (auth.role() = 'authenticated');

  -- Only the bot or service role can insert brain actions
  DROP POLICY IF EXISTS "Service can insert brain actions" ON brain_actions;
  CREATE POLICY "Service can insert brain actions" ON brain_actions
    FOR INSERT WITH CHECK (true);

  -- Authenticated users can update brain actions (confirm/reject)
  DROP POLICY IF EXISTS "Authenticated users can update brain actions" ON brain_actions;
  CREATE POLICY "Authenticated users can update brain actions" ON brain_actions
    FOR UPDATE USING (auth.role() = 'authenticated');
END $$;

-- 5. Grant bot user permission to insert chat messages
-- The bot sends messages as itself, so the existing RLS INSERT policy
-- (user_id = auth.uid()) won't work for it since it's called from Edge Functions.
-- Edge Functions use the service_role key which bypasses RLS entirely,
-- so no additional policies are needed.
