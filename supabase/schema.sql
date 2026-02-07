-- Nexus Planner Database Schema
-- This SQL file creates all necessary tables for the Nexus Planner application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MANAGER', 'MEMBER')),
  department TEXT,
  work_status TEXT NOT NULL DEFAULT 'NOT_AT_WORK' CHECK (work_status IN ('AT_WORK', 'NOT_AT_WORK', 'LUNCH', 'TRAINING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  type TEXT CHECK (type IN ('BIDDING', 'EXECUTION')),
  priority TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  description TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  pm_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  team_member_ids UUID[] DEFAULT '{}',
  last_activity_at TIMESTAMPTZ,
  health_schedule TEXT CHECK (health_schedule IN ('ON_TRACK', 'AT_RISK', 'DELAYED')),
  health_workload TEXT CHECK (health_workload IN ('BALANCED', 'OVERLOADED')),
  health_budget TEXT CHECK (health_budget IN ('HEALTHY', 'TIGHT')),
  tasks_completed INTEGER DEFAULT 0,
  tasks_total INTEGER DEFAULT 0,
  budget NUMERIC,
  currency TEXT DEFAULT 'KRW' CHECK (currency IN ('KRW', 'USD')),
  is_locked BOOLEAN DEFAULT FALSE,
  feedback_status TEXT CHECK (feedback_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  thumbnail TEXT,
  key_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PROJECT MILESTONES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  order_no INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CALENDAR EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('TASK', 'DEADLINE', 'MEETING', 'PT', 'DELIVERY', 'TODO', 'DELIVERABLE', 'R_TRAINING')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'PAULUS' CHECK (source IN ('PAULUS', 'GOOGLE')),
  google_event_id TEXT,
  todo_id UUID,
  deliverable_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CHAT MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  attachment_id UUID,
  direct_chat_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- FILE GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS file_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('DECK', 'FINAL', 'REFERENCE', 'CONTRACT', 'ETC')),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- FILE ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS file_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_group_id UUID NOT NULL REFERENCES file_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  size TEXT,
  type TEXT,
  is_important BOOLEAN DEFAULT FALSE,
  source TEXT CHECK (source IN ('UPLOAD', 'CHAT')),
  comment TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PERSONAL TODOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS personal_todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  assignee_ids UUID[] NOT NULL DEFAULT '{}',
  requested_by_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  due_date TIMESTAMPTZ NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  completed_at TIMESTAMPTZ,
  source_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PERFORMANCE SNAPSHOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS performance_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  total_score NUMERIC NOT NULL,
  financial_score NUMERIC NOT NULL,
  peer_score NUMERIC NOT NULL,
  rank INTEGER NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period)
);

-- ============================================
-- PORTFOLIO ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_title TEXT NOT NULL,
  client TEXT NOT NULL,
  role TEXT NOT NULL,
  thumbnail TEXT,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PEER FEEDBACK TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS peer_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, from_user_id, to_user_id)
);

-- ============================================
-- PROJECT CONTRIBUTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contribution_rate NUMERIC NOT NULL CHECK (contribution_rate >= 0 AND contribution_rate <= 1),
  contribution_value NUMERIC NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_pm_id ON projects(pm_id);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client);

-- Calendar events indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_dates ON calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_id ON calendar_events(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_id ON calendar_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type);

-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_direct_chat ON chat_messages(direct_chat_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- File groups indexes
CREATE INDEX IF NOT EXISTS idx_file_groups_project_id ON file_groups(project_id);

-- File items indexes
CREATE INDEX IF NOT EXISTS idx_file_items_group_id ON file_items(file_group_id);
CREATE INDEX IF NOT EXISTS idx_file_items_uploaded_by ON file_items(uploaded_by);

-- Personal todos indexes
CREATE INDEX IF NOT EXISTS idx_personal_todos_status ON personal_todos(status);
CREATE INDEX IF NOT EXISTS idx_personal_todos_due_date ON personal_todos(due_date);
CREATE INDEX IF NOT EXISTS idx_personal_todos_requested_by ON personal_todos(requested_by_id);

-- Performance snapshots indexes
CREATE INDEX IF NOT EXISTS idx_performance_user_period ON performance_snapshots(user_id, period);

-- Portfolio items indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON portfolio_items(user_id);

-- Peer feedback indexes
CREATE INDEX IF NOT EXISTS idx_peer_feedback_project ON peer_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_peer_feedback_to_user ON peer_feedback(to_user_id);

-- Project contributions indexes
CREATE INDEX IF NOT EXISTS idx_project_contributions_project ON project_contributions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contributions_user ON project_contributions(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contributions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view all projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Admins can insert projects" ON projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Admins and PMs can update projects" ON projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ADMIN' OR id = pm_id))
);

-- Project milestones policies
CREATE POLICY "Users can view milestones" ON project_milestones FOR SELECT USING (true);
CREATE POLICY "Project members can manage milestones" ON project_milestones FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_id 
    AND (pm_id = auth.uid() OR auth.uid() = ANY(team_member_ids))
  )
);

-- Calendar events policies
CREATE POLICY "Users can view all events" ON calendar_events FOR SELECT USING (true);
CREATE POLICY "Users can create events" ON calendar_events FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own events" ON calendar_events FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own events" ON calendar_events FOR DELETE USING (auth.uid() = owner_id);

-- Chat messages policies
CREATE POLICY "Users can view project messages" ON chat_messages FOR SELECT USING (
  project_id IS NULL OR 
  EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_id 
    AND (pm_id = auth.uid() OR auth.uid() = ANY(team_member_ids))
  ) OR
  user_id = auth.uid() OR
  direct_chat_user_id = auth.uid()
);
CREATE POLICY "Users can create messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- File groups policies
CREATE POLICY "Users can view file groups" ON file_groups FOR SELECT USING (true);
CREATE POLICY "Project members can manage file groups" ON file_groups FOR ALL USING (
  EXISTS (
    SELECT 1 FROM projects 
    WHERE id = project_id 
    AND (pm_id = auth.uid() OR auth.uid() = ANY(team_member_ids))
  )
);

-- File items policies
CREATE POLICY "Users can view files" ON file_items FOR SELECT USING (true);
CREATE POLICY "Users can upload files" ON file_items FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can delete own files" ON file_items FOR DELETE USING (auth.uid() = uploaded_by);

-- Personal todos policies
CREATE POLICY "Users can view assigned todos" ON personal_todos FOR SELECT USING (
  auth.uid() = requested_by_id OR auth.uid() = ANY(assignee_ids)
);
CREATE POLICY "Users can create todos" ON personal_todos FOR INSERT WITH CHECK (auth.uid() = requested_by_id);
CREATE POLICY "Assignees can update todos" ON personal_todos FOR UPDATE USING (
  auth.uid() = requested_by_id OR auth.uid() = ANY(assignee_ids)
);

-- Performance snapshots policies
CREATE POLICY "Users can view all performance data" ON performance_snapshots FOR SELECT USING (true);
CREATE POLICY "Admins can manage performance data" ON performance_snapshots FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Portfolio items policies
CREATE POLICY "Users can view all portfolios" ON portfolio_items FOR SELECT USING (true);
CREATE POLICY "Users can manage own portfolio" ON portfolio_items FOR ALL USING (auth.uid() = user_id);

-- Peer feedback policies
CREATE POLICY "Users can view feedback" ON peer_feedback FOR SELECT USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);
CREATE POLICY "Users can give feedback" ON peer_feedback FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- Project contributions policies
CREATE POLICY "Users can view contributions" ON project_contributions FOR SELECT USING (true);
CREATE POLICY "Admins can manage contributions" ON project_contributions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personal_todos_updated_at BEFORE UPDATE ON personal_todos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'MEMBER'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload files" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'project-files' AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can view files" ON storage.objects FOR SELECT USING (
  bucket_id = 'project-files' AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE USING (
  bucket_id = 'project-files' AND auth.uid()::text = owner
);
