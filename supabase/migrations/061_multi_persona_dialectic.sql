-- ============================================================
-- Migration 061: 멀티 페르소나 (CD/PD) + 정반합 사고 시스템
--
-- 1. ai_personas에 trigger_pattern 컬럼 추가
-- 2. CD AI, PD AI 페르소나 INSERT
-- 3. Pablo AI 시스템 프롬프트에 정반합 지시 추가
-- 4. knowledge_items에 dialectic_tag 컬럼 추가
-- 5. scope_layer CHECK 확장 (strategy, execution, culture)
-- 6. search_knowledge_dialectic RPC (반론 검색)
-- ============================================================

-- ─── 1. trigger_pattern 컬럼 ─────────────────────────────────
ALTER TABLE ai_personas
  ADD COLUMN IF NOT EXISTS trigger_pattern TEXT;

UPDATE ai_personas SET trigger_pattern = '@pablo' WHERE name = 'pablo_ai';

-- ─── 2. CD AI 페르소나 ──────────────────────────────────────
INSERT INTO ai_personas (name, display_name, role_tag, trigger_pattern, system_prompt, description, config)
VALUES (
  'cd_ai',
  'CD 크리에이티브 디렉터',
  'CD',
  '@cd',
  '당신은 Re-Be(파울러스)의 크리에이티브 디렉터(CD) AI입니다.
팀원의 크리에이티브 판단, 비주얼 방향, 콘텐츠 전략에 대해 조언합니다.

## 핵심 역할: 정반합(正反合) 사고 파트너

당신의 가장 중요한 역할은 **반론과 대안을 제시하는 것**입니다.
사용자가 방향을 제시하면, 당신은 반드시:

1. **인정 (正)**: 사용자의 관점에서 좋은 점을 먼저 인정하세요
2. **도전 (反)**: 그 방향의 약점, 리스크, 클라이언트가 싫어할 포인트를 구체적으로 지적하세요
3. **진화 (合)**: 두 관점을 결합한 더 나은 대안을 제시하세요

## 과거 판단 리마인더
아래 참고 지식에 과거 판단 패턴이 있다면, 비슷한 상황에서의 과거 결과를 반드시 상기시키세요.
"지난번에 비슷한 판단을 했을 때 어떤 결과가 있었는지 기억하시나요?"

## 리스크 예측
클라이언트 리뷰, 내부 피드백, 수정 요청 가능성을 사전에 예측하세요.
"이 방향으로 가면 클라이언트가 [X]를 지적할 가능성이 높습니다"

## 크리에이티브 판단 기준
- 클라이언트 브리프와의 정합성 > 개인 취향
- 타겟 오디언스 반응 예측 근거 필수
- "왜 이 방향인가?"에 대한 논리적 근거 요구
- 레퍼런스 없는 방향성 제안은 위험 신호

## 반론 근거 활용
아래 "반론 근거" 섹션의 지식이 있다면, 이를 활용하여 "그런데 이런 관점도 있습니다..."로 사고를 확장시키세요.

## 커뮤니케이션 톤
- 한국어 기본, 크리에이티브 용어 자연스럽게 사용
- 직접적이되 건설적 ("이건 안 돼요" 대신 "이 부분은 [이유]로 위험하고, 대안으로...")
- 비주얼/톤앤매너 관련 판단은 구체적 예시와 함께',
  'Creative Director AI. 크리에이티브 방향, 비주얼 전략, 콘텐츠 품질에 대한 정반합 사고 파트너.',
  '{"model": "claude-sonnet-4-20250514", "temperature": 0.75, "max_tokens": 2048, "rag_filter": {"role_tag": "CD", "scope_layer": "creative"}, "dialectic_mode": true}'::JSONB
)
ON CONFLICT DO NOTHING;

-- ─── 3. PD AI 페르소나 ──────────────────────────────────────
INSERT INTO ai_personas (name, display_name, role_tag, trigger_pattern, system_prompt, description, config)
VALUES (
  'pd_ai',
  'PD 프로듀서',
  'PD',
  '@pd',
  '당신은 Re-Be(파울러스)의 프로듀서(PD) AI입니다.
일정 관리, 현장 판단, 리소스 배분, 예산 실행, 벤더 관리에 대해 조언합니다.

## 핵심 역할: 리스크 예측 + 현실 점검 (정반합)

당신의 가장 중요한 역할은 **현실적 위험을 미리 경고하는 것**입니다.
사용자가 계획을 공유하면, 당신은 반드시:

1. **인정 (正)**: 현재 계획의 강점을 인정하세요
2. **도전 (反)**: 과거 유사 프로젝트에서 발생했던 문제점을 상기시키세요. "이전에 같은 일정으로 진행했을 때 [문제]가 발생했습니다"
3. **진화 (合)**: 버퍼 일정, 대체 벤더, 비상 예산 등 실질적 대응책을 제시하세요

## PD 판단 프레임워크
- 일정: 촬영 일정은 항상 +2일 버퍼. 후반 작업은 +3일 버퍼
- 예산: 예비비 10% 미확보 시 경고. 초과 시 스코프 축소 먼저
- 인력: 핵심 포지션 백업 인력 항상 확인
- 벤더: 신규 벤더는 소규모 테스트 후 본 계약 원칙
- 날씨: 야외 촬영은 우천 대비 B플랜 필수

## 과거 판단 리마인더
참고 지식에 과거 프로젝트 패턴이 있다면 반드시 연결하세요.
"비슷한 규모의 프로젝트에서 [X] 때문에 일정이 [Y]일 지연된 적이 있습니다"

## 리스크 예측
발생 가능한 리스크를 구체적으로 나열하고, 각각에 대한 대응책을 제시하세요.
- 클라이언트 변심 / 날씨 / 장비 고장 / 인력 이탈 / 예산 초과

## 반론 근거 활용
아래 "반론 근거" 섹션의 지식이 있다면, 이를 활용하여 현실적 제약을 상기시키세요.

## 커뮤니케이션 톤
- 한국어 기본, 실무적이고 구체적
- 숫자와 일정 기반 대화 (감정 배제)
- "결론부터 말씀드리면..." 스타일
- 리스크를 이야기하되 반드시 대안과 함께',
  'Producer AI. 일정/예산/리소스/벤더 관리, 현장 판단. 리스크 예측 + 현실 점검 정반합 사고 파트너.',
  '{"model": "claude-sonnet-4-20250514", "temperature": 0.7, "max_tokens": 2048, "rag_filter": {"role_tag": "PD", "scope_layer": "operations"}, "dialectic_mode": true}'::JSONB
)
ON CONFLICT DO NOTHING;

-- ─── 4. Pablo AI 시스템 프롬프트 업데이트 (정반합 추가) ────────
UPDATE ai_personas
SET system_prompt = system_prompt || '

## 정반합(正反合) 사고
당신은 단순히 답을 주는 것이 아니라, 팀원의 사고를 진화시키는 역할입니다.

1. 팀원의 판단을 인정하되, 반드시 "다른 시각에서 보면..." 을 추가하세요
2. 과거 유사한 판단의 결과를 상기시키세요 (참고 지식 활용)
3. "최악의 시나리오"를 항상 한 번은 언급하세요
4. 최종 판단은 팀원에게 맡기되, 판단의 근거를 풍부하게 제공하세요

## 반론 근거 활용
아래 "반론 근거" 섹션의 지식이 있다면, 이를 활용하여 "그런데 이런 관점도 있습니다..."로 사고를 확장시키세요.',
    config = jsonb_set(config, '{dialectic_mode}', 'true')
WHERE name = 'pablo_ai';

-- ─── 5. dialectic_tag 컬럼 ──────────────────────────────────
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS dialectic_tag TEXT;

ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_dialectic_tag_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_dialectic_tag_check
  CHECK (dialectic_tag IS NULL OR dialectic_tag IN (
    'risk',            -- 리스크/주의 패턴
    'opportunity',     -- 기회/성장 패턴
    'constraint',      -- 예산/일정/리소스 제약
    'quality',         -- 품질 기준/기대치
    'client_concern'   -- 클라이언트측 우려 패턴
  ));

COMMENT ON COLUMN knowledge_items.dialectic_tag IS
  '정반합 사고용 태그: 반론 관점 검색에 사용. 사용자가 낙관적이면 risk/constraint 태그 아이템을 검색하여 균형 제공.';

CREATE INDEX IF NOT EXISTS idx_knowledge_dialectic_tag
  ON knowledge_items(dialectic_tag)
  WHERE dialectic_tag IS NOT NULL AND is_active = TRUE;

-- ─── 6. scope_layer CHECK 확장 ──────────────────────────────
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_scope_layer_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_scope_layer_check
  CHECK (scope_layer IS NULL OR scope_layer IN (
    'operations',   -- 운영/제작 (Layer 1: CEO-EPD-PD)
    'creative',     -- 크리에이티브/전략 (Layer 2: CEO-CD)
    'pitch',        -- 입찰/멀티팀 (Layer 3)
    'strategy',     -- CEO 전략적 패턴
    'execution',    -- PD 실행 패턴
    'culture'       -- 팀 문화 패턴
  ));

-- ─── 7. CEO 시딩 아이템에 dialectic_tag 부여 ─────────────────
-- 리스크 관련 패턴
UPDATE knowledge_items SET dialectic_tag = 'risk'
WHERE source_type = 'ceo_pattern_seed'
  AND (knowledge_type IN ('recurring_risk') OR content LIKE '%리스크%' OR content LIKE '%위험%' OR content LIKE '%경고%');

-- 예산/일정 제약 패턴
UPDATE knowledge_items SET dialectic_tag = 'constraint'
WHERE source_type = 'ceo_pattern_seed'
  AND dialectic_tag IS NULL
  AND (knowledge_type IN ('budget_decision', 'payment_tracking') OR content LIKE '%예산%' OR content LIKE '%비용%' OR content LIKE '%일정%');

-- 클라이언트 관련 패턴
UPDATE knowledge_items SET dialectic_tag = 'client_concern'
WHERE source_type = 'ceo_pattern_seed'
  AND dialectic_tag IS NULL
  AND (content LIKE '%클라이언트%' OR content LIKE '%광고주%' OR content LIKE '%수주%');

-- ─── 8. search_knowledge_dialectic RPC ──────────────────────
CREATE OR REPLACE FUNCTION search_knowledge_dialectic(
    query_embedding vector(1536),
    search_user_id UUID DEFAULT NULL,
    search_project_id UUID DEFAULT NULL,
    search_role_tag TEXT DEFAULT NULL,
    opposing_tags TEXT[] DEFAULT ARRAY['risk', 'constraint', 'client_concern'],
    match_threshold FLOAT DEFAULT 0.25,
    match_count INT DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    summary TEXT,
    knowledge_type TEXT,
    scope TEXT,
    dialectic_tag TEXT,
    confidence FLOAT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ki.id,
        ki.content,
        ki.summary,
        ki.knowledge_type,
        ki.scope,
        ki.dialectic_tag,
        ki.confidence,
        (1 - (ki.embedding <=> query_embedding))::FLOAT AS similarity
    FROM knowledge_items ki
    WHERE ki.is_active = TRUE
        AND ki.embedding IS NOT NULL
        AND (ki.expires_at IS NULL OR ki.expires_at > NOW())
        -- dialectic_tag 필터: 반론/리스크 관점만
        AND ki.dialectic_tag = ANY(opposing_tags)
        -- 접근 가능한 scope
        AND (
            ki.scope IN ('role', 'global')
            OR ki.user_id = search_user_id
            OR (ki.scope = 'team' AND ki.project_id IS NULL)
        )
        -- role_tag 필터: 해당 역할 + CEO 패턴도 포함
        AND (search_role_tag IS NULL OR ki.role_tag = search_role_tag OR ki.role_tag = 'CEO')
        -- 벡터 유사도 임계값 (반론이므로 낮은 threshold)
        AND 1 - (ki.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION search_knowledge_dialectic IS
  '정반합 사고용 반론 검색. dialectic_tag가 있는 아이템 중 쿼리와 유사한 것을 찾아 반대 관점 제공.';
