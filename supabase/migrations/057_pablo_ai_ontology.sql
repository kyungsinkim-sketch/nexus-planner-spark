-- Migration 057: Pablo AI Ontology Expansion
-- CEO 판단 패턴 기반 온톨로지 확장 + AI 페르소나 테이블 생성
-- 기존 데이터 완벽 호환: 기존 모든 CHECK constraint 값 유지

-- ─── 1. knowledge_type 확장 (기존 15 + 신규 9 = 24종) ────────────
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_knowledge_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_knowledge_type_check CHECK (knowledge_type IN (
    -- 기존 10종 (migration 052)
    'decision_pattern',
    'preference',
    'judgment',
    'collaboration_pattern',
    'recurring_risk',
    'workflow',
    'domain_expertise',
    'feedback_pattern',
    'communication_style',
    'lesson_learned',
    -- 기존 5종 (migration 053)
    'creative_direction',
    'budget_judgment',
    'stakeholder_alignment',
    'schedule_change',
    'context',
    -- 신규 9종 (migration 057 — Pablo AI Ontology)
    'deal_decision',          -- 수주/거래 결정
    'budget_decision',        -- 예산 판단 (budget_judgment보다 구체적: 금액, 배분)
    'payment_tracking',       -- 대금 추적 (입금일정, 선금/잔금, 캐시플로우)
    'vendor_selection',       -- 외주/파트너 선정 (변호사, 숙소, 장비 등)
    'campaign_strategy',      -- 캠페인/마케팅 전략 (IMC, 브랜딩, 광고제)
    'naming_decision',        -- 네이밍/카피 확정 (프로젝트명, 제품명, 세션명)
    'award_strategy',         -- 어워드/광고제 전략 (출품, 카테고리, 케이스필름)
    'pitch_execution',        -- 제안서/피칭 전략 (PT구조, 차별화, 제출)
    'talent_casting'          -- 인재/모델/캐스팅 (채용, 섭외, 출연자)
));

-- ─── 2. source_type 확장 (기존 9 + 신규 1 = 10종) ─────────────
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_source_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_source_type_check CHECK (source_type IN (
    -- 기존 6종 (migration 052)
    'chat_digest',
    'brain_action',
    'peer_review',
    'decision_log',
    'meeting_note',
    'manual',
    -- 기존 3종 (migration 053)
    'notion_page',
    'gmail',
    'voice_recording',
    -- 신규 1종 (migration 057)
    'flow_chat_log'           -- Flow 채팅 TXT 배치 분석 소스
));

-- ─── 3. role_tag 확장 (기존 12 + 신규 8 = 20종) ───────────────
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_role_tag_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_role_tag_check CHECK (role_tag IS NULL OR role_tag IN (
    -- 기존 7종 (migration 052)
    'CD', 'PD', 'EDITOR', 'DIRECTOR', 'WRITER', 'DESIGNER', 'MANAGER',
    -- 기존 5종 (migration 053)
    'PRODUCER', 'CREATIVE_DIRECTOR', 'BUDGET_MANAGER', 'PROJECT_MANAGER', 'STAKEHOLDER', 'VENDOR',
    -- 신규 8종 (migration 057)
    'CEO',                    -- 대표이사
    'EXECUTIVE_PRODUCER',     -- 총괄 프로듀서
    'LINE_PD',                -- 라인 프로듀서
    'SENIOR_ART_DIRECTOR',    -- 시니어 아트 디렉터
    'ART_DIRECTOR',           -- 아트 디렉터
    'COPYWRITER_CD',          -- 카피라이터/CD 겸직
    'CLIENT',                 -- 클라이언트 (외부)
    'EXTERNAL_PARTNER'        -- 외부 파트너
));

-- ─── 4. knowledge_items에 Pablo AI 전용 컬럼 추가 ─────────────
-- scope_layer: 온톨로지 3-Layer 분류 (operations/creative/pitch)
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS scope_layer TEXT;

ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_scope_layer_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_scope_layer_check
  CHECK (scope_layer IS NULL OR scope_layer IN ('operations', 'creative', 'pitch'));

COMMENT ON COLUMN knowledge_items.scope_layer IS '온톨로지 3-Layer: operations(운영/제작), creative(크리에이티브/전략), pitch(입찰/멀티팀)';

-- decision_maker: 실제 판단자 이름 (CEO 필터링에 사용)
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS decision_maker TEXT;

COMMENT ON COLUMN knowledge_items.decision_maker IS '판단의 실제 결정자 (예: 김경신, Saffaan)';

-- outcome: 판단의 결과
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS outcome TEXT;

ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_outcome_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_outcome_check
  CHECK (outcome IS NULL OR outcome IN ('confirmed', 'rejected', 'pending', 'escalated'));

COMMENT ON COLUMN knowledge_items.outcome IS '판단 결과: confirmed(확정), rejected(기각), pending(보류), escalated(상위 결재)';

-- financial_impact_krw: 금액 영향 (원 단위)
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS financial_impact_krw BIGINT;

COMMENT ON COLUMN knowledge_items.financial_impact_krw IS '판단의 재무적 영향 금액 (KRW)';

-- ─── 5. ai_personas 테이블 생성 ───────────────────────────
CREATE TABLE IF NOT EXISTS ai_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 'Pablo AI', 'Saffaan AI' 등
  display_name TEXT NOT NULL,            -- '김경신 CEO', 'Saffaan Qadir CD' 등
  role_tag TEXT NOT NULL,                -- 'CEO', 'CD' 등
  system_prompt TEXT NOT NULL,           -- 시스템 프롬프트 전문
  description TEXT,                      -- 페르소나 설명
  avatar_url TEXT,                       -- 프로필 이미지 URL
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::JSONB,      -- 추가 설정 (temperature, model 등)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ai_personas IS 'Pablo AI 등 CEO/팀원 AI 페르소나 관리';

-- ─── 6. persona_query_log 테이블 생성 ─────────────────────
CREATE TABLE IF NOT EXISTS persona_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,                 -- 질문한 사용자
  project_id UUID,                       -- 관련 프로젝트 (선택)
  query TEXT NOT NULL,                   -- 사용자 질문
  response TEXT NOT NULL,                -- AI 응답
  rag_context JSONB,                     -- 주입된 RAG 컨텍스트 (디버깅용)
  feedback TEXT CHECK (feedback IN ('helpful', 'unhelpful')),
  response_time_ms INTEGER,              -- 응답 소요시간
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE persona_query_log IS 'Pablo AI 질의 로그 — 피드백 루프 + 품질 모니터링';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_persona_query_log_persona_id ON persona_query_log(persona_id);
CREATE INDEX IF NOT EXISTS idx_persona_query_log_user_id ON persona_query_log(user_id);
CREATE INDEX IF NOT EXISTS idx_persona_query_log_created_at ON persona_query_log(created_at DESC);

-- ─── 7. knowledge_items 인덱스 추가 ──────────────────────
-- scope_layer 기반 필터링
CREATE INDEX IF NOT EXISTS idx_knowledge_items_scope_layer ON knowledge_items(scope_layer) WHERE scope_layer IS NOT NULL;

-- decision_maker 기반 필터링 (Pablo AI: decision_maker = '김경신')
CREATE INDEX IF NOT EXISTS idx_knowledge_items_decision_maker ON knowledge_items(decision_maker) WHERE decision_maker IS NOT NULL;

-- ─── 8. RLS 정책 (ai_personas) ────────────────────────────
ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자가 active 페르소나 조회 가능
CREATE POLICY "ai_personas_select" ON ai_personas
  FOR SELECT TO authenticated
  USING (is_active = true);

-- 관리자만 생성/수정 가능 (MANAGER 역할)
CREATE POLICY "ai_personas_admin" ON ai_personas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- ─── 9. RLS 정책 (persona_query_log) ─────────────────────
ALTER TABLE persona_query_log ENABLE ROW LEVEL SECURITY;

-- 본인 질의 로그만 조회 가능
CREATE POLICY "persona_query_log_own" ON persona_query_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 인증 사용자 누구나 질의 가능 (INSERT)
CREATE POLICY "persona_query_log_insert" ON persona_query_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 피드백 업데이트는 본인만
CREATE POLICY "persona_query_log_feedback" ON persona_query_log
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 10. Pablo AI 초기 페르소나 데이터 삽입 ──────────────
INSERT INTO ai_personas (name, display_name, role_tag, system_prompt, description, config)
VALUES (
  'pablo_ai',
  'CEO 김경신 (Pablo)',
  'CEO',
  '당신은 Re-Be(파울러스) CEO 김경신(Pablo)입니다.
10년간 영상 프로덕션·광고·브랜디드 콘텐츠 분야에서 쌓은 경험을 바탕으로,
팀원의 질문에 CEO 관점으로 조언하세요.

## 핵심 경영 원칙
1. 역할별 맞춤 소통: 상대의 역할과 역량 수준에 맞춰 톤과 깊이를 조절하세요
2. 교육적 리더십: 답을 주되, "왜 그런지"를 함께 설명하세요
3. 속도 vs 퀄리티: 외부 마감 압박 → 속도 우선, 내부 퀄리티 → 완성도 우선
4. 위임 + 적시 개입: 실행은 위임, 방향·전략·클라이언트 대면 전에는 직접 확인
5. 비용 감각: 유휴 자산 즉시 현금화, 고정비→변동비 전환
6. 클라이언트 관계: 약속 엄수, 정보는 딱 필요한 만큼만
7. 감정 관리: 업무 독려보다 개인 컨디션 우선
8. AI 활용: 적극 시도하되 퀄리티 미달 시 즉시 폐기
9. 맥락적 사고: 단편적 답변이 아닌 근거 기반 제안 요구
10. 손절 타이밍: 가치 없으면 미련 없이 정리

## 의사결정 스타일
- 즉각적 결정 / 가격 감각 / 리스크 분류 / 크리에이티브 디렉션 가능

## 커뮤니케이션 톤
- 한국어 기본, 간결하고 직접적, 교육 시 원리 설명, 감정적 상황에서 공감 먼저',
  'Re-Be CEO 김경신의 10년간 경영·크리에이티브 판단 패턴을 학습한 AI 페르소나. 8명의 팀원과의 258,000자+ 대화에서 22가지 커뮤니케이션 패턴을 추출.',
  '{"model": "claude-sonnet-4-20250514", "temperature": 0.7, "max_tokens": 2048, "rag_filter": {"decision_maker": "김경신", "role_tag": "CEO"}}'::JSONB
)
ON CONFLICT DO NOTHING;
