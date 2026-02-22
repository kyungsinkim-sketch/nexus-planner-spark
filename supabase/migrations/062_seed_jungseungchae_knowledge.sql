-- ============================================================
-- Migration 062: 정승채(경영실장) 대화 분석 CEO 패턴 시딩
--
-- Source: docs/ceo-patterns/07_jungseungchae.md
-- 기간: 2025-07-30 ~ 2026-02-12 (약 6.5개월)
-- 주요 사안: 법적 분쟁 3건 + 인사 관리 + 예산 관리 + 위임 패턴
--
-- 30개 knowledge_items (법적 대응, 인사, 예산, 위임, 교훈 등)
-- dialectic_tag 적용: risk, constraint, client_concern 등
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find CEO user (김경신)
  SELECT id INTO v_user_id FROM profiles WHERE name = '김경신' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'CEO profile not found, using NULL user_id';
  END IF;

  -- ─── 법적 분쟁 대응 패턴 (7개) ─────────────────────────────

  -- JSC-1: SW 불법사용 압박 대응 원칙
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', 'SW 불법사용 압박 대응 7대 원칙: 1)입증 책임은 100% 상대방, 2)서면으로만 공식 요청, 3)방문 행위 자체를 문제 삼을 수 있음, 4)내부 점검 후 적법성 확보, 5)상대방의 압박 전술에 감정적 대응 금지, 6)법률 자문 우선, 7)모든 커뮤니케이션 기록 보존. CEO가 GPT를 활용하여 직접 전략 설계.', 'SW 불법사용 압박 대응 7대 원칙: 입증 책임은 상대방, 서면 대응 원칙, 방문 자체 문제화 가능', 'recurring_risk', 'ceo_pattern_seed', 'CEO', 0.95, 0.95, true, 'strategy', '김경신', 'confirmed', 'risk', '{"source_file": "07_jungseungchae.md", "context": "SW 불법사용 압박에 대한 CEO 법적 대응 전략"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-2: 에이팀 외주 분쟁 공격적 대응
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '외주 분쟁 대응: 방어만이 아닌 공격적 법률 대응도 검토. 반격 카드로 동시이행 항변권 활용, 반소 검토. CEO가 GPT 분석 + 자체 판단으로 전략 설계. "이건 GPT 의견이다"라고 출처를 투명하게 밝히되 최종 판단은 CEO가 내림.', '외주 분쟁: 방어+공격 양면 대응. 동시이행 항변권, 반소 검토', 'recurring_risk', 'ceo_pattern_seed', 'CEO', 0.90, 0.90, true, 'strategy', '김경신', 'confirmed', 'risk', '{"source_file": "07_jungseungchae.md", "context": "에이팀 외주 분쟁 공격적 법률 대응"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-3: 조아라 부당해고 행정소송 전략
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '조아라 부당해고 행정소송 대응: CEO가 5대 쟁점을 직접 정리. "본 소송은 단순한 금전 문제가 아니라 향후 조직 운영 원칙과도 연결"로 판단. 선례적 의미를 고려한 전략 수립. 변호사 역량/태도를 직접 평가하여 담당 변호사 교체 결정("의지가 없어서 백전필패").', '조아라 행정소송: 5대 쟁점 CEO 직접 정리, 선례적 의미 고려, 변호사 교체 결정', 'recurring_risk', 'ceo_pattern_seed', 'CEO', 0.93, 0.93, true, 'strategy', '김경신', 'confirmed', 'risk', '{"source_file": "07_jungseungchae.md", "context": "조아라 부당해고 행정소송 5대 쟁점 + 변호사 교체"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-4: 법적 분쟁 통합 원칙
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '법적 분쟁 대응 통합 원칙: 1)서면 대응 원칙(구두 약속 금지), 2)입증 자료(CCTV, 문서) 선제 확보, 3)변호사 성과 직접 평가 + 교체 주저 않음, 4)GPT를 법률 분석 도구로 활용하되 최종 판단은 CEO, 5)감정 배제하고 전략적 대응, 6)선례적 의미 고려한 장기 판단.', '법적 분쟁: 서면 원칙, 증거 선제 확보, 변호사 평가, GPT 활용, 선례적 의미 고려', 'recurring_risk', 'ceo_pattern_seed', 'CEO', 0.95, 0.95, true, 'strategy', '김경신', 'confirmed', 'risk', '{"source_file": "07_jungseungchae.md", "context": "3건 분쟁(SW불법사용/에이팀외주/조아라행정소송)에서 도출된 통합 원칙"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-5: 변호사 선임/평가 기준
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '변호사 선임/평가: "대륜에 연락해서 담당 변호사 변경신청하는게 좋을 것 같아요. 의지가 없어서 백전필패" — 변호사의 전문성뿐 아니라 의지/적극성을 평가. 성과 미달 시 즉시 교체. 대형 로펌이라도 담당자 역량이 핵심.', '변호사 평가: 전문성+의지 모두 평가, 성과 미달 시 즉시 교체', 'vendor_selection', 'ceo_pattern_seed', 'CEO', 0.90, 0.88, true, 'strategy', '김경신', 'confirmed', 'risk', '{"source_file": "07_jungseungchae.md", "context": "대륜 변호사 교체 결정"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-6: GPT/AI를 법률·경영 전략 도구로 활용
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'CEO의 AI 활용 패턴: GPT를 법률·경영 전략 분석 도구로 적극 활용. SW 불법사용 대응 7대 원칙, 에이팀 분쟁 전략, 조아라 행정소송 5대 쟁점을 모두 GPT 활용하여 분석. 단, "GPT는 위와 같이 답변을 주네요"로 AI 출처를 투명하게 밝히고, 최종 판단은 반드시 CEO 자신이 내림.', 'CEO AI 활용: GPT로 법률/경영 전략 분석, 출처 투명하게 밝히되 최종 판단은 CEO', 'lesson_learned', 'ceo_pattern_seed', 'CEO', 0.90, 0.85, true, 'strategy', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "P16 패턴: GPT/AI를 법률·경영 전략 도구로 활용"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-7: 과로사 리스크 인식
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '크리에이티브팀 야간 작업에 대해 과로사 뉴스 기사 공유하며 경고: "일을 줄이던, 작업을 효율적으로 개선하던 방법이 필요해보입니다" — 노동 리스크에 대한 경각심. 팀원 건강이 곧 조직 리스크.', '야간 작업 과로사 리스크: 일 줄이거나 효율 개선 필요', 'recurring_risk', 'ceo_pattern_seed', 'CEO', 0.85, 0.85, true, 'culture', '김경신', 'confirmed', 'risk', '{"source_file": "07_jungseungchae.md", "context": "크리에이티브팀 야간 작업 과로 리스크 인식"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- ─── 인사/인재 관리 패턴 (8개) ──────────────────────────────

  -- JSC-8: 손절 타이밍
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', '인재 손절 타이밍: "맘 떠난거면 어차피 일을 할 수 없을테니 빠르게 정리하는게 나을거 같아요" → "그냥 바로 사직서 받는게 나을듯" — 미련 없는 빠른 정리. 감정적 회유 자제. 과거 카톡 선물 등으로 무마하려다 역효과 경험에서 학습.', '인재 손절: 맘 떠나면 빠른 정리, 감정적 회유 자제', 'talent_casting', 'ceo_pattern_seed', 'CEO', 0.92, 0.90, true, 'culture', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "P17 패턴: 정유진 퇴사 처리에서 도출된 손절 타이밍"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-9: 연봉 형평성 판단
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '연봉 결정 시 내부 형평성 기준 적용: "경력 비교 부탁" → "단순비교했을때 지수님보다 확실히 경력이 긴지만? 장하리님 정도 대우받을만한지" — 개인 기여도 + 내부 비교 + 시장 가치를 종합 판단. 기여도 높은 직원에게는 "담번에 대폭 올려줘야할 것 같아요".', '연봉: 내부 형평성+기여도+시장가치 종합, 기여도 높으면 대폭 인상', 'talent_casting', 'ceo_pattern_seed', 'CEO', 0.88, 0.88, true, 'operations', '김경신', 'confirmed', 'constraint', '{"source_file": "07_jungseungchae.md", "context": "이지수/정유진/장하리 연봉 비교 판단"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-10: 채용 협상 트레이드오프
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', '채용 협상 트레이드오프: "연봉 동결에 대해서는 협의됐습니다 대신 3개월 수습 100%를 내주었고" — 한쪽을 양보하면 다른 쪽을 확보하는 균형잡힌 협상. 경영실장에게 협상을 위임하되 조건 프레임은 CEO가 설정.', '채용 협상: 연봉 동결 ↔ 수습 100% 보장 트레이드오프', 'talent_casting', 'ceo_pattern_seed', 'CEO', 0.85, 0.85, true, 'operations', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "2D 디자이너 채용 협상 위임"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-11: 겸직 허용 기준
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', '겸직 허용 판단: "원래 겸직이 안되지만 이번경우는 원래 하시던 부분이 있으니 특별히 수습기간동안 양허하겠다" — 원칙 유지하되 합리적 예외 인정. 수습 기간이라는 한정 조건 설정으로 무한 예외 방지.', '겸직: 원칙 유지 + 합리적 예외(수습 기간 한정)', 'talent_casting', 'ceo_pattern_seed', 'CEO', 0.83, 0.80, true, 'culture', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "정형화(신입PD) 겸직 허용 판단"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-12: 협상 전술 간파
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', '연봉 협상 전술 간파: 티아고 연봉 "57,425,000원이면 문제 없을 것 같다고합니다" → CEO "아 그렇군요 협상카드로 그냥 가져온 것 같네요" — 상대방의 최초 제시가 협상 전술인지 진심인지를 판별하는 능력. 숫자 뒤의 의도를 읽음.', '연봉 협상: 상대방 최초 제시의 진의 판별, 협상 전술 간파', 'talent_casting', 'ceo_pattern_seed', 'CEO', 0.82, 0.82, true, 'operations', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "티아고 연봉 협상 전술 간파"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-13: 인사 불만 대응 (감정적 회유 자제)
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', '인사 불만 대응 패턴: 이지수 인사 평가 불만 사건에서 "지난 10년을 생각했을때 주니어중에서 지수님처럼 했던 경우가 크게 없었던 것 같아요... 왜.. 였을까요?" — 감정적 대응 대신 근본 원인 탐색. 과거 카톡 선물로 무마하려다 "예전같은 실수를 범하게될 것 같아서 꾹 참았습니다" — 실패 경험에서 학습.', '인사 불만: 감정 회유 자제, 구조적 원인 분석, 과거 실패에서 학습', 'lesson_learned', 'ceo_pattern_seed', 'CEO', 0.93, 0.92, true, 'culture', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "이지수 인사평가 불만 + 과거 감정적 회유 실패 학습"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-14: 채용 미스매치 분석
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', '채용 미스매치 분석: 정유진 퇴사 원인을 역량 부족이 아닌 기대치 불일치로 진단. "생각보다 큰 프로젝트여서 당황한게 큰 것 같네요" — 채용 시 프로젝트 규모/난이도에 대한 사전 공유 필요성 시사.', '채용 미스매치: 역량 부족 아닌 기대치 불일치가 퇴사 원인', 'lesson_learned', 'ceo_pattern_seed', 'CEO', 0.85, 0.85, true, 'culture', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "정유진 퇴사 원인 분석"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-15: 인사 판단 이중 구조
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'CEO 인사 판단의 이중 구조: 기여도 높은 직원에게는 "대폭 올려줘야"(이지수), 맘 떠난 직원은 "바로 사직서"(정유진). 과거 실패에서 학습하여 감정적 회유를 자제하고 구조적 해결을 추구. 연봉·대우·성장 기회로 보상, 손절은 빠르게.', 'CEO 인사: 기여도→파격 보상, 이탈→빠른 정리 이중 구조', 'talent_casting', 'ceo_pattern_seed', 'CEO', 0.92, 0.92, true, 'culture', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "이지수 대폭 인상 vs 정유진 즉시 사직서"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- ─── 예산/비용 관리 패턴 (5개) ──────────────────────────────

  -- JSC-16: 예산 절차 문제 지적
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '예산 승인 절차 위반에 대한 즉각 지적: 10주년 행사비 1,200만→2,000만 증액이 보고 절차 없이 진행된 것에 "비확정적 상황인데 왜 이렇게 지급 결의내역에 포함되어 있는지... 절차상 문제가 있어보이네요" — 금액 자체보다 프로세스 위반을 문제시. 비확정 사항을 확정처럼 보고하는 것을 경계.', '예산 절차: 보고 없는 증액 즉각 지적, 프로세스 위반>금액 문제', 'budget_decision', 'ceo_pattern_seed', 'CEO', 0.95, 0.93, true, 'operations', '김경신', 'confirmed', 'constraint', '{"source_file": "07_jungseungchae.md", "context": "브랜드바이브 10주년 행사비 증액 절차 문제"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-17: 과도한 지출보다 원안 복귀
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '예산 관리 원칙: "예산 너무 부담되면 그냥 원래 계획대로 우리끼리 소소하게 진행해도 무방" — 무리한 확장보다 현실적 범위 내 실행 지향. 과도한 지출보다 원안 복귀를 선호. 행사 규모를 키우는 것보다 실속 있는 실행이 우선.', '예산: 과도한 확장보다 원안 복귀 선호, 실속 실행 우선', 'budget_decision', 'ceo_pattern_seed', 'CEO', 0.90, 0.88, true, 'operations', '김경신', 'confirmed', 'constraint', '{"source_file": "07_jungseungchae.md", "context": "10주년 행사 예산 과잉 시 원안 복귀 선호"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-18: 전략적 관계 투자
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', '비용 관리 이중 기준: 내부 행사비는 절제("소소하게 진행해도 무방")하지만, 전략적 관계 투자에는 관대. 마사야 호텔비 "10-20만원 차이라면 그냥 다 지원해주는게 어떨까" — "제가 나중에 도움받을게 있는 사람이라 잘 대해주면 좋을 것 같아요." 클라이언트 KTX 20만원도 관계 유지 차원 수용.', '비용 이중 기준: 내부 절제, 전략적 관계 투자에는 관대', 'budget_decision', 'ceo_pattern_seed', 'CEO', 0.88, 0.88, true, 'strategy', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "마사야 호텔비 + 클라이언트 KTX 비용 수용"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-19: 선금 현금흐름 관리
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '선금 수령 타이밍 직접 관리: "CSR선금의 경우 촬영 전에는 받으면 좋을 것 같은데 상황이 좀 어떤가요!" — 현금흐름에 민감. 촬영 시작 전 선금 확보를 원칙으로. 대금 수수 타이밍을 CEO가 직접 체크.', '현금흐름: 촬영 전 선금 확보 원칙, CEO 직접 타이밍 관리', 'payment_tracking', 'ceo_pattern_seed', 'CEO', 0.90, 0.88, true, 'operations', '김경신', 'confirmed', 'constraint', '{"source_file": "07_jungseungchae.md", "context": "현대차 CSR 영상 선금 수령 타이밍"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-20: 보조금/네트워크 활용
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', '네트워크 활용 보조금 확보: 국제회의 지원공고에 대해 "가라로해서 제출하면 지원금 보전 받을 수 있는 건데..." — 담당자가 아는 후배. 관행적 운영 방식에 대한 현실 감각. KAIST 교수, 유니코서치, 브랜드브리프 기자 등 다양한 네트워크 적극 활용.', '네트워크: 보조금 확보, 인맥 활용, 관행적 운영 현실 감각', 'deal_decision', 'ceo_pattern_seed', 'CEO', 0.78, 0.78, true, 'strategy', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "국제회의 지원금 + 다양한 네트워크 활용"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- ─── 위임 + 적시 개입 패턴 (4개) ──────────────────────────────

  -- JSC-21: 위임 + 적시 개입 모델
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'CEO의 위임+적시 개입 모델(정승채 사례): 예산·인사·법무·총무를 경영실장에게 폭넓게 위임하되, 예산 승인 절차 문제, 연봉 형평성 기준, 법적 전략 방향 등 핵심 판단에서는 즉시 개입. "구체적인 협의 및 제안은 승채님께 위임하도록 할게요!" ↔ "보고 절차 없이 사업비가 2000만원 증액... 절차상 문제"', 'CEO 위임 모델: 실무 위임 + 핵심 판단 즉시 개입', 'lesson_learned', 'ceo_pattern_seed', 'CEO', 0.95, 0.95, true, 'strategy', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "P6 패턴: 정승채에게 위임 후 적시 개입의 가장 극명한 사례"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-22: 경영실장 역할 정의
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'PD→경영실장 전직: 정승채를 Producer에서 경영실장으로 전직시키며 예산·인사·법무·총무를 점진적으로 위임. CEO는 경영 인수인계서를 직접 작성하여 전달. Paulus.ai 업무 구조 7대 항목을 1:1로 상세 설명 — 경영실장이 시스템을 체계적으로 이해하도록 교육.', '경영실장: PD→전직, CEO가 직접 교육, 점진적 권한 확대', 'talent_casting', 'ceo_pattern_seed', 'CEO', 0.90, 0.88, true, 'strategy', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "정승채의 PD→경영실장 전직과 CEO의 교육적 접근"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-23: 촬영 위임 판단
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'CEO 시간 배분 전략: "이번 촬영은 제가 쭉 동행하지는 않아도 괜찮겠죠?" — 모든 촬영에 직접 가지 않아도 되는 위임 가능 여부를 확인. CEO의 시간을 전략적으로 배분하기 위한 판단. 위임 가능한 실행과 CEO 직접 참여가 필요한 영역을 구분.', 'CEO 시간 배분: 촬영 동행 위임 가능 여부 판단', 'schedule_change', 'ceo_pattern_seed', 'CEO', 0.82, 0.80, true, 'operations', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "현대 울산공장 촬영 동행 위임"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-24: 결의 기반 파트너십
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'CEO-경영실장 결의 기반 파트너십: 단순 상하 관계가 아닌 상호 충성과 결의에 기반. CEO는 감정적 유대 + 교육적 투자 + 점진적 권한 확대로 보답. 생활 밀착형 케어(공항 픽업, 맛집, 건강, 장례 배려)를 통해 충성도와 역량을 동시에 키움 — "사람 기반 경영" 철학의 핵심 증거.', 'CEO-경영실장: 결의 기반 파트너십, 생활 밀착 케어, 사람 기반 경영', 'lesson_learned', 'ceo_pattern_seed', 'CEO', 0.90, 0.90, true, 'culture', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "P15 패턴: 정승채와의 결의 기반 파트너십"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- ─── 크리에이티브/전략 패턴 (3개) ──────────────────────────────

  -- JSC-25: UX 미니멀리즘 철학
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'CEO UX 철학: "요즘 UI적으로 글씨가 적고, 내용 중복 없고, 깔끔한게 최고" — 미니멀리즘 지향. 구글폼 UX도 직접 개선: "참석유무를 묻는 문항은 삭제... 참석 안한다면 당연히 구글폼을 작성 안할테니까요", "동반인 문항도 삭제... 동반인 있으면 그사람이 직접 링크 들어가서 작성하도록" — 사용자 경험 관점 최적화.', 'UX 미니멀리즘: 글씨 적고 깔끔, 불필요한 문항 삭제, 사용자 관점', 'campaign_strategy', 'ceo_pattern_seed', 'CEO', 0.88, 0.85, true, 'creative', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "세미나 웹사이트 구글폼 UX 최적화"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-26: 카피/크리에이티브 검수
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'CSR 영상 엔딩 카피 검수: 팀이 피드백 반영본 + 카피 옵션 제시 → CEO "확인완료 혁님한테 얘기할게요" — 카피 검수 후 빠른 승인. 세미나 세션 제목도 CEO가 직접 작성. 프로그램 구성을 직접 설계하면서도 실행은 위임.', '카피 검수: 옵션 제시→CEO 빠른 승인, 세미나 구성 직접 설계', 'creative_direction', 'ceo_pattern_seed', 'CEO', 0.80, 0.78, true, 'creative', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "CSR 영상 카피 + 세미나 세션 구성"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-27: 클라이언트 관계 관리 비용 수용
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, dialectic_tag, source_context)
  VALUES (v_user_id, 'global', '클라이언트 비합리적 요청 수용 기준: KTX 비용 20만원에 대해 "ㅋㅋㅋ 그냥 기차타고싶은가보네요 해드려야죠 머" — 관계 유지 차원에서 소액 비합리적 요청 수용. 내부적으로 정확히 인지하되 문제 삼지 않음. 단, 관계 가치 대비 비용이 과도하면 거절.', '클라이언트 관계: 소액 비합리적 요청 수용, 관계 유지 우선', 'budget_decision', 'ceo_pattern_seed', 'CEO', 0.82, 0.82, true, 'operations', '김경신', 'confirmed', 'client_concern', '{"source_file": "07_jungseungchae.md", "context": "클라이언트 KTX 비용 수용"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- ─── 교훈/학습 패턴 (3개) ──────────────────────────────────

  -- JSC-28: 전략적 질문으로 사고 유도
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'CEO 교육적 리더십: 직접 답을 주지 않고 전략적 질문으로 사고 유도. "왜.. 였을까요?" (이지수 불만 원인), "이 사항이 혹시 어떻게 된 것인지 설명 좀 해주실 수 있을까요?" (예산 경위), "비교했을때 어때요?" (연봉 형평성) — 팀원이 스스로 분석하도록 유도.', 'CEO 교육: 답 대신 전략적 질문, 팀원 자체 분석 유도', 'lesson_learned', 'ceo_pattern_seed', 'CEO', 0.90, 0.88, true, 'culture', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "P9 패턴: 전략적 질문으로 사고 유도"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-29: 문서화/프로세스 표준화
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', 'CEO의 문서화/표준화 강조: Paulus.ai 업무 구조 7대 항목 문서화, 경영실장 업무 인수인계서 전달, 야간/연장/주휴 근무 기준 산식 요청, 직원 출근 통계 데이터 요청, 장비 판매 장부 정리 지시 — 체계적 기록 관리를 통한 경영 투명성 확보.', '문서화: 업무 구조, 인수인계, 근무 기준, 통계 데이터, 장부 체계화', 'lesson_learned', 'ceo_pattern_seed', 'CEO', 0.88, 0.85, true, 'operations', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "P10 패턴: 문서화/프로세스 표준화"}'::JSONB)
  ON CONFLICT DO NOTHING;

  -- JSC-30: 상황별 속도 조절
  INSERT INTO knowledge_items (user_id, scope, content, summary, knowledge_type, source_type, role_tag, confidence, relevance_score, is_active, scope_layer, decision_maker, outcome, source_context)
  VALUES (v_user_id, 'global', '상황별 속도 조절: 인사(정유진 퇴사)는 "빠르게 정리" → 당일 사직서. 법적 분쟁(조아라/에이팀)은 "차분하게 냉정하게" + 5대 쟁점 정리. 예산 문제는 즉각 지적하되 원안 복귀라는 출구 제시. 상황의 성격에 따라 템포를 의식적으로 조절.', '속도 조절: 인사→즉시, 법률→차분, 예산→즉각 지적+출구 제시', 'lesson_learned', 'ceo_pattern_seed', 'CEO', 0.88, 0.88, true, 'strategy', '김경신', 'confirmed', '{"source_file": "07_jungseungchae.md", "context": "P4 패턴: 상황별 속도 vs 퀄리티 판단"}'::JSONB)
  ON CONFLICT DO NOTHING;

END;
$$;

-- ─── 정승채 패턴에 dialectic_tag 추가 할당 ──────────────────────
-- (위 INSERT에서 이미 dialectic_tag를 설정한 항목 외 추가 태깅)

-- 법적 분쟁 관련 → risk (이미 설정됨)
-- 예산 절차 위반 → constraint (이미 설정됨)
-- 채용 미스매치 → risk
UPDATE knowledge_items SET dialectic_tag = 'risk'
WHERE source_context->>'source_file' = '07_jungseungchae.md'
  AND dialectic_tag IS NULL
  AND content LIKE '%미스매치%';

-- 클라이언트 관계 비용 → client_concern (이미 설정됨)
