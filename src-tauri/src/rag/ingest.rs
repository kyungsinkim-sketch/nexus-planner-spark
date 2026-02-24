/// Knowledge Ingest Pipeline — Extract knowledge from various sources
///
/// Extracts structured knowledge items from:
/// - Chat digests (via Claude Haiku deep analysis)
/// - Brain actions (task completions, decisions)
/// - Peer reviews (project completion reviews)
///
/// All extracted knowledge is embedded locally (ONNX/pseudo) and stored in SQLite.

use crate::rag::db::RagDb;
use crate::rag::digest::DigestResult;
use crate::rag::embedding::EmbeddingEngine;
use crate::rag::knowledge::{self, KnowledgeItem};
use serde::{Deserialize, Serialize};

/// Claude Haiku model for deep knowledge extraction
const CLAUDE_HAIKU_MODEL: &str = "claude-haiku-4-5-20251001";
const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION: &str = "2023-06-01";

/// System prompt for deep knowledge extraction from digest
const EXTRACT_SYSTEM_PROMPT: &str = r#"You are a knowledge extraction engine for a Korean creative agency project management system.

Given a chat digest (decisions, action items, risks, summary), extract reusable knowledge patterns.

## Extraction Rules
1. Focus on REUSABLE patterns, not one-time facts
2. Each item should be a general principle or recurring pattern
3. Include context about WHY this knowledge matters
4. Tag with appropriate knowledge_type and role_tag
5. Maximum 5 items per digest (quality over quantity)

## Available knowledge_types:
decision_pattern, preference, judgment, collaboration_pattern, recurring_risk,
workflow, domain_expertise, feedback_pattern, communication_style, lesson_learned,
creative_direction, budget_judgment, stakeholder_alignment, schedule_change, context,
deal_decision, budget_decision, payment_tracking, vendor_selection, campaign_strategy,
naming_decision, award_strategy, pitch_execution, talent_casting

## Available role_tags:
CEO, CD, PD, EDITOR, DIRECTOR, WRITER, DESIGNER, MANAGER,
BUDGET_MANAGER, PROJECT_MANAGER, EXECUTIVE_PRODUCER, LINE_PD,
SENIOR_ART_DIRECTOR, ART_DIRECTOR

## Available dialectic_tags:
risk, opportunity, constraint, quality, client_concern

## Available scope_layers:
operations, creative, pitch

## Response Format (JSON only, no markdown fences)
{
  "items": [
    {
      "content": "한국어로 작성된 재사용 가능한 지식 패턴",
      "knowledge_type": "decision_pattern",
      "role_tag": "CEO",
      "dialectic_tag": null,
      "scope_layer": "operations",
      "confidence": 0.7
    }
  ]
}

If no reusable knowledge can be extracted, return: {"items": []}
Always respond with valid JSON only."#;

// ── Types ──────────────────────────────────────────────

/// Extracted knowledge item from Claude
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedItem {
    pub content: String,
    pub knowledge_type: String,
    pub role_tag: Option<String>,
    pub dialectic_tag: Option<String>,
    pub scope_layer: Option<String>,
    pub confidence: f64,
}

/// Extraction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionResult {
    pub items: Vec<ExtractedItem>,
}

/// Result of ingesting knowledge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestResult {
    pub created_ids: Vec<String>,
    pub skipped_count: usize,
    pub is_pseudo_embedding: bool,
}

// ── From Digest (Claude deep extraction) ───────────────

/// Extract knowledge from a digest using Claude Haiku.
/// This is the "deep" extraction that finds reusable patterns.
pub async fn from_digest(
    db: &RagDb,
    embedding: &EmbeddingEngine,
    digest: &DigestResult,
    user_id: Option<&str>,
    project_id: Option<&str>,
    source_id: &str,
    api_key: &str,
) -> Result<IngestResult, String> {
    // Check if already extracted (duplicate prevention)
    if knowledge::is_extracted(db, "chat_digest", source_id)? {
        log::info!("Digest {} already extracted, skipping", source_id);
        return Ok(IngestResult {
            created_ids: vec![],
            skipped_count: 0,
            is_pseudo_embedding: false,
        });
    }

    // Format digest for Claude
    let digest_text = format_digest_for_extraction(digest);

    // Call Claude Haiku for deep extraction
    let extracted = call_extraction_api(&digest_text, api_key).await?;

    // Ingest each extracted item
    let mut created_ids = Vec::new();
    let mut is_pseudo = false;

    for item in &extracted.items {
        let embed_result = embedding.embed(&item.content)?;
        is_pseudo = embed_result.is_pseudo;

        let knowledge_item = KnowledgeItem {
            id: String::new(),
            content: item.content.clone(),
            summary: None,
            knowledge_type: item.knowledge_type.clone(),
            source_type: "chat_digest".to_string(),
            scope: if project_id.is_some() { "team".to_string() } else { "personal".to_string() },
            scope_layer: item.scope_layer.clone(),
            role_tag: item.role_tag.clone(),
            dialectic_tag: item.dialectic_tag.clone(),
            confidence: item.confidence,
            relevance_score: 0.5,
            usage_count: 0,
            decision_maker: None,
            outcome: None,
            financial_impact_krw: None,
            source_id: Some(source_id.to_string()),
            source_context: Some(serde_json::json!({
                "extraction_source": "digest_deep_analysis",
                "digest_summary": digest.summary,
            }).to_string()),
            user_id: user_id.map(|s| s.to_string()),
            project_id: project_id.map(|s| s.to_string()),
            did_author: None,
            is_active: true,
            expires_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        let id = knowledge::create_knowledge_item(db, &knowledge_item, &embed_result.vector)?;
        created_ids.push(id);
    }

    // Mark as extracted
    knowledge::mark_extracted(db, "chat_digest", source_id, created_ids.len() as i64)?;

    log::info!(
        "Extracted {} knowledge items from digest {}",
        created_ids.len(),
        source_id
    );

    Ok(IngestResult {
        created_ids,
        skipped_count: 0,
        is_pseudo_embedding: is_pseudo,
    })
}

// ── From Action (brain actions) ────────────────────────

/// Extract knowledge from a brain action (task creation, completion, etc.)
/// This is a simpler, rule-based extraction (no Claude API needed).
pub fn from_action(
    db: &RagDb,
    embedding: &EmbeddingEngine,
    action_type: &str,
    action_content: &str,
    user_id: Option<&str>,
    project_id: Option<&str>,
    source_id: &str,
) -> Result<IngestResult, String> {
    // Check duplicate
    if knowledge::is_extracted(db, "brain_action", source_id)? {
        return Ok(IngestResult {
            created_ids: vec![],
            skipped_count: 0,
            is_pseudo_embedding: false,
        });
    }

    // Map action types to knowledge types
    let knowledge_type = match action_type {
        "create_task" | "complete_task" => "workflow",
        "schedule_event" | "reschedule" => "schedule_change",
        "budget_update" | "expense_record" => "budget_decision",
        "decision" | "approval" => "decision_pattern",
        "risk_flag" => "recurring_risk",
        _ => "context",
    };

    let embed_result = embedding.embed(action_content)?;

    let item = KnowledgeItem {
        id: String::new(),
        content: action_content.to_string(),
        summary: None,
        knowledge_type: knowledge_type.to_string(),
        source_type: "brain_action".to_string(),
        scope: if project_id.is_some() { "team".to_string() } else { "personal".to_string() },
        scope_layer: None,
        role_tag: None,
        dialectic_tag: None,
        confidence: 0.6, // Actions are moderate confidence
        relevance_score: 0.5,
        usage_count: 0,
        decision_maker: None,
        outcome: None,
        financial_impact_krw: None,
        source_id: Some(source_id.to_string()),
        source_context: Some(serde_json::json!({
            "action_type": action_type,
        }).to_string()),
        user_id: user_id.map(|s| s.to_string()),
        project_id: project_id.map(|s| s.to_string()),
        did_author: None,
        is_active: true,
        expires_at: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let id = knowledge::create_knowledge_item(db, &item, &embed_result.vector)?;
    knowledge::mark_extracted(db, "brain_action", source_id, 1)?;

    Ok(IngestResult {
        created_ids: vec![id],
        skipped_count: 0,
        is_pseudo_embedding: embed_result.is_pseudo,
    })
}

// ── From Review (peer reviews) ─────────────────────────

/// Extract knowledge from a peer review (project completion review).
pub fn from_review(
    db: &RagDb,
    embedding: &EmbeddingEngine,
    reviewer_name: &str,
    reviewee_name: &str,
    rating: f64,
    comment: &str,
    user_id: Option<&str>,
    project_id: Option<&str>,
    source_id: &str,
) -> Result<IngestResult, String> {
    // Check duplicate
    if knowledge::is_extracted(db, "peer_review", source_id)? {
        return Ok(IngestResult {
            created_ids: vec![],
            skipped_count: 0,
            is_pseudo_embedding: false,
        });
    }

    // Only extract from meaningful reviews (rating + comment)
    if comment.trim().is_empty() || comment.len() < 10 {
        return Ok(IngestResult {
            created_ids: vec![],
            skipped_count: 1,
            is_pseudo_embedding: false,
        });
    }

    let content = format!(
        "{}님의 {}님 평가 ({}점/5점): {}",
        reviewer_name, reviewee_name, rating, comment
    );

    let embed_result = embedding.embed(&content)?;

    let item = KnowledgeItem {
        id: String::new(),
        content,
        summary: None,
        knowledge_type: "feedback_pattern".to_string(),
        source_type: "peer_review".to_string(),
        scope: "team".to_string(),
        scope_layer: None,
        role_tag: None,
        dialectic_tag: if rating < 3.0 { Some("constraint".to_string()) } else { None },
        confidence: (rating / 5.0).min(1.0),
        relevance_score: 0.5,
        usage_count: 0,
        decision_maker: None,
        outcome: None,
        financial_impact_krw: None,
        source_id: Some(source_id.to_string()),
        source_context: Some(serde_json::json!({
            "reviewer": reviewer_name,
            "reviewee": reviewee_name,
            "rating": rating,
        }).to_string()),
        user_id: user_id.map(|s| s.to_string()),
        project_id: project_id.map(|s| s.to_string()),
        did_author: None,
        is_active: true,
        expires_at: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let id = knowledge::create_knowledge_item(db, &item, &embed_result.vector)?;
    knowledge::mark_extracted(db, "peer_review", source_id, 1)?;

    Ok(IngestResult {
        created_ids: vec![id],
        skipped_count: 0,
        is_pseudo_embedding: embed_result.is_pseudo,
    })
}

// ── From Digest Items (lightweight, no Claude) ─────────

/// Lightweight ingest: store digest decisions/risks directly as knowledge.
/// No Claude API call — uses digest items directly.
pub fn from_digest_items(
    db: &RagDb,
    embedding: &EmbeddingEngine,
    digest: &DigestResult,
    user_id: Option<&str>,
    project_id: Option<&str>,
) -> Result<IngestResult, String> {
    let mut created_ids = Vec::new();
    let mut is_pseudo = false;

    // Decisions → decision_pattern
    for decision in &digest.decisions {
        if decision.confidence < 0.6 {
            continue; // Skip low-confidence
        }
        let embed_result = embedding.embed(&decision.text)?;
        is_pseudo = embed_result.is_pseudo;

        let item = KnowledgeItem {
            id: String::new(),
            content: decision.text.clone(),
            summary: None,
            knowledge_type: "decision_pattern".to_string(),
            source_type: "chat_digest".to_string(),
            scope: if project_id.is_some() { "team".to_string() } else { "personal".to_string() },
            scope_layer: None,
            role_tag: None,
            dialectic_tag: None,
            confidence: decision.confidence,
            relevance_score: 0.5,
            usage_count: 0,
            decision_maker: None,
            outcome: Some("confirmed".to_string()),
            financial_impact_krw: None,
            source_id: None,
            source_context: None,
            user_id: user_id.map(|s| s.to_string()),
            project_id: project_id.map(|s| s.to_string()),
            did_author: None,
            is_active: true,
            expires_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        let id = knowledge::create_knowledge_item(db, &item, &embed_result.vector)?;
        created_ids.push(id);
    }

    // Risks → recurring_risk
    for risk in &digest.risks {
        if risk.confidence < 0.5 {
            continue;
        }
        let embed_result = embedding.embed(&risk.text)?;
        is_pseudo = embed_result.is_pseudo;

        let item = KnowledgeItem {
            id: String::new(),
            content: risk.text.clone(),
            summary: None,
            knowledge_type: "recurring_risk".to_string(),
            source_type: "chat_digest".to_string(),
            scope: if project_id.is_some() { "team".to_string() } else { "personal".to_string() },
            scope_layer: None,
            role_tag: None,
            dialectic_tag: Some("risk".to_string()),
            confidence: risk.confidence,
            relevance_score: 0.5,
            usage_count: 0,
            decision_maker: None,
            outcome: None,
            financial_impact_krw: None,
            source_id: None,
            source_context: None,
            user_id: user_id.map(|s| s.to_string()),
            project_id: project_id.map(|s| s.to_string()),
            did_author: None,
            is_active: true,
            expires_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        let id = knowledge::create_knowledge_item(db, &item, &embed_result.vector)?;
        created_ids.push(id);
    }

    Ok(IngestResult {
        created_ids,
        skipped_count: 0,
        is_pseudo_embedding: is_pseudo,
    })
}

// ── Claude API helper ──────────────────────────────────

async fn call_extraction_api(
    digest_text: &str,
    api_key: &str,
) -> Result<ExtractionResult, String> {
    let user_prompt = format!(
        "다음 채팅 다이제스트에서 재사용 가능한 지식 패턴을 추출해주세요:\n\n{}",
        digest_text
    );

    let request_body = serde_json::json!({
        "model": CLAUDE_HAIKU_MODEL,
        "max_tokens": 2048,
        "system": EXTRACT_SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    });

    let client = reqwest::Client::new();
    let response = client
        .post(ANTHROPIC_API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_API_VERSION)
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Claude extraction API failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Claude extraction API error {}: {}", status, body));
    }

    let api_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse extraction response: {}", e))?;

    let text = api_response["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|block| block["text"].as_str())
        .ok_or_else(|| "No text in extraction response".to_string())?;

    let clean_json = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let result: ExtractionResult = serde_json::from_str(clean_json)
        .map_err(|e| format!("Failed to parse extraction JSON: {} — raw: {}", e, clean_json))?;

    Ok(result)
}

fn format_digest_for_extraction(digest: &DigestResult) -> String {
    let mut parts = Vec::new();

    if !digest.decisions.is_empty() {
        parts.push("## Decisions:".to_string());
        for d in &digest.decisions {
            parts.push(format!("- [{}] {}", d.priority, d.text));
        }
    }

    if !digest.action_items.is_empty() {
        parts.push("\n## Action Items:".to_string());
        for a in &digest.action_items {
            parts.push(format!("- [{}] {}", a.priority, a.text));
        }
    }

    if !digest.risks.is_empty() {
        parts.push("\n## Risks:".to_string());
        for r in &digest.risks {
            parts.push(format!("- [{}] {}", r.priority, r.text));
        }
    }

    parts.push(format!("\n## Summary: {}", digest.summary));

    parts.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rag::digest::{DigestItem, RiskItem};

    #[test]
    fn test_format_digest() {
        let digest = DigestResult {
            decisions: vec![DigestItem {
                text: "예산 3000만원 확정".to_string(),
                confidence: 0.9,
                related_user_ids: vec![],
                priority: "high".to_string(),
            }],
            action_items: vec![],
            risks: vec![RiskItem {
                text: "일정 촉박".to_string(),
                confidence: 0.7,
                priority: "medium".to_string(),
            }],
            summary: "예산 확정 회의".to_string(),
        };

        let formatted = format_digest_for_extraction(&digest);
        assert!(formatted.contains("예산 3000만원 확정"));
        assert!(formatted.contains("일정 촉박"));
        assert!(formatted.contains("예산 확정 회의"));
    }

    #[test]
    fn test_parse_extraction_result() {
        let json = r#"{
            "items": [
                {
                    "content": "예산 협상 시 목표 내수율을 역산하여 견적 하한선 설정",
                    "knowledge_type": "budget_decision",
                    "role_tag": "CEO",
                    "dialectic_tag": null,
                    "scope_layer": "operations",
                    "confidence": 0.85
                }
            ]
        }"#;

        let result: ExtractionResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].knowledge_type, "budget_decision");
    }
}
