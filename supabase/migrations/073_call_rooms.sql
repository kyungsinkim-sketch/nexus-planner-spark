-- 073: In-App Call — LiveKit room management + AI suggestion tracking

-- Call rooms table
CREATE TABLE IF NOT EXISTS call_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livekit_room_name TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended', 'processing', 'completed')),
  recording_type TEXT NOT NULL DEFAULT 'online_meeting' CHECK (recording_type IN ('phone_call', 'offline_meeting', 'online_meeting', 'manual')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  -- LiveKit egress
  egress_id TEXT,
  recording_url TEXT,
  -- Pipeline tracking
  voice_recording_id UUID REFERENCES voice_recordings(id),
  analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'transcribing', 'analyzing', 'suggesting', 'completed', 'error')),
  -- Metadata
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Call participants
CREATE TABLE IF NOT EXISTS call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES call_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  role TEXT DEFAULT 'participant' CHECK (role IN ('host', 'participant'))
);

-- AI suggestions from call analysis
CREATE TABLE IF NOT EXISTS call_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES call_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('event', 'todo', 'note')),
  title TEXT NOT NULL,
  description TEXT,
  -- Event-specific
  event_start TIMESTAMPTZ,
  event_end TIMESTAMPTZ,
  event_attendees UUID[],
  -- Todo-specific
  todo_assignee_id UUID REFERENCES auth.users(id),
  todo_due_date DATE,
  todo_priority TEXT CHECK (todo_priority IN ('LOW', 'MEDIUM', 'HIGH')),
  -- Note-specific
  note_category TEXT CHECK (note_category IN ('decision', 'risk', 'budget', 'key_quote', 'followup')),
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'modified')),
  accepted_at TIMESTAMPTZ,
  -- Reference to created item
  created_item_id TEXT, -- could be event_id, todo_id, or note_id
  created_item_type TEXT,
  -- Metadata
  confidence REAL DEFAULT 0.7,
  source_quote TEXT, -- transcript excerpt that triggered this suggestion
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_call_rooms_created_by ON call_rooms(created_by);
CREATE INDEX idx_call_rooms_status ON call_rooms(status);
CREATE INDEX idx_call_participants_room ON call_participants(room_id);
CREATE INDEX idx_call_participants_user ON call_participants(user_id);
CREATE INDEX idx_call_suggestions_room ON call_suggestions(room_id);
CREATE INDEX idx_call_suggestions_user_status ON call_suggestions(user_id, status);

-- RLS
ALTER TABLE call_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies: users can see rooms they participate in
CREATE POLICY "Users can view their call rooms" ON call_rooms
  FOR SELECT USING (
    created_by = auth.uid() OR
    id IN (SELECT room_id FROM call_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create call rooms" ON call_rooms
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Room creator can update" ON call_rooms
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Participants can view" ON call_participants
  FOR SELECT USING (
    user_id = auth.uid() OR
    room_id IN (SELECT id FROM call_rooms WHERE created_by = auth.uid())
  );

CREATE POLICY "Room host can add participants" ON call_participants
  FOR INSERT WITH CHECK (
    room_id IN (SELECT id FROM call_rooms WHERE created_by = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can view their suggestions" ON call_suggestions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their suggestions" ON call_suggestions
  FOR UPDATE USING (user_id = auth.uid());

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access rooms" ON call_rooms
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access participants" ON call_participants
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access suggestions" ON call_suggestions
  FOR ALL USING (auth.role() = 'service_role');
