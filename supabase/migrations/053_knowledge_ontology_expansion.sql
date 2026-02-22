-- Migration 053: Knowledge Ontology Expansion
-- 기존 knowledge_items의 knowledge_type, source_type, role_tag CHECK 제약을 확장합니다.
-- 기존 데이터 호환성 유지: 기존 10종 knowledge_type + 5종 신규 추가.

-- ─── knowledge_type 확장 (기존 10 + 신규 5) ────────────
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_knowledge_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_knowledge_type_check CHECK (knowledge_type IN (
    -- 기존 10종 (migration 052)
    'decision_pattern',      -- 의사결정 패턴
    'preference',            -- 작업 스타일 선호
    'judgment',              -- 판단 기준 (리스크/예산/품질)
    'collaboration_pattern', -- 협업 패턴
    'recurring_risk',        -- 반복 리스크
    'workflow',              -- 표준 작업 절차
    'domain_expertise',      -- 전문 지식
    'feedback_pattern',      -- 피드백 패턴
    'communication_style',   -- 커뮤니케이션 스타일
    'lesson_learned',        -- 교훈/시행착오
    -- 신규 5종
    'creative_direction',    -- 크리에이티브 방향성
    'budget_judgment',       -- 예산 관련 판단
    'stakeholder_alignment', -- 이해관계자 조율
    'schedule_change',       -- 일정 변경
    'context'                -- 일반 맥락 정보
));

-- ─── source_type 확장 (기존 6 + 신규 3) ─────────────
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_source_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_source_type_check CHECK (source_type IN (
    -- 기존 6종 (migration 052)
    'chat_digest',
    'brain_action',
    'peer_review',
    'decision_log',
    'meeting_note',
    'manual',
    -- 신규 3종
    'notion_page',           -- Notion 문서
    'gmail',                 -- 이메일 (Gmail)
    'voice_recording'        -- 음성 녹음
));

-- ─── role_tag 확장 ───────────────────────────────────
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_role_tag_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_role_tag_check CHECK (role_tag IS NULL OR role_tag IN (
    -- 기존 7종 (migration 052)
    'CD', 'PD', 'EDITOR', 'DIRECTOR', 'WRITER', 'DESIGNER', 'MANAGER',
    -- 신규 5종
    'PRODUCER', 'CREATIVE_DIRECTOR', 'BUDGET_MANAGER', 'PROJECT_MANAGER', 'STAKEHOLDER', 'VENDOR'
));
