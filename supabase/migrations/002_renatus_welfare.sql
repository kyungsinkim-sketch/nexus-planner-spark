-- ============================================
-- RENATUS WELFARE MANAGEMENT SCHEMA
-- Migration: 002_renatus_welfare
-- Description: Training sessions and locker assignments for Renatus gym
-- ============================================

-- ============================================
-- TRAINING SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL CHECK (
    time_slot IN (
      '오전 9시', '오전 10시', '오전 11시', '오후 12시',
      '오후 1시', '오후 2시', '오후 3시', '오후 4시', '오후 5시'
    )
  ),
  exercise_content TEXT,
  trainer_confirmed BOOLEAN DEFAULT FALSE,
  trainee_confirmed BOOLEAN DEFAULT FALSE,
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure only one session per time slot (1 person per hour limit)
  UNIQUE(date, time_slot)
);

-- ============================================
-- LOCKER ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS locker_assignments (
  locker_number INTEGER PRIMARY KEY CHECK (locker_number >= 1 AND locker_number <= 25),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one locker per user
  UNIQUE(user_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Training sessions indexes
CREATE INDEX IF NOT EXISTS idx_training_sessions_user_id ON training_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON training_sessions(date);
CREATE INDEX IF NOT EXISTS idx_training_sessions_date_time ON training_sessions(date, time_slot);
CREATE INDEX IF NOT EXISTS idx_training_sessions_calendar_event ON training_sessions(calendar_event_id);

-- Locker assignments indexes
CREATE INDEX IF NOT EXISTS idx_locker_assignments_user_id ON locker_assignments(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE locker_assignments ENABLE ROW LEVEL SECURITY;

-- Training sessions policies
CREATE POLICY "Users can view all training sessions" ON training_sessions 
  FOR SELECT USING (true);

CREATE POLICY "Users can create own training sessions" ON training_sessions 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can create any training session" ON training_sessions 
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Users can update own training sessions" ON training_sessions 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any training session" ON training_sessions 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

CREATE POLICY "Users can delete own training sessions" ON training_sessions 
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any training session" ON training_sessions 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- Locker assignments policies
CREATE POLICY "Users can view all locker assignments" ON locker_assignments 
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage locker assignments" ON locker_assignments 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger for updated_at on training_sessions
CREATE TRIGGER update_training_sessions_updated_at 
  BEFORE UPDATE ON training_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on locker_assignments
CREATE TRIGGER update_locker_assignments_updated_at 
  BEFORE UPDATE ON locker_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get user's monthly training count
CREATE OR REPLACE FUNCTION get_user_monthly_training_count(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM training_sessions
    WHERE user_id = p_user_id
      AND EXTRACT(YEAR FROM date) = p_year
      AND EXTRACT(MONTH FROM date) = p_month
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's total training count
CREATE OR REPLACE FUNCTION get_user_total_training_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM training_sessions
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get available lockers
CREATE OR REPLACE FUNCTION get_available_lockers()
RETURNS TABLE(locker_number INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT generate_series AS locker_number
  FROM generate_series(1, 25)
  WHERE generate_series NOT IN (
    SELECT la.locker_number FROM locker_assignments la
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE training_sessions IS 'Stores Renatus gym training session bookings';
COMMENT ON TABLE locker_assignments IS 'Stores locker assignments for gym members';

COMMENT ON COLUMN training_sessions.time_slot IS 'Time slot in Korean format (e.g., 오전 9시)';
COMMENT ON COLUMN training_sessions.calendar_event_id IS 'Reference to the calendar event created for this session';
COMMENT ON COLUMN locker_assignments.locker_number IS 'Locker number from 1 to 25';
