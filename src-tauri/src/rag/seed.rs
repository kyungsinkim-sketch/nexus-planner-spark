/// CEO Pattern Seeding — 30 initial knowledge items
///
/// Seeds the local RAG database with CEO (김경신) patterns on first run.
/// These patterns represent the agency's operational wisdom and decision-making
/// principles, covering budget, creative, collaboration, and workflow domains.
///
/// Source: 059_seed_ceo_knowledge.sql (Supabase migration)

use crate::rag::db::RagDb;
use crate::rag::embedding::EmbeddingEngine;
use crate::rag::knowledge::{self, KnowledgeItem};

/// Check if CEO seed data has already been loaded.
pub fn is_seeded(db: &RagDb) -> Result<bool, String> {
    knowledge::is_extracted(db, "ceo_pattern_seed", "ceo_30_patterns_v1")
}

/// Seed all 30 CEO patterns into the local database.
/// Returns the number of items created.
pub fn seed_ceo_patterns(
    db: &RagDb,
    embedding: &EmbeddingEngine,
) -> Result<usize, String> {
    if is_seeded(db)? {
        log::info!("CEO patterns already seeded, skipping");
        return Ok(0);
    }

    let patterns = get_ceo_patterns();
    let mut count = 0;

    for pattern in &patterns {
        let embed_result = embedding.embed(&pattern.content)?;

        let item = KnowledgeItem {
            id: String::new(),
            content: pattern.content.clone(),
            summary: None,
            knowledge_type: pattern.knowledge_type.clone(),
            source_type: "ceo_pattern_seed".to_string(),
            scope: "global".to_string(),
            scope_layer: pattern.scope_layer.clone(),
            role_tag: Some("CEO".to_string()),
            dialectic_tag: pattern.dialectic_tag.clone(),
            confidence: pattern.confidence,
            relevance_score: pattern.relevance_score,
            usage_count: 0,
            decision_maker: Some("김경신".to_string()),
            outcome: Some("confirmed".to_string()),
            financial_impact_krw: None,
            source_id: Some("ceo_30_patterns_v1".to_string()),
            source_context: pattern.source_context.clone(),
            user_id: None, // Global — not tied to a specific user
            project_id: None,
            did_author: None,
            is_active: true,
            expires_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        knowledge::create_knowledge_item(db, &item, &embed_result.vector)?;
        count += 1;
    }

    // Mark as extracted to prevent re-seeding
    knowledge::mark_extracted(db, "ceo_pattern_seed", "ceo_30_patterns_v1", count as i64)?;
    log::info!("Seeded {} CEO knowledge patterns", count);

    Ok(count)
}

// ── Pattern Data ───────────────────────────────────────

struct CeoPattern {
    content: String,
    knowledge_type: String,
    confidence: f64,
    relevance_score: f64,
    scope_layer: Option<String>,
    dialectic_tag: Option<String>,
    source_context: Option<String>,
}

fn get_ceo_patterns() -> Vec<CeoPattern> {
    vec![
        // 1. 수주 결정
        CeoPattern {
            content: "프로젝트 수주 결정 시 '내수율(수익률)' 기준으로 판단. 총 계약금액 대비 실제 내수가 30% 이하면 수주 거부 또는 재협상 요구. '돈 안 되는 일은 하지 않는다'는 원칙 고수.".into(),
            knowledge_type: "deal_decision".into(),
            confidence: 0.95,
            relevance_score: 0.9,
            scope_layer: Some("operations".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"수주 의사결정 시 내수율 기준 판단 패턴"}"#.into()),
        },
        // 2. 예산 협상
        CeoPattern {
            content: "예산 협상 시 '목표 내수율'을 역산하여 견적 하한선을 설정. 인건비+외주비+관리비를 먼저 산출하고, 목표 수익률을 더한 금액이 최소 견적. 클라이언트가 예산을 낮추면 스코프 축소로 대응.".into(),
            knowledge_type: "budget_decision".into(),
            confidence: 0.92,
            relevance_score: 0.9,
            scope_layer: Some("operations".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"예산 협상 시 견적 하한선 산출 방식"}"#.into()),
        },
        // 3. 대금 결제 조건
        CeoPattern {
            content: "대금 결제 조건은 '3:3:4' 또는 '5:5' 구조 선호. 선금 비율이 30% 미만이면 리스크 경고. 촬영 전 잔금 완납 불가 시 촬영 일정 조정도 불사.".into(),
            knowledge_type: "payment_tracking".into(),
            confidence: 0.90,
            relevance_score: 0.85,
            scope_layer: Some("operations".into()),
            dialectic_tag: Some("risk".into()),
            source_context: Some(r#"{"reason":"대금 결제 조건 및 리스크 관리 패턴"}"#.into()),
        },
        // 4. 계약 리스크
        CeoPattern {
            content: "계약 리스크 판단: 독소조항(지재권 양도, 과도한 위약금) 발견 시 법무팀 검토 후 수정 요구. 양보 불가 조항 리스트를 사전에 관리.".into(),
            knowledge_type: "recurring_risk".into(),
            confidence: 0.88,
            relevance_score: 0.85,
            scope_layer: Some("operations".into()),
            dialectic_tag: Some("risk".into()),
            source_context: Some(r#"{"reason":"계약서 독소조항 대응 패턴"}"#.into()),
        },
        // 5. 예산 초과 대응
        CeoPattern {
            content: "예산 초과 시 대응 원칙: 1) 우선순위 재정렬(must-have vs nice-to-have), 2) 스코프 축소 제안, 3) 추가 예산 협상, 4) 최악의 경우 손절 판단. 감정이 아닌 숫자로 결정.".into(),
            knowledge_type: "budget_judgment".into(),
            confidence: 0.91,
            relevance_score: 0.9,
            scope_layer: Some("operations".into()),
            dialectic_tag: Some("constraint".into()),
            source_context: Some(r#"{"reason":"예산 초과 시 단계적 대응 원칙"}"#.into()),
        },
        // 6. 크리에이티브 방향
        CeoPattern {
            content: "크리에이티브 방향 결정은 '클라이언트 니즈 우선'이지만 '우리만의 해석'을 반드시 포함. '클라이언트가 원하는 것'과 '클라이언트에게 필요한 것'을 구분하여 제안.".into(),
            knowledge_type: "creative_direction".into(),
            confidence: 0.93,
            relevance_score: 0.9,
            scope_layer: Some("creative".into()),
            dialectic_tag: Some("quality".into()),
            source_context: Some(r#"{"reason":"크리에이티브 방향 설정 원칙"}"#.into()),
        },
        // 7. 캠페인 전략
        CeoPattern {
            content: "캠페인 전략 수립 시 '타겟 인사이트 → 핵심 메시지 → 크리에이티브 컨셉 → 실행 계획' 순서를 고수. 컨셉 없이 실행부터 들어가는 것을 경계.".into(),
            knowledge_type: "campaign_strategy".into(),
            confidence: 0.90,
            relevance_score: 0.85,
            scope_layer: Some("creative".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"캠페인 전략 수립 프로세스"}"#.into()),
        },
        // 8. 네이밍 결정
        CeoPattern {
            content: "네이밍/슬로건 결정 시 3가지 기준: 1) 발음 용이성(한영 모두), 2) 의미 전달력, 3) 법적 보호 가능성. 후보 3-5개를 테스트 후 최종 결정.".into(),
            knowledge_type: "naming_decision".into(),
            confidence: 0.87,
            relevance_score: 0.8,
            scope_layer: Some("creative".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"네이밍/슬로건 결정 기준"}"#.into()),
        },
        // 9. 어워드 전략
        CeoPattern {
            content: "어워드 제출 전략: 칸/원쇼/클리오 등 티어1 어워드 위주로 집중. 수상 가능성 50% 미만이면 제출 안 함. 케이스 필름 퀄리티가 수상의 80%를 결정한다고 판단.".into(),
            knowledge_type: "award_strategy".into(),
            confidence: 0.88,
            relevance_score: 0.8,
            scope_layer: Some("creative".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"어워드 제출 전략 및 ROI 판단"}"#.into()),
        },
        // 10. 탤런트 캐스팅
        CeoPattern {
            content: "탤런트/모델 캐스팅 시 예산 대비 효과 분석 우선. A급 탤런트 비용이 전체 제작비의 40%를 초과하면 대안 탐색. 신인 발굴 통한 비용 절감 + 신선함 확보 전략 선호.".into(),
            knowledge_type: "talent_casting".into(),
            confidence: 0.86,
            relevance_score: 0.8,
            scope_layer: Some("creative".into()),
            dialectic_tag: Some("constraint".into()),
            source_context: Some(r#"{"reason":"탤런트 캐스팅 예산 대비 효과 판단"}"#.into()),
        },
        // 11. PT 구조
        CeoPattern {
            content: "PT(제안서) 구조: 1) 클라이언트 과제 재정의(공감), 2) 시장/소비자 인사이트, 3) 전략 방향, 4) 크리에이티브 컨셉, 5) 실행 계획, 6) 예산/일정. 6페이지 내 핵심 전달이 이상적.".into(),
            knowledge_type: "pitch_execution".into(),
            confidence: 0.93,
            relevance_score: 0.9,
            scope_layer: Some("pitch".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"제안서 표준 구조"}"#.into()),
        },
        // 12. 외주 업체 선정
        CeoPattern {
            content: "외주 업체 선정 기준: 1) 포트폴리오 퀄리티, 2) 일정 준수 이력, 3) 단가 합리성, 4) 커뮤니케이션 수월성. 신규 업체는 소규모 테스트 후 본계약.".into(),
            knowledge_type: "vendor_selection".into(),
            confidence: 0.89,
            relevance_score: 0.85,
            scope_layer: Some("operations".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"외주 업체 선정 기준 체계"}"#.into()),
        },
        // 13. 일정 변경
        CeoPattern {
            content: "일정 변경 원칙: 클라이언트 요청에 의한 변경은 추가 비용 협상 필수. 내부 지연은 야근/주말 투입으로 만회. 마감 D-3일 이내 변경은 퀄리티 리스크로 간주.".into(),
            knowledge_type: "schedule_change".into(),
            confidence: 0.91,
            relevance_score: 0.9,
            scope_layer: Some("operations".into()),
            dialectic_tag: Some("risk".into()),
            source_context: Some(r#"{"reason":"일정 변경 시 비용/리스크 대응 원칙"}"#.into()),
        },
        // 14. 촬영 현장 의사결정
        CeoPattern {
            content: "촬영 현장 의사결정 위임 체계: PD/CD에게 현장 재량권 부여하되, 예산 10% 이상 변동 또는 안전 이슈 발생 시 즉시 보고. 사후 보고보다 사전 상의를 중시.".into(),
            knowledge_type: "workflow".into(),
            confidence: 0.89,
            relevance_score: 0.85,
            scope_layer: Some("operations".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"현장 의사결정 위임 체계"}"#.into()),
        },
        // 15. PT 차별화
        CeoPattern {
            content: "PT 차별화 전략: 경쟁사 분석 후 '남들이 안 하는 것'에 집중. 형식적 차별화(인터랙티브 PT, 영상 PT 등)도 적극 활용. 첫 5분에 승부를 건다.".into(),
            knowledge_type: "pitch_execution".into(),
            confidence: 0.88,
            relevance_score: 0.85,
            scope_layer: Some("pitch".into()),
            dialectic_tag: Some("opportunity".into()),
            source_context: Some(r#"{"reason":"PT 차별화 전략"}"#.into()),
        },
        // 16. 팀 커뮤니케이션
        CeoPattern {
            content: "팀 커뮤니케이션 원칙: 중요한 결정은 카톡이 아닌 대면/화상으로. 문서화 필수(결정사항은 회의록으로 공유). '말로 한 약속'은 약속이 아니다.".into(),
            knowledge_type: "communication_style".into(),
            confidence: 0.92,
            relevance_score: 0.9,
            scope_layer: None,
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"팀 내부 커뮤니케이션 원칙"}"#.into()),
        },
        // 17. 피드백 방식
        CeoPattern {
            content: "피드백 방식: '샌드위치 피드백'보다 직접적 피드백 선호. 좋은 점/나쁜 점 명확히 구분. 감정이 아닌 결과물 기준으로 피드백. 피드백 후 개선 방향 반드시 제시.".into(),
            knowledge_type: "feedback_pattern".into(),
            confidence: 0.88,
            relevance_score: 0.85,
            scope_layer: None,
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"직접적 피드백 방식 선호 패턴"}"#.into()),
        },
        // 18. 이해관계자 조율
        CeoPattern {
            content: "이해관계자 조율 원칙: 클라이언트 내부 의사결정 구조를 먼저 파악. 실무자와 의사결정권자에게 다른 언어로 설명. 중간 보고를 자주 하여 '깜짝 쇼' 방지.".into(),
            knowledge_type: "stakeholder_alignment".into(),
            confidence: 0.90,
            relevance_score: 0.85,
            scope_layer: Some("pitch".into()),
            dialectic_tag: Some("client_concern".into()),
            source_context: Some(r#"{"reason":"이해관계자 소통 전략"}"#.into()),
        },
        // 19. 팀원 역량 판단
        CeoPattern {
            content: "팀원 역량 판단 기준: 1) 자기 일의 범위를 스스로 정의할 수 있는가, 2) 문제 발생 시 해결책을 함께 가져오는가, 3) 마감을 지키는가. 이 3가지로 '프로'와 '주니어'를 구분.".into(),
            knowledge_type: "judgment".into(),
            confidence: 0.91,
            relevance_score: 0.9,
            scope_layer: None,
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"팀원 역량 판단 3가지 기준"}"#.into()),
        },
        // 20. 협업 패턴 (총괄)
        CeoPattern {
            content: "협업 패턴: CD와는 크리에이티브 방향, EP와는 예산/계약, PD와는 일정/현장 중심으로 소통. 각 역할의 전문성을 존중하되 최종 결정권은 CEO에게 귀속.".into(),
            knowledge_type: "collaboration_pattern".into(),
            confidence: 0.93,
            relevance_score: 0.9,
            scope_layer: None,
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"역할별 소통 패턴 총괄"}"#.into()),
        },
        // 21. 업계 교훈
        CeoPattern {
            content: "업계 교훈: '좋은 작품'과 '좋은 비즈니스'는 다르다. 수상작이 반드시 수익성이 좋은 것은 아님. 장기적으로는 수익이 있어야 좋은 작품도 만들 수 있다.".into(),
            knowledge_type: "lesson_learned".into(),
            confidence: 0.94,
            relevance_score: 0.9,
            scope_layer: None,
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"수익성과 작품 퀄리티의 균형"}"#.into()),
        },
        // 22. 에이전시 운영 노하우
        CeoPattern {
            content: "크리에이티브 에이전시 운영 노하우: 인력이 곧 자산. 핵심 인력 유지가 최우선. 프로젝트 실패보다 핵심 인력 이탈이 더 큰 리스크. 무리한 프로젝트 수주보다 팀 안정성 우선.".into(),
            knowledge_type: "domain_expertise".into(),
            confidence: 0.93,
            relevance_score: 0.9,
            scope_layer: None,
            dialectic_tag: Some("risk".into()),
            source_context: Some(r#"{"reason":"에이전시 핵심 인력 관리 원칙"}"#.into()),
        },
        // 23. CEO-CD 소통
        CeoPattern {
            content: "CEO(김경신)와 CD(크리에이티브 디렉터) 간 소통: 크리에이티브 방향의 '큰 그림'은 CEO가 설정하고 세부 실행은 CD에게 위임. 의견 충돌 시 '클라이언트 가치' 기준으로 판단.".into(),
            knowledge_type: "collaboration_pattern".into(),
            confidence: 0.88,
            relevance_score: 0.85,
            scope_layer: Some("creative".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"CEO-CD 크리에이티브 소통 패턴"}"#.into()),
        },
        // 24. CEO-EP 소통
        CeoPattern {
            content: "CEO와 EP(총괄 프로듀서) 간 소통: 계약/정산/리소스는 EP 주도. CEO는 최종 승인 역할. 예산 10% 이상 변동 시 CEO 사전 승인 필수.".into(),
            knowledge_type: "collaboration_pattern".into(),
            confidence: 0.89,
            relevance_score: 0.85,
            scope_layer: Some("operations".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"CEO-EP 재무/계약 소통 패턴"}"#.into()),
        },
        // 25. CEO-PD 소통
        CeoPattern {
            content: "CEO와 PD(프로듀서/라인PD) 간 소통: 현장 조율과 일정 관리는 PD 자율. 주간 진행 상황 요약 보고 필수. 일정 지연 2일 이상 시 대응 방안과 함께 보고.".into(),
            knowledge_type: "collaboration_pattern".into(),
            confidence: 0.87,
            relevance_score: 0.85,
            scope_layer: Some("operations".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"CEO-PD 일정/현장 소통 패턴"}"#.into()),
        },
        // 26. CEO-AD 소통
        CeoPattern {
            content: "CEO와 AD(아트 디렉터/시니어AD) 간 소통: 비주얼 방향은 CD를 경유하되, 핵심 프로젝트는 CEO가 직접 디자인 QC. PPT 덱 퀄리티에 특히 높은 기준 적용.".into(),
            knowledge_type: "collaboration_pattern".into(),
            confidence: 0.85,
            relevance_score: 0.8,
            scope_layer: Some("creative".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"CEO-AD 디자인 QC 패턴"}"#.into()),
        },
        // 27. CEO-클라이언트 소통
        CeoPattern {
            content: "CEO와 클라이언트 간 소통: 초기 관계 구축은 CEO가 직접. 안정화 후 담당 팀에 이관. 크리티컬 이슈(불만, 계약 변경) 시 CEO가 다시 전면에 등장.".into(),
            knowledge_type: "collaboration_pattern".into(),
            confidence: 0.91,
            relevance_score: 0.9,
            scope_layer: Some("pitch".into()),
            dialectic_tag: Some("client_concern".into()),
            source_context: Some(r#"{"reason":"CEO-클라이언트 관계 관리 패턴"}"#.into()),
        },
        // 28. CEO-벤더 소통
        CeoPattern {
            content: "CEO와 외부 파트너(벤더) 간 소통: 핵심 벤더(촬영감독, 편집실)와는 CEO가 직접 관계 유지. 단가 협상은 EP에게 위임하되 최종 합의는 CEO 확인.".into(),
            knowledge_type: "collaboration_pattern".into(),
            confidence: 0.86,
            relevance_score: 0.8,
            scope_layer: Some("operations".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"CEO-벤더 관계 및 단가 협상 패턴"}"#.into()),
        },
        // 29. 긴급도별 채널 구분
        CeoPattern {
            content: "팀 전체 커뮤니케이션 룰: 긴급도에 따라 채널 구분 — 긴급: 전화, 중요: 대면/화상, 일상: 메신저. 회의는 30분 이내, 결론 없는 회의는 금지.".into(),
            knowledge_type: "communication_style".into(),
            confidence: 0.90,
            relevance_score: 0.85,
            scope_layer: None,
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"긴급도별 커뮤니케이션 채널 규칙"}"#.into()),
        },
        // 30. 보고 체계
        CeoPattern {
            content: "프로젝트별 보고 체계: 주 1회 진행 상황 공유(전체), 이슈 발생 시 당일 내 보고(관련자), 월 1회 포트폴리오 + 재무 현황 리뷰(CEO+EP).".into(),
            knowledge_type: "workflow".into(),
            confidence: 0.88,
            relevance_score: 0.85,
            scope_layer: Some("operations".into()),
            dialectic_tag: None,
            source_context: Some(r#"{"reason":"프로젝트 보고 주기 및 체계"}"#.into()),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pattern_count() {
        let patterns = get_ceo_patterns();
        assert_eq!(patterns.len(), 30);
    }

    #[test]
    fn test_all_patterns_have_content() {
        let patterns = get_ceo_patterns();
        for (i, p) in patterns.iter().enumerate() {
            assert!(!p.content.is_empty(), "Pattern {} has empty content", i + 1);
            assert!(!p.knowledge_type.is_empty(), "Pattern {} has empty knowledge_type", i + 1);
            assert!(p.confidence > 0.0 && p.confidence <= 1.0, "Pattern {} has invalid confidence", i + 1);
        }
    }

    #[test]
    fn test_confidence_range() {
        let patterns = get_ceo_patterns();
        let min = patterns.iter().map(|p| p.confidence).fold(f64::INFINITY, f64::min);
        let max = patterns.iter().map(|p| p.confidence).fold(f64::NEG_INFINITY, f64::max);
        assert!(min >= 0.85, "Min confidence = {}", min);
        assert!(max <= 0.95, "Max confidence = {}", max);
    }
}
