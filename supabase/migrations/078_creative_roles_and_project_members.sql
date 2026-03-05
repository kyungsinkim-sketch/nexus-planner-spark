-- 078: Creative Roles + Project Team Members
-- Enables per-project role assignment with default from profile
-- Prepares for Ark.works project data push

-- ============================================
-- 1. Creative Roles lookup table
-- ============================================
CREATE TABLE IF NOT EXISTS creative_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('Production', 'Creative', 'Post-Production', 'Strategy', 'Management')),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE creative_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view creative roles" ON creative_roles FOR SELECT USING (true);
CREATE POLICY "Admins can manage creative roles" ON creative_roles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
);

-- Seed from Excel data
INSERT INTO creative_roles (id, name, category, sort_order) VALUES
    -- Production
    ('066637ae-96bd-48d3-83f2-becb31ea1c7a', 'Producer', 'Production', 10),
    ('0c1d97f1-a4af-4c68-9bcb-3fd87ef5ec66', 'Executive Creative Director', 'Production', 11),
    ('18cfe0f0-209f-42bb-ae66-d03919a92152', 'Director', 'Production', 12),
    ('216d5a47-8e90-4087-8332-48f8d7a33f30', 'Assistant Director', 'Production', 13),
    ('3f2cc979-9c15-455f-a041-5c85709f313e', 'Executive Producer', 'Production', 14),
    ('4c6c05ea-08e0-447f-a3cb-4a6a22d52fe9', 'Line Producer', 'Production', 15),
    ('f76d5c08-3d5f-44cf-94aa-362e1f6580c1', 'DOP', 'Production', 16),
    ('fdb91630-57fe-4e5e-8d94-9414efd54fea', 'Account Executive', 'Production', 17),
    -- Creative
    ('a3bc3676-f19e-4437-93a2-42db9651fd27', 'Creative Director', 'Creative', 20),
    ('8ab47109-53f9-4b3a-bcfb-d88eb939ef10', 'Art Director', 'Creative', 21),
    ('e94ef7ef-6d9d-41a5-b60a-20c27105dc7f', 'Graphic Designer', 'Creative', 22),
    ('f0b34e6a-0d52-4f6b-85c5-1af8292ee930', '2D Designer', 'Creative', 23),
    ('2a3ed3b2-7245-4395-99ac-44038720408c', 'UI Designer', 'Creative', 24),
    ('48d8da5e-62de-48f4-97cc-fbc0ab91ccf7', 'UX Designer', 'Creative', 25),
    ('888d97a6-d3ee-4f0c-9bbd-423a69685821', 'Illustrator', 'Creative', 26),
    ('6c37f724-ce4f-4318-961c-21c43680798a', 'Animator', 'Creative', 27),
    ('427e71f4-0bda-4bee-aa03-202172a65e11', '3D Artist', 'Creative', 28),
    ('992ec522-f0da-4c70-b1c1-b2a4ff76b5c6', 'Photographer', 'Creative', 29),
    -- Post-Production
    ('d72640ec-59c6-4dca-9cde-644f9f6c5ace', 'Editor', 'Post-Production', 30),
    ('392faeb9-4409-4d2b-823a-f6fdfdd20cf8', 'Motion Designer', 'Post-Production', 31),
    ('3d206c66-4a66-4e1a-885b-feb63e91ea51', 'VFX Artist', 'Post-Production', 32),
    ('3eee63f8-b195-4004-8989-a93c8bb608f5', 'Colorist', 'Post-Production', 33),
    ('c52481ef-2be6-46b5-b4d2-ca2f152bd9a4', 'Sound Designer', 'Post-Production', 34),
    ('9268befd-558d-4a0d-8934-062cad5251cb', 'Composer', 'Post-Production', 35),
    -- Strategy
    ('427976fc-71e6-4c25-8b4f-21a6f36d9c08', 'Brand Strategist', 'Strategy', 40),
    -- Management
    ('af76d9fd-d091-4935-a1cb-7bbc6022fce2', 'Project Manager', 'Management', 50),
    ('d437a0a9-edea-4134-917e-9885ddae7d24', 'Account Director', 'Management', 51),
    ('c2600ca0-109f-4df3-b8bc-d8387d21f83f', 'Copywriter', 'Creative', 29)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. Default creative role on profiles
-- ============================================
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS default_creative_role_id UUID REFERENCES creative_roles(id);

-- ============================================
-- 3. Project Team Members join table
--    Replaces team_member_ids UUID[] with proper relation + per-project role
-- ============================================
CREATE TABLE IF NOT EXISTS project_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    creative_role_id UUID REFERENCES creative_roles(id),
    added_at TIMESTAMPTZ DEFAULT now(),
    added_by UUID REFERENCES profiles(id),
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_ptm_project ON project_team_members(project_id);
CREATE INDEX idx_ptm_user ON project_team_members(user_id);

ALTER TABLE project_team_members ENABLE ROW LEVEL SECURITY;

-- View: anyone on the project can see members
CREATE POLICY "Project members can view team" ON project_team_members FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE auth.uid()::uuid = ANY(team_member_ids))
    OR user_id = auth.uid()
);

-- Insert/Update/Delete: project PM or admin
CREATE POLICY "PM or admin can manage team" ON project_team_members FOR ALL USING (
    EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = project_team_members.project_id
        AND (p.pm_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'))
    )
);

-- ============================================
-- 4. Migrate existing team_member_ids to project_team_members
--    Uses each member's default_creative_role_id if set
-- ============================================
INSERT INTO project_team_members (project_id, user_id, creative_role_id)
SELECT
    p.id,
    unnest(p.team_member_ids),
    pr.default_creative_role_id
FROM projects p
CROSS JOIN LATERAL unnest(p.team_member_ids) AS member_id
LEFT JOIN profiles pr ON pr.id = member_id
WHERE p.team_member_ids IS NOT NULL
  AND array_length(p.team_member_ids, 1) > 0
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Enable realtime for project_team_members
ALTER PUBLICATION supabase_realtime ADD TABLE project_team_members;
