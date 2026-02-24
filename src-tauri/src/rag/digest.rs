/// Chat Digest — Claude Haiku conversation analysis
///
/// Analyzes batches of chat messages to extract:
/// - Decisions (의사결정)
/// - Action Items (액션 아이템)
/// - Risks/Blockers (리스크/차단 요소)
/// - Summary (요약)
///
/// Local-first: messages are sent to Claude API for analysis only,
/// extracted knowledge is stored locally in SQLite.
/// Anthropic does NOT train on API data.

use crate::rag::db::RagDb;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Claude Haiku model ID for digest analysis
const CLAUDE_HAIKU_MODEL: &str = "claude-haiku-4-5-20251001";

/// Anthropic API endpoint
const ANTHROPIC_API_URL: &str = "https://api.anthropic.com/v1/messages";

/// API version header
const ANTHROPIC_API_VERSION: &str = "2023-06-01";

/// Max tokens for digest response
const DIGEST_MAX_TOKENS: u32 = 2048;

/// System prompt for chat digest analysis (exact Korean port from llm-digest.ts)
const DIGEST_SYSTEM_PROMPT: &str = r#"You are "Re-Be Brain", an AI assistant analyzing Korean project management chat conversations.
Your job is to analyze a batch of messages and extract structured intelligence.

## Analysis Categories

1. **DECISIONS** — Agreements, approvals, choices made by the team
   - Look for: consensus phrases ("그렇게 하죠", "알겠습니다", "확정", "결정", "합의")
   - Include: WHO decided, WHAT was decided, implied confidence level

2. **ACTION ITEMS** — Tasks or commitments mentioned but not yet formalized
   - Look for: explicit assignments ("~가 ~하기로", "~에게 ~요청")
   - Also: implicit assignments ("이거 누가 해야 하는데...", "~해야 할 것 같은데")
   - Include: assignee if identifiable, deadline if mentioned

3. **RISKS / BLOCKERS** — Problems, delays, dependencies, concerns
   - Look for: problem signals ("문제가", "걱정", "지연", "어려움", "빡빡해")
   - Include: severity (low/medium/high), what's affected

4. **SUMMARY** — 2-3 sentence Korean summary of the conversation batch

## Korean Language Notes
- Recognize indirect agreement patterns ("그렇게 하죠" = decision)
- Extract assignees from honorific context ("김 대표님이 확인해주신다고" = 김 대표님 has action)
- Detect urgency signals ("급합니다", "ASAP", "긴급" = high priority)
- "ㅇㅇ", "ㄴㄴ" are casual yes/no

## Response Format (JSON only, no markdown fences)
{
  "decisions": [
    { "text": "description in Korean", "confidence": 0.0-1.0, "relatedUserIds": ["uuid"], "priority": "low|medium|high" }
  ],
  "actionItems": [
    { "text": "description in Korean", "confidence": 0.0-1.0, "relatedUserIds": ["uuid"], "priority": "low|medium|high" }
  ],
  "risks": [
    { "text": "description in Korean", "confidence": 0.0-1.0, "priority": "low|medium|high" }
  ],
  "summary": "2-3 sentence summary in Korean"
}

If there are no items for a category, return an empty array.
Always respond with valid JSON only."#;

// ── Types ──────────────────────────────────────────────

/// Chat message for digest input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub user_id: String,
    pub user_name: String,
    pub content: String,
    pub created_at: String,
}

/// Digest analysis result from Claude
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigestResult {
    pub decisions: Vec<DigestItem>,
    #[serde(rename = "actionItems")]
    pub action_items: Vec<DigestItem>,
    pub risks: Vec<RiskItem>,
    pub summary: String,
}

/// Decision or action item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DigestItem {
    pub text: String,
    pub confidence: f64,
    #[serde(rename = "relatedUserIds", default)]
    pub related_user_ids: Vec<String>,
    #[serde(default = "default_priority")]
    pub priority: String,
}

/// Risk / blocker item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskItem {
    pub text: String,
    pub confidence: f64,
    #[serde(default = "default_priority")]
    pub priority: String,
}

fn default_priority() -> String {
    "medium".to_string()
}

/// Stored digest record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredDigest {
    pub id: String,
    pub room_id: String,
    pub project_id: Option<String>,
    pub digest_type: String,
    pub content: String, // JSON string
    pub message_count: i64,
    pub confidence: f64,
    pub created_at: String,
}

// ── Claude API call ────────────────────────────────────

/// Analyze a batch of chat messages using Claude Haiku.
///
/// Returns structured DigestResult with decisions, action items, risks, summary.
/// Requires ANTHROPIC_API_KEY environment variable.
pub async fn analyze_conversation(
    messages: &[ChatMessage],
    api_key: &str,
) -> Result<DigestResult, String> {
    if messages.is_empty() {
        return Err("No messages to analyze".to_string());
    }

    // Format messages for Claude
    let formatted = messages
        .iter()
        .map(|m| format!("[{}] {} ({}): {}", m.created_at, m.user_name, m.user_id, m.content))
        .collect::<Vec<_>>()
        .join("\n");

    let user_prompt = format!(
        "다음 채팅 메시지들을 분석해주세요 ({} messages):\n\n{}",
        messages.len(),
        formatted
    );

    // Build Anthropic API request
    let request_body = serde_json::json!({
        "model": CLAUDE_HAIKU_MODEL,
        "max_tokens": DIGEST_MAX_TOKENS,
        "system": DIGEST_SYSTEM_PROMPT,
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
        .map_err(|e| format!("Claude API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Claude API error {}: {}", status, body));
    }

    let api_response: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Claude response: {}", e))?;

    // Extract text content from Claude's response
    let text = api_response["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|block| block["text"].as_str())
        .ok_or_else(|| "No text content in Claude response".to_string())?;

    // Parse JSON from Claude's response (may contain markdown fences)
    let clean_json = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let digest: DigestResult = serde_json::from_str(clean_json)
        .map_err(|e| format!("Failed to parse digest JSON: {} — raw: {}", e, clean_json))?;

    Ok(digest)
}

// ── Storage ────────────────────────────────────────────

/// Store digest results in the local database.
/// Creates 4 records: decisions, actionItems, risks, summary.
pub fn store_digest(
    db: &RagDb,
    room_id: &str,
    project_id: Option<&str>,
    digest: &DigestResult,
    message_count: i64,
) -> Result<Vec<String>, String> {
    let conn = db.conn();
    let mut ids = Vec::new();

    let items = vec![
        ("decisions", serde_json::to_string(&digest.decisions).unwrap_or_else(|_| "[]".into())),
        ("action_items", serde_json::to_string(&digest.action_items).unwrap_or_else(|_| "[]".into())),
        ("risks", serde_json::to_string(&digest.risks).unwrap_or_else(|_| "[]".into())),
        ("summary", serde_json::json!({"text": digest.summary}).to_string()),
    ];

    for (digest_type, content_json) in items {
        let id = Uuid::new_v4().to_string();
        let confidence = match digest_type {
            "decisions" => avg_confidence_items(&digest.decisions),
            "action_items" => avg_confidence_items(&digest.action_items),
            "risks" => avg_confidence_risks(&digest.risks),
            _ => 0.8,
        };

        conn.execute(
            "INSERT INTO chat_digests (id, room_id, project_id, digest_type, content, message_count, confidence)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                id,
                room_id,
                project_id,
                digest_type,
                content_json,
                message_count,
                confidence,
            ],
        )
        .map_err(|e| format!("Store digest failed: {}", e))?;

        ids.push(id);
    }

    log::info!(
        "Stored digest for room {} ({} messages, {} decisions, {} actions, {} risks)",
        room_id,
        message_count,
        digest.decisions.len(),
        digest.action_items.len(),
        digest.risks.len(),
    );

    Ok(ids)
}

/// Get recent digests for a room.
pub fn get_recent_digests(
    db: &RagDb,
    room_id: &str,
    limit: usize,
) -> Result<Vec<StoredDigest>, String> {
    let conn = db.conn();
    let mut stmt = conn
        .prepare(
            "SELECT id, room_id, project_id, digest_type, content, message_count, confidence, created_at
             FROM chat_digests
             WHERE room_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )
        .map_err(|e| format!("Query digests failed: {}", e))?;

    let results: Vec<StoredDigest> = stmt
        .query_map(rusqlite::params![room_id, limit as i64], |row| {
            Ok(StoredDigest {
                id: row.get(0)?,
                room_id: row.get(1)?,
                project_id: row.get(2)?,
                digest_type: row.get(3)?,
                content: row.get(4)?,
                message_count: row.get(5)?,
                confidence: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Query digests failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

// ── Helpers ────────────────────────────────────────────

fn avg_confidence_items(items: &[DigestItem]) -> f64 {
    if items.is_empty() {
        return 0.0;
    }
    items.iter().map(|i| i.confidence).sum::<f64>() / items.len() as f64
}

fn avg_confidence_risks(items: &[RiskItem]) -> f64 {
    if items.is_empty() {
        return 0.0;
    }
    items.iter().map(|i| i.confidence).sum::<f64>() / items.len() as f64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_digest_result() {
        let json = r#"{
            "decisions": [
                { "text": "예산 3000만원으로 확정", "confidence": 0.9, "relatedUserIds": ["abc"], "priority": "high" }
            ],
            "actionItems": [
                { "text": "김PD가 촬영 장소 섭외", "confidence": 0.85, "relatedUserIds": ["def"], "priority": "medium" }
            ],
            "risks": [
                { "text": "촬영 일정이 빡빡함", "confidence": 0.7, "priority": "medium" }
            ],
            "summary": "예산이 확정되었고 촬영 준비가 진행 중입니다."
        }"#;

        let result: DigestResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.decisions.len(), 1);
        assert_eq!(result.action_items.len(), 1);
        assert_eq!(result.risks.len(), 1);
        assert!(!result.summary.is_empty());
    }

    #[test]
    fn test_empty_categories() {
        let json = r#"{
            "decisions": [],
            "actionItems": [],
            "risks": [],
            "summary": "일반 대화가 오갔습니다."
        }"#;

        let result: DigestResult = serde_json::from_str(json).unwrap();
        assert!(result.decisions.is_empty());
        assert!(result.action_items.is_empty());
        assert!(result.risks.is_empty());
    }
}
