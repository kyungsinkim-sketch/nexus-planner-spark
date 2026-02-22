-- Migration 056: User Decision Patterns
-- 개인 판단 패턴 누적 테이블 — knowledge_items를 분석하여
-- 유저별 의사결정 성향(보수적/적극적/협업 지향 등)을 추적합니다.

CREATE TABLE IF NOT EXISTS user_decision_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- 분류
    knowledge_domain TEXT NOT NULL CHECK (knowledge_domain IN (
        'budget',       -- 예산 관련 판단
        'creative',     -- 크리에이티브 방향
        'risk',         -- 리스크 대응
        'schedule',     -- 일정 관리
        'stakeholder'   -- 이해관계자 조율
    )),
    pattern_type TEXT NOT NULL,               -- 'conservative', 'bold', 'risk_averse', 'collaborative' 등 (LLM 생성)
    pattern_summary TEXT,                      -- LLM이 생성한 패턴 설명 (한국어)

    -- 근거
    evidence_item_ids UUID[] DEFAULT '{}',     -- 근거가 된 knowledge_items id 배열
    confidence NUMERIC NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    sample_count INTEGER NOT NULL DEFAULT 1,   -- 분석에 사용된 knowledge_items 수

    -- 타임스탬프
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_patterns_user ON user_decision_patterns(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_patterns_upsert ON user_decision_patterns(user_id, knowledge_domain);

-- RLS
ALTER TABLE user_decision_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own patterns" ON user_decision_patterns;
CREATE POLICY "Users can view own patterns" ON user_decision_patterns
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to patterns" ON user_decision_patterns;
CREATE POLICY "Service role full access to patterns" ON user_decision_patterns
    FOR ALL USING (true);

-- Updated_at trigger
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_decision_patterns_updated_at') THEN
        CREATE TRIGGER update_user_decision_patterns_updated_at
            BEFORE UPDATE ON user_decision_patterns
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
