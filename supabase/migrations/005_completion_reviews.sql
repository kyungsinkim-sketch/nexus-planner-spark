-- =====================================================
-- COMPLETION REVIEWS MIGRATION
-- 프로젝트 완료 리뷰 시스템 (동료 평가)
-- Version: 2026.02.11
-- =====================================================

-- =====================================================
-- 1. COMPLETION REVIEWS TABLE
-- 프로젝트 완료 시 팀원 간 상호 평가
-- =====================================================
CREATE TABLE IF NOT EXISTS completion_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- 같은 프로젝트에서 한 사람이 다른 사람에게 한 번만 평가 가능
    CONSTRAINT unique_completion_review UNIQUE (project_id, from_user_id, to_user_id),
    -- 자기 자신에게 평가 불가
    CONSTRAINT no_self_review CHECK (from_user_id != to_user_id)
);

COMMENT ON TABLE completion_reviews IS '프로젝트 완료 시 동료 상호 평가. 1-5점 + 코멘트';

-- =====================================================
-- 2. ALTER projects — 완료 관련 컬럼 추가
-- =====================================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS final_video_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_approved_by UUID REFERENCES profiles(id);

COMMENT ON COLUMN projects.final_video_url IS '최종 납품 영상 URL';
COMMENT ON COLUMN projects.completed_at IS '프로젝트 완료 승인 시각';
COMMENT ON COLUMN projects.completion_approved_by IS '프로젝트 완료 승인자 (PD/PM)';

-- =====================================================
-- 3. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_completion_reviews_project ON completion_reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_completion_reviews_from ON completion_reviews(from_user_id);
CREATE INDEX IF NOT EXISTS idx_completion_reviews_to ON completion_reviews(to_user_id);

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE completion_reviews ENABLE ROW LEVEL SECURITY;

-- 프로젝트 팀 멤버는 해당 프로젝트 리뷰 조회 가능
CREATE POLICY "Team members can view completion reviews"
    ON completion_reviews FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM projects WHERE auth.uid()::uuid = ANY(team_member_ids)
        )
    );

-- 팀 멤버만 리뷰 작성 가능 (본인 명의로만)
CREATE POLICY "Team members can create completion reviews"
    ON completion_reviews FOR INSERT
    WITH CHECK (
        from_user_id = auth.uid() AND
        project_id IN (
            SELECT id FROM projects WHERE auth.uid()::uuid = ANY(team_member_ids)
        )
    );

-- 관리자는 모든 리뷰 조회 가능
CREATE POLICY "Admins can view all completion reviews"
    ON completion_reviews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );
