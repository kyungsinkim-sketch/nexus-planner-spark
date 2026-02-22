-- ============================================================
-- Knowledge Seed: CEO 패턴 22개 + 협업 매트릭스 8개
-- Run after migration 057 (knowledge_items 확장)
-- ============================================================

-- ─── 0. source_type CHECK 확장 (기존 10 + 신규 1 = 11종) ─────
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
    -- 기존 1종 (migration 057)
    'flow_chat_log',
    -- 신규 1종 (migration 059)
    'ceo_pattern_seed'        -- CEO 패턴 시딩 데이터
));

-- First, get or set the CEO user_id
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find CEO user (김경신)
  SELECT id INTO v_user_id FROM profiles WHERE name = '김경신' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'CEO profile not found, using NULL user_id';
  END IF;

  -- Item 1/30: deal_decision
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '프로젝트 수주 결정 시 ''내수율(수익률)'' 기준으로 판단. 총 계약금액 대비 실제 내수가 30% 이하면 수주 거부 또는 재협상 요구. ''돈 안 되는 일은 하지 않는다''는 원칙 고수.', '프로젝트 수주 결정 시 ''내수율(수익률)'' 기준으로 판단. 총 계약금액 대비 실제 내수가 30% 이하면 수주 거부 또는 재협상 요구. ''돈 안 되는 일은 하지 않는다''는 원칙 고수.', 'deal_decision', 'ceo_pattern_seed', 'CEO', 0.95, 0.95, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "수주/포기 결정의 일관된 기준. 모든 프로젝트 수주 판단에 재활용 가능."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 2/30: budget_decision
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '예산 협상 시 ''목표 내수율''을 역산하여 견적 하한선을 설정. 인건비+외주비+관리비를 먼저 산출하고, 목표 수익률을 더한 금액이 최소 견적. 클라이언트가 예산을 낮추면 스코프 축소로 대응.', '예산 협상 시 ''목표 내수율''을 역산하여 견적 하한선을 설정. 인건비+외주비+관리비를 먼저 산출하고, 목표 수익률을 더한 금액이 최소 견적. 클라이언트가 예산을 낮추면 스코프 축소로 대응.', 'budget_decision', 'ceo_pattern_seed', 'CEO', 0.92, 0.92, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "예산 협상의 구조적 접근법. 견적 산출 시 일관된 방법론 제공."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 3/30: payment_tracking
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '대금 결제 조건은 ''3:3:4'' 또는 ''5:5'' 구조 선호. 선금 비율이 30% 미만이면 리스크 경고. 촬영 전 잔금 완납 불가 시 촬영 일정 조정도 불사.', '대금 결제 조건은 ''3:3:4'' 또는 ''5:5'' 구조 선호. 선금 비율이 30% 미만이면 리스크 경고. 촬영 전 잔금 완납 불가 시 촬영 일정 조정도 불사.', 'payment_tracking', 'ceo_pattern_seed', 'CEO', 0.9, 0.9, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "대금 수수 조건의 표준. 계약 협상 시 기준점 제공."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 4/30: recurring_risk
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '계약 리스크 판단: 독소조항(지재권 양도, 과도한 위약금) 발견 시 법무팀 검토 후 수정 요구. 양보 불가 조항 리스트를 사전에 관리.', '계약 리스크 판단: 독소조항(지재권 양도, 과도한 위약금) 발견 시 법무팀 검토 후 수정 요구. 양보 불가 조항 리스트를 사전에 관리.', 'recurring_risk', 'ceo_pattern_seed', 'CEO', 0.88, 0.88, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "계약 리스크 체크리스트. 신규 계약 검토 시 빠르게 참조 가능."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 5/30: budget_judgment
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '예산 초과 시 대응 원칙: 1) 우선순위 재정렬(must-have vs nice-to-have), 2) 스코프 축소 제안, 3) 추가 예산 협상, 4) 최악의 경우 손절 판단. 감정이 아닌 숫자로 결정.', '예산 초과 시 대응 원칙: 1) 우선순위 재정렬(must-have vs nice-to-have), 2) 스코프 축소 제안, 3) 추가 예산 협상, 4) 최악의 경우 손절 판단. 감정이 아닌 숫자로 결정.', 'budget_judgment', 'ceo_pattern_seed', 'CEO', 0.91, 0.91, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "예산 초과 상황의 의사결정 프레임워크. 위기 대응 시 활용."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 6/30: creative_direction
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '크리에이티브 방향 결정은 ''클라이언트 니즈 우선''이지만 ''우리만의 해석''을 반드시 포함. ''클라이언트가 원하는 것''과 ''클라이언트에게 필요한 것''을 구분하여 제안.', '크리에이티브 방향 결정은 ''클라이언트 니즈 우선''이지만 ''우리만의 해석''을 반드시 포함. ''클라이언트가 원하는 것''과 ''클라이언트에게 필요한 것''을 구분하여 제안.', 'creative_direction', 'ceo_pattern_seed', 'CEO', 0.93, 0.93, true, 'creative', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "크리에이티브 기본 철학. 모든 캠페인 기획의 출발점."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 7/30: campaign_strategy
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '캠페인 전략 수립 시 ''타겟 인사이트 → 핵심 메시지 → 크리에이티브 컨셉 → 실행 계획'' 순서를 고수. 컨셉 없이 실행부터 들어가는 것을 경계.', '캠페인 전략 수립 시 ''타겟 인사이트 → 핵심 메시지 → 크리에이티브 컨셉 → 실행 계획'' 순서를 고수. 컨셉 없이 실행부터 들어가는 것을 경계.', 'campaign_strategy', 'ceo_pattern_seed', 'CEO', 0.9, 0.9, true, 'creative', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "캠페인 전략 수립 프로세스. 체계적 접근법 보장."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 8/30: naming_decision
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '네이밍/슬로건 결정 시 3가지 기준: 1) 발음 용이성(한영 모두), 2) 의미 전달력, 3) 법적 보호 가능성. 후보 3-5개를 테스트 후 최종 결정.', '네이밍/슬로건 결정 시 3가지 기준: 1) 발음 용이성(한영 모두), 2) 의미 전달력, 3) 법적 보호 가능성. 후보 3-5개를 테스트 후 최종 결정.', 'naming_decision', 'ceo_pattern_seed', 'CEO', 0.87, 0.87, true, 'creative', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "네이밍 의사결정 체크리스트. 브랜드 네이밍 프로젝트에 활용."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 9/30: award_strategy
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '어워드 제출 전략: 칸/원쇼/클리오 등 티어1 어워드 위주로 집중. 수상 가능성 50% 미만이면 제출 안 함. 케이스 필름 퀄리티가 수상의 80%를 결정한다고 판단.', '어워드 제출 전략: 칸/원쇼/클리오 등 티어1 어워드 위주로 집중. 수상 가능성 50% 미만이면 제출 안 함. 케이스 필름 퀄리티가 수상의 80%를 결정한다고 판단.', 'award_strategy', 'ceo_pattern_seed', 'CEO', 0.88, 0.88, true, 'creative', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "어워드 전략 기준. 제출 여부 판단 시 활용."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 10/30: talent_casting
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '탤런트/모델 캐스팅 시 예산 대비 효과 분석 우선. A급 탤런트 비용이 전체 제작비의 40%를 초과하면 대안 탐색. 신인 발굴 통한 비용 절감 + 신선함 확보 전략 선호.', '탤런트/모델 캐스팅 시 예산 대비 효과 분석 우선. A급 탤런트 비용이 전체 제작비의 40%를 초과하면 대안 탐색. 신인 발굴 통한 비용 절감 + 신선함 확보 전략 선호.', 'talent_casting', 'ceo_pattern_seed', 'CEO', 0.86, 0.86, true, 'creative', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "캐스팅 예산 기준. 탤런트 선정 시 비용 효율 판단."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 11/30: pitch_execution
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', 'PT(제안서) 구조: 1) 클라이언트 과제 재정의(공감), 2) 시장/소비자 인사이트, 3) 전략 방향, 4) 크리에이티브 컨셉, 5) 실행 계획, 6) 예산/일정. 6페이지 내 핵심 전달이 이상적.', 'PT(제안서) 구조: 1) 클라이언트 과제 재정의(공감), 2) 시장/소비자 인사이트, 3) 전략 방향, 4) 크리에이티브 컨셉, 5) 실행 계획, 6) 예산/일정. 6페이지 내 핵심 전달이 이상적.', 'pitch_execution', 'ceo_pattern_seed', 'CEO', 0.93, 0.93, true, 'pitch', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "제안서 구조 표준. 모든 PT 작업의 프레임워크."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 12/30: vendor_selection
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '외주 업체 선정 기준: 1) 포트폴리오 퀄리티, 2) 일정 준수 이력, 3) 단가 합리성, 4) 커뮤니케이션 수월성. 신규 업체는 소규모 테스트 후 본계약.', '외주 업체 선정 기준: 1) 포트폴리오 퀄리티, 2) 일정 준수 이력, 3) 단가 합리성, 4) 커뮤니케이션 수월성. 신규 업체는 소규모 테스트 후 본계약.', 'vendor_selection', 'ceo_pattern_seed', 'CEO', 0.89, 0.89, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "외주 업체 선정 프레임워크. 벤더 평가 시 활용."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 13/30: schedule_change
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '일정 변경 원칙: 클라이언트 요청에 의한 변경은 추가 비용 협상 필수. 내부 지연은 야근/주말 투입으로 만회. 마감 D-3일 이내 변경은 퀄리티 리스크로 간주.', '일정 변경 원칙: 클라이언트 요청에 의한 변경은 추가 비용 협상 필수. 내부 지연은 야근/주말 투입으로 만회. 마감 D-3일 이내 변경은 퀄리티 리스크로 간주.', 'schedule_change', 'ceo_pattern_seed', 'CEO', 0.91, 0.91, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "일정 변경 대응 원칙. 프로젝트 관리의 기준선."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 14/30: workflow
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '촬영 현장 의사결정 위임 체계: PD/CD에게 현장 재량권 부여하되, 예산 10% 이상 변동 또는 안전 이슈 발생 시 즉시 보고. 사후 보고보다 사전 상의를 중시.', '촬영 현장 의사결정 위임 체계: PD/CD에게 현장 재량권 부여하되, 예산 10% 이상 변동 또는 안전 이슈 발생 시 즉시 보고. 사후 보고보다 사전 상의를 중시.', 'workflow', 'ceo_pattern_seed', 'CEO', 0.89, 0.89, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "현장 위임 체계. 촬영/제작 현장 의사결정 기준."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 15/30: pitch_execution
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', 'PT 차별화 전략: 경쟁사 분석 후 ''남들이 안 하는 것''에 집중. 형식적 차별화(인터랙티브 PT, 영상 PT 등)도 적극 활용. 첫 5분에 승부를 건다.', 'PT 차별화 전략: 경쟁사 분석 후 ''남들이 안 하는 것''에 집중. 형식적 차별화(인터랙티브 PT, 영상 PT 등)도 적극 활용. 첫 5분에 승부를 건다.', 'pitch_execution', 'ceo_pattern_seed', 'CEO', 0.88, 0.88, true, 'pitch', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "PT 차별화 원칙. 경쟁 PT 시 전략적 접근."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 16/30: communication_style
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '팀 커뮤니케이션 원칙: 중요한 결정은 카톡이 아닌 대면/화상으로. 문서화 필수(결정사항은 회의록으로 공유). ''말로 한 약속''은 약속이 아니다.', '팀 커뮤니케이션 원칙: 중요한 결정은 카톡이 아닌 대면/화상으로. 문서화 필수(결정사항은 회의록으로 공유). ''말로 한 약속''은 약속이 아니다.', 'communication_style', 'ceo_pattern_seed', 'CEO', 0.92, 0.92, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "커뮤니케이션 원칙. 팀 협업 기본 규칙."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 17/30: feedback_pattern
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '피드백 방식: ''샌드위치 피드백''보다 직접적 피드백 선호. 좋은 점/나쁜 점 명확히 구분. 감정이 아닌 결과물 기준으로 피드백. 피드백 후 개선 방향 반드시 제시.', '피드백 방식: ''샌드위치 피드백''보다 직접적 피드백 선호. 좋은 점/나쁜 점 명확히 구분. 감정이 아닌 결과물 기준으로 피드백. 피드백 후 개선 방향 반드시 제시.', 'feedback_pattern', 'ceo_pattern_seed', 'CEO', 0.88, 0.88, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "피드백 스타일. 팀원 성장 관리에 활용."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 18/30: stakeholder_alignment
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '이해관계자 조율 원칙: 클라이언트 내부 의사결정 구조를 먼저 파악. 실무자와 의사결정권자에게 다른 언어로 설명. 중간 보고를 자주 하여 ''깜짝 쇼'' 방지.', '이해관계자 조율 원칙: 클라이언트 내부 의사결정 구조를 먼저 파악. 실무자와 의사결정권자에게 다른 언어로 설명. 중간 보고를 자주 하여 ''깜짝 쇼'' 방지.', 'stakeholder_alignment', 'ceo_pattern_seed', 'CEO', 0.9, 0.9, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "이해관계자 관리 전략. 클라이언트 커뮤니케이션의 핵심."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 19/30: judgment
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '팀원 역량 판단 기준: 1) 자기 일의 범위를 스스로 정의할 수 있는가, 2) 문제 발생 시 해결책을 함께 가져오는가, 3) 마감을 지키는가. 이 3가지로 ''프로''와 ''주니어''를 구분.', '팀원 역량 판단 기준: 1) 자기 일의 범위를 스스로 정의할 수 있는가, 2) 문제 발생 시 해결책을 함께 가져오는가, 3) 마감을 지키는가. 이 3가지로 ''프로''와 ''주니어''를 구분.', 'judgment', 'ceo_pattern_seed', 'CEO', 0.91, 0.91, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "인재 평가 기준. 팀 구성 및 역할 배분 시 활용."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 20/30: collaboration_pattern
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '협업 패턴: CD와는 크리에이티브 방향, EP와는 예산/계약, PD와는 일정/현장 중심으로 소통. 각 역할의 전문성을 존중하되 최종 결정권은 CEO에게 귀속.', '협업 패턴: CD와는 크리에이티브 방향, EP와는 예산/계약, PD와는 일정/현장 중심으로 소통. 각 역할의 전문성을 존중하되 최종 결정권은 CEO에게 귀속.', 'collaboration_pattern', 'ceo_pattern_seed', 'CEO', 0.93, 0.93, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "역할별 협업 구조. 팀 다이나믹스 이해의 기초."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 21/30: lesson_learned
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '업계 교훈: ''좋은 작품''과 ''좋은 비즈니스''는 다르다. 수상작이 반드시 수익성이 좋은 것은 아님. 장기적으로는 수익이 있어야 좋은 작품도 만들 수 있다.', '업계 교훈: ''좋은 작품''과 ''좋은 비즈니스''는 다르다. 수상작이 반드시 수익성이 좋은 것은 아님. 장기적으로는 수익이 있어야 좋은 작품도 만들 수 있다.', 'lesson_learned', 'ceo_pattern_seed', 'CEO', 0.94, 0.94, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "사업 철학. 의사결정의 근본적 가이드라인."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 22/30: domain_expertise
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '크리에이티브 에이전시 운영 노하우: 인력이 곧 자산. 핵심 인력 유지가 최우선. 프로젝트 실패보다 핵심 인력 이탈이 더 큰 리스크. 무리한 프로젝트 수주보다 팀 안정성 우선.', '크리에이티브 에이전시 운영 노하우: 인력이 곧 자산. 핵심 인력 유지가 최우선. 프로젝트 실패보다 핵심 인력 이탈이 더 큰 리스크. 무리한 프로젝트 수주보다 팀 안정성 우선.', 'domain_expertise', 'ceo_pattern_seed', 'CEO', 0.93, 0.93, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "에이전시 경영 철학. 장기 전략 수립의 기초."}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 23/30: collaboration_pattern
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', 'CEO(김경신)와 CD(크리에이티브 디렉터) 간 소통: 크리에이티브 방향의 ''큰 그림''은 CEO가 설정하고 세부 실행은 CD에게 위임. 의견 충돌 시 ''클라이언트 가치'' 기준으로 판단.', 'CEO(김경신)와 CD(크리에이티브 디렉터) 간 소통: 크리에이티브 방향의 ''큰 그림''은 CEO가 설정하고 세부 실행은 CD에게 위임. 의견 충돌 시 ''클라이언트 가치'' 기준으로 판단.', 'collaboration_pattern', 'ceo_pattern_seed', 'CEO', 0.88, 0.88, true, 'creative', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "CEO 패턴 시딩"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 24/30: collaboration_pattern
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', 'CEO와 EP(총괄 프로듀서) 간 소통: 계약/정산/리소스는 EP 주도. CEO는 최종 승인 역할. 예산 10% 이상 변동 시 CEO 사전 승인 필수.', 'CEO와 EP(총괄 프로듀서) 간 소통: 계약/정산/리소스는 EP 주도. CEO는 최종 승인 역할. 예산 10% 이상 변동 시 CEO 사전 승인 필수.', 'collaboration_pattern', 'ceo_pattern_seed', 'CEO', 0.89, 0.89, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "CEO 패턴 시딩"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 25/30: collaboration_pattern
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', 'CEO와 PD(프로듀서/라인PD) 간 소통: 현장 조율과 일정 관리는 PD 자율. 주간 진행 상황 요약 보고 필수. 일정 지연 2일 이상 시 대응 방안과 함께 보고.', 'CEO와 PD(프로듀서/라인PD) 간 소통: 현장 조율과 일정 관리는 PD 자율. 주간 진행 상황 요약 보고 필수. 일정 지연 2일 이상 시 대응 방안과 함께 보고.', 'collaboration_pattern', 'ceo_pattern_seed', 'CEO', 0.87, 0.87, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "CEO 패턴 시딩"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 26/30: collaboration_pattern
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', 'CEO와 AD(아트 디렉터/시니어AD) 간 소통: 비주얼 방향은 CD를 경유하되, 핵심 프로젝트는 CEO가 직접 디자인 QC. PPT 덱 퀄리티에 특히 높은 기준 적용.', 'CEO와 AD(아트 디렉터/시니어AD) 간 소통: 비주얼 방향은 CD를 경유하되, 핵심 프로젝트는 CEO가 직접 디자인 QC. PPT 덱 퀄리티에 특히 높은 기준 적용.', 'collaboration_pattern', 'ceo_pattern_seed', 'CEO', 0.85, 0.85, true, 'creative', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "CEO 패턴 시딩"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 27/30: collaboration_pattern
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', 'CEO와 클라이언트 간 소통: 초기 관계 구축은 CEO가 직접. 안정화 후 담당 팀에 이관. 크리티컬 이슈(불만, 계약 변경) 시 CEO가 다시 전면에 등장.', 'CEO와 클라이언트 간 소통: 초기 관계 구축은 CEO가 직접. 안정화 후 담당 팀에 이관. 크리티컬 이슈(불만, 계약 변경) 시 CEO가 다시 전면에 등장.', 'collaboration_pattern', 'ceo_pattern_seed', 'CEO', 0.91, 0.91, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "CEO 패턴 시딩"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 28/30: collaboration_pattern
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', 'CEO와 외부 파트너(벤더) 간 소통: 핵심 벤더(촬영감독, 편집실)와는 CEO가 직접 관계 유지. 단가 협상은 EP에게 위임하되 최종 합의는 CEO 확인.', 'CEO와 외부 파트너(벤더) 간 소통: 핵심 벤더(촬영감독, 편집실)와는 CEO가 직접 관계 유지. 단가 협상은 EP에게 위임하되 최종 합의는 CEO 확인.', 'collaboration_pattern', 'ceo_pattern_seed', 'CEO', 0.86, 0.86, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "CEO 패턴 시딩"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 29/30: communication_style
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '팀 전체 커뮤니케이션 룰: 긴급도에 따라 채널 구분 — 긴급: 전화, 중요: 대면/화상, 일상: 메신저. 회의는 30분 이내, 결론 없는 회의는 금지.', '팀 전체 커뮤니케이션 룰: 긴급도에 따라 채널 구분 — 긴급: 전화, 중요: 대면/화상, 일상: 메신저. 회의는 30분 이내, 결론 없는 회의는 금지.', 'communication_style', 'ceo_pattern_seed', 'CEO', 0.9, 0.9, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "CEO 패턴 시딩"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- Item 30/30: workflow
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'team', '프로젝트별 보고 체계: 주 1회 진행 상황 공유(전체), 이슈 발생 시 당일 내 보고(관련자), 월 1회 포트폴리오 + 재무 현황 리뷰(CEO+EP).', '프로젝트별 보고 체계: 주 1회 진행 상황 공유(전체), 이슈 발생 시 당일 내 보고(관련자), 월 1회 포트폴리오 + 재무 현황 리뷰(CEO+EP).', 'workflow', 'ceo_pattern_seed', 'CEO', 0.88, 0.88, true, 'operations', '김경신', 'confirmed', '{"project_name": "", "client": "", "reason": "CEO 패턴 시딩"}'::JSONB)
  ON CONFLICT DO NOTHING;

END $$;

-- Summary
SELECT COUNT(*) as total_seeded FROM knowledge_items WHERE source_type = 'ceo_pattern_seed';
