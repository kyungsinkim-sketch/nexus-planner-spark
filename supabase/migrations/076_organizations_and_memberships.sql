-- ============================================================
-- Migration 076: Organizations & Memberships
-- ============================================================
-- User-centric architecture: users own their identity,
-- organizations are workspaces they join/leave.
-- Prep for DID wallet: user's data follows them across orgs.
-- ============================================================

-- ─── 1. Organizations ────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name TEXT NOT NULL,                       -- "파울러스" / "Paulus Co., Ltd."
  slug TEXT UNIQUE,                         -- URL-safe identifier: "paulus"
  display_name TEXT,                        -- Short display: "Paulus"
  logo_url TEXT,
  
  -- Business info
  industry TEXT,                            -- "creative_production", "advertising", "film", etc.
  country TEXT DEFAULT 'KR',
  timezone TEXT DEFAULT 'Asia/Seoul',
  
  -- Settings
  default_language TEXT DEFAULT 'ko',
  settings JSONB DEFAULT '{}',              -- org-level config (e.g., GPS coordinates, working hours)
  
  -- Plan & limits
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  max_members INT DEFAULT 10,
  
  -- Ownership
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. Memberships ─────────────────────────────────

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Role within organization
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN (
    'owner',      -- 조직 소유자 (1명)
    'admin',      -- 관리자 (설정 변경 가능)
    'manager',    -- 매니저 (프로젝트 관리)
    'member',     -- 일반 멤버
    'guest'       -- 게스트 (제한적 접근)
  )),
  
  -- Employment details
  department TEXT,                          -- 부서
  job_title TEXT,                           -- 직함
  
  -- Access control
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',     -- 현재 활동 중
    'invited',    -- 초대됨 (아직 수락 안 함)
    'suspended',  -- 일시 정지
    'departed'    -- 퇴사 (기록 보존)
  )),
  
  -- Data access period (DID wallet: time-limited org access)
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  departed_at TIMESTAMPTZ,                  -- 퇴사일 (NULL = 현재 재직)
  data_access_until TIMESTAMPTZ,            -- org가 유저 데이터에 접근 가능한 기한
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, org_id)
);

-- ─── 3. Link existing tables to organizations ───────

-- profiles: current (default) organization
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- projects: belong to an organization
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- knowledge_items.org_id already added in migration 075
-- Just add the FK constraint now that organizations table exists
-- (Skip if org_id has no data yet — safe to add FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'knowledge_items_org_id_fkey'
  ) THEN
    ALTER TABLE knowledge_items
      ADD CONSTRAINT knowledge_items_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 4. Seed default organization for existing data ──

-- Create default org from existing team
INSERT INTO organizations (id, name, slug, display_name, industry, owner_id)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Paulus Co., Ltd.',
  'paulus',
  'Paulus',
  'creative_production',
  '68827c69-4c4d-4976-bd6d-dda9c2758b14'  -- 빠불로
)
ON CONFLICT DO NOTHING;

-- Migrate existing users to default org
INSERT INTO memberships (user_id, org_id, role, department, status)
SELECT 
  p.id,
  'a0000000-0000-0000-0000-000000000001',
  CASE 
    WHEN p.role = 'ADMIN' THEN 'owner'
    WHEN p.role = 'MANAGER' THEN 'manager'
    ELSE 'member'
  END,
  p.department,
  'active'
FROM profiles p
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Set current_org for all existing users
UPDATE profiles 
SET current_org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE current_org_id IS NULL;

-- Set org_id on existing projects
UPDATE projects 
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- Set org_id on organizational knowledge_items
UPDATE knowledge_items
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL AND ownership_type = 'organizational';

-- ─── 5. Indexes ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_id);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON memberships(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_memberships_user_org ON memberships(user_id, org_id);

CREATE INDEX IF NOT EXISTS idx_profiles_current_org ON profiles(current_org_id) WHERE current_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id) WHERE org_id IS NOT NULL;

-- ─── 6. RLS Policies ────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Organizations: members can view their orgs
CREATE POLICY "Members can view their organizations"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT org_id FROM memberships WHERE user_id = auth.uid() AND status = 'active')
    OR owner_id = auth.uid()
  );

-- Org owners/admins can update
CREATE POLICY "Owners and admins can update organizations"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- Memberships: users see memberships in their orgs
CREATE POLICY "Users can view memberships in their orgs"
  ON memberships FOR SELECT
  USING (
    org_id IN (SELECT org_id FROM memberships m2 WHERE m2.user_id = auth.uid() AND m2.status = 'active')
  );

-- Users can see their own memberships
CREATE POLICY "Users can view own memberships"
  ON memberships FOR SELECT
  USING (user_id = auth.uid());

-- Admins can manage memberships
CREATE POLICY "Admins can manage memberships"
  ON memberships FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM memberships m2 
      WHERE m2.user_id = auth.uid() AND m2.role IN ('owner', 'admin') AND m2.status = 'active'
    )
  );

-- Service role full access
CREATE POLICY "Service role full access organizations"
  ON organizations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access memberships"
  ON memberships FOR ALL
  USING (auth.role() = 'service_role');

-- ─── 7. Updated_at triggers ─────────────────────────

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_decision_thread_timestamp();

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_decision_thread_timestamp();
