/// Hybrid Search Engine for Local RAG (sqlite-vec powered)
///
/// Uses sqlite-vec's vec0 virtual table for native cosine similarity,
/// replacing the in-memory full-scan approach.
///
/// Scoring formula (identical to Supabase):
///   hybrid_score = similarity * 0.70 + relevance_score * 0.20 + min(usage/20, 1.0) * 0.10

use crate::rag::db::RagDb;
use crate::rag::embedding::{cosine_similarity, blob_to_vector, vector_to_blob, EMBEDDING_DIM};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub content: String,
    pub summary: Option<String>,
    pub knowledge_type: String,
    pub source_type: String,
    pub scope: String,
    pub role_tag: Option<String>,
    pub dialectic_tag: Option<String>,
    pub confidence: f64,
    pub relevance_score: f64,
    pub usage_count: i64,
    pub similarity: f64,
    pub hybrid_score: f64,
    pub project_id: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchParams {
    pub query_embedding: Vec<f32>,
    pub scope: String,
    pub user_id: Option<String>,
    pub project_id: Option<String>,
    pub role_tag: Option<String>,
    pub knowledge_type: Option<String>,
    pub threshold: f32,
    pub limit: usize,
    pub vector_weight: f32,
    pub relevance_weight: f32,
    pub usage_weight: f32,
}

impl Default for SearchParams {
    fn default() -> Self {
        Self {
            query_embedding: vec![],
            scope: "all".to_string(),
            user_id: None,
            project_id: None,
            role_tag: None,
            knowledge_type: None,
            threshold: 0.30,
            limit: 5,
            vector_weight: 0.70,
            relevance_weight: 0.20,
            usage_weight: 0.10,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialecticParams {
    pub query_embedding: Vec<f32>,
    pub user_id: Option<String>,
    pub project_id: Option<String>,
    pub role_tag: Option<String>,
    pub opposing_tags: Vec<String>,
    pub threshold: f32,
    pub limit: usize,
}

impl Default for DialecticParams {
    fn default() -> Self {
        Self {
            query_embedding: vec![],
            user_id: None,
            project_id: None,
            role_tag: None,
            opposing_tags: vec![
                "risk".to_string(),
                "constraint".to_string(),
                "client_concern".to_string(),
            ],
            threshold: 0.25,
            limit: 3,
        }
    }
}

/// Execute hybrid search using sqlite-vec for vector similarity.
/// Falls back to in-memory scan if vec_knowledge table has issues.
pub fn hybrid_search(db: &RagDb, params: &SearchParams) -> Result<Vec<SearchResult>, String> {
    // Try sqlite-vec first, fall back to legacy approach
    match hybrid_search_vec(db, params) {
        Ok(results) => Ok(results),
        Err(e) => {
            log::warn!("sqlite-vec search failed ({}), using legacy in-memory scan", e);
            hybrid_search_legacy(db, params)
        }
    }
}

/// sqlite-vec powered search: uses KNN to get top-N candidates, then score/filter
fn hybrid_search_vec(db: &RagDb, params: &SearchParams) -> Result<Vec<SearchResult>, String> {
    let conn = db.conn();

    // Fetch more candidates than limit (we'll filter by scope post-query)
    let candidate_limit = params.limit * 5;
    let query_blob = vector_to_blob(&params.query_embedding);

    // sqlite-vec KNN query
    let mut stmt = conn
        .prepare(
            "SELECT v.knowledge_id, v.distance,
                    ki.content, ki.summary, ki.knowledge_type, ki.source_type,
                    ki.scope, ki.role_tag, ki.dialectic_tag, ki.confidence,
                    ki.relevance_score, ki.usage_count, ki.project_id, ki.user_id
             FROM vec_knowledge v
             JOIN knowledge_items ki ON ki.id = v.knowledge_id
             WHERE v.embedding MATCH ?1 AND k = ?2
               AND ki.is_active = 1
               AND (ki.expires_at IS NULL OR ki.expires_at > datetime('now'))"
        )
        .map_err(|e| format!("Vec search prepare failed: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![query_blob, candidate_limit as i64], |row| {
            Ok(VecRow {
                knowledge_id: row.get(0)?,
                distance: row.get(1)?,
                content: row.get(2)?,
                summary: row.get(3)?,
                knowledge_type: row.get(4)?,
                source_type: row.get(5)?,
                scope: row.get(6)?,
                role_tag: row.get(7)?,
                dialectic_tag: row.get(8)?,
                confidence: row.get(9)?,
                relevance_score: row.get(10)?,
                usage_count: row.get(11)?,
                project_id: row.get(12)?,
                user_id: row.get(13)?,
            })
        })
        .map_err(|e| format!("Vec search query failed: {}", e))?;

    let mut results: Vec<SearchResult> = Vec::new();

    for row_result in rows {
        let row = row_result.map_err(|e| format!("Row read failed: {}", e))?;

        // Scope filtering
        if !matches_scope_vec(&row, &params.scope, &params.user_id, &params.project_id, &params.role_tag) {
            continue;
        }

        if let Some(ref kt) = params.knowledge_type {
            if row.knowledge_type != *kt {
                continue;
            }
        }

        // sqlite-vec returns distance (lower = more similar)
        // Convert to similarity: sim = 1.0 - distance (for cosine distance)
        let similarity = 1.0 - row.distance as f32;

        if similarity < params.threshold {
            continue;
        }

        let usage_factor = (row.usage_count as f32 / 20.0).min(1.0);
        let hybrid_score = similarity * params.vector_weight
            + row.relevance_score as f32 * params.relevance_weight
            + usage_factor * params.usage_weight;

        results.push(SearchResult {
            id: row.knowledge_id,
            content: row.content,
            summary: row.summary,
            knowledge_type: row.knowledge_type,
            source_type: row.source_type,
            scope: row.scope,
            role_tag: row.role_tag,
            dialectic_tag: row.dialectic_tag,
            confidence: row.confidence,
            relevance_score: row.relevance_score,
            usage_count: row.usage_count,
            similarity: similarity as f64,
            hybrid_score: hybrid_score as f64,
            project_id: row.project_id,
            user_id: row.user_id,
        });
    }

    results.sort_by(|a, b| b.hybrid_score.partial_cmp(&a.hybrid_score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(params.limit);

    // Increment usage counts
    for result in &results {
        let _ = conn.execute(
            "UPDATE knowledge_items SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?",
            [&result.id],
        );
    }

    Ok(results)
}

/// Legacy in-memory scan (fallback when sqlite-vec unavailable)
fn hybrid_search_legacy(db: &RagDb, params: &SearchParams) -> Result<Vec<SearchResult>, String> {
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT ki.id, ki.content, ki.summary, ki.knowledge_type, ki.source_type,
                    ki.scope, ki.role_tag, ki.dialectic_tag, ki.confidence,
                    ki.relevance_score, ki.usage_count, ki.project_id, ki.user_id,
                    e.vector
             FROM knowledge_items ki
             JOIN embeddings e ON e.knowledge_id = ki.id
             WHERE ki.is_active = 1
               AND (ki.expires_at IS NULL OR ki.expires_at > datetime('now'))"
        )
        .map_err(|e| format!("Query prepare failed: {}", e))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(LegacyRow {
                id: row.get(0)?,
                content: row.get(1)?,
                summary: row.get(2)?,
                knowledge_type: row.get(3)?,
                source_type: row.get(4)?,
                scope: row.get(5)?,
                role_tag: row.get(6)?,
                dialectic_tag: row.get(7)?,
                confidence: row.get(8)?,
                relevance_score: row.get(9)?,
                usage_count: row.get(10)?,
                project_id: row.get(11)?,
                user_id: row.get(12)?,
                vector_blob: row.get(13)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?;

    let mut results: Vec<SearchResult> = Vec::new();

    for row_result in rows {
        let row = row_result.map_err(|e| format!("Row read failed: {}", e))?;

        if !matches_scope_legacy(&row, &params.scope, &params.user_id, &params.project_id, &params.role_tag) {
            continue;
        }

        if let Some(ref kt) = params.knowledge_type {
            if row.knowledge_type != *kt {
                continue;
            }
        }

        let stored_vec = blob_to_vector(&row.vector_blob);
        if stored_vec.len() != EMBEDDING_DIM {
            continue;
        }
        let similarity = cosine_similarity(&params.query_embedding, &stored_vec);

        if similarity < params.threshold {
            continue;
        }

        let usage_factor = (row.usage_count as f32 / 20.0).min(1.0);
        let hybrid_score = similarity * params.vector_weight
            + row.relevance_score as f32 * params.relevance_weight
            + usage_factor * params.usage_weight;

        results.push(SearchResult {
            id: row.id,
            content: row.content,
            summary: row.summary,
            knowledge_type: row.knowledge_type,
            source_type: row.source_type,
            scope: row.scope,
            role_tag: row.role_tag,
            dialectic_tag: row.dialectic_tag,
            confidence: row.confidence,
            relevance_score: row.relevance_score,
            usage_count: row.usage_count,
            similarity: similarity as f64,
            hybrid_score: hybrid_score as f64,
            project_id: row.project_id,
            user_id: row.user_id,
        });
    }

    results.sort_by(|a, b| b.hybrid_score.partial_cmp(&a.hybrid_score).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(params.limit);

    for result in &results {
        let _ = conn.execute(
            "UPDATE knowledge_items SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?",
            [&result.id],
        );
    }

    Ok(results)
}

/// Execute dialectic search — returns opposing/counterargument knowledge
pub fn dialectic_search(db: &RagDb, params: &DialecticParams) -> Result<Vec<SearchResult>, String> {
    let conn = db.conn();

    let placeholders: Vec<String> = params.opposing_tags.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let in_clause = placeholders.join(", ");

    let sql = format!(
        "SELECT ki.id, ki.content, ki.summary, ki.knowledge_type, ki.source_type,
                ki.scope, ki.role_tag, ki.dialectic_tag, ki.confidence,
                ki.relevance_score, ki.usage_count, ki.project_id, ki.user_id,
                e.vector
         FROM knowledge_items ki
         JOIN embeddings e ON e.knowledge_id = ki.id
         WHERE ki.is_active = 1
           AND (ki.expires_at IS NULL OR ki.expires_at > datetime('now'))
           AND ki.dialectic_tag IN ({})",
        in_clause
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Dialectic query prepare failed: {}", e))?;

    let tag_refs: Vec<&dyn rusqlite::types::ToSql> = params
        .opposing_tags
        .iter()
        .map(|s| s as &dyn rusqlite::types::ToSql)
        .collect();

    let rows = stmt
        .query_map(rusqlite::params_from_iter(tag_refs.iter()), |row| {
            Ok(LegacyRow {
                id: row.get(0)?,
                content: row.get(1)?,
                summary: row.get(2)?,
                knowledge_type: row.get(3)?,
                source_type: row.get(4)?,
                scope: row.get(5)?,
                role_tag: row.get(6)?,
                dialectic_tag: row.get(7)?,
                confidence: row.get(8)?,
                relevance_score: row.get(9)?,
                usage_count: row.get(10)?,
                project_id: row.get(11)?,
                user_id: row.get(12)?,
                vector_blob: row.get(13)?,
            })
        })
        .map_err(|e| format!("Dialectic query failed: {}", e))?;

    let mut results: Vec<SearchResult> = Vec::new();

    for row_result in rows {
        let row = row_result.map_err(|e| format!("Row read failed: {}", e))?;

        let scope_ok = row.scope == "role"
            || row.scope == "global"
            || (params.user_id.as_deref() == Some(row.user_id.as_deref().unwrap_or("")))
            || (row.scope == "team" && row.project_id.is_none());

        let role_ok = params.role_tag.is_none()
            || row.role_tag.is_none()
            || row.role_tag.as_deref() == params.role_tag.as_deref()
            || row.role_tag.as_deref() == Some("CEO");

        if !scope_ok || !role_ok {
            continue;
        }

        let stored_vec = blob_to_vector(&row.vector_blob);
        if stored_vec.len() != EMBEDDING_DIM {
            continue;
        }

        let similarity = cosine_similarity(&params.query_embedding, &stored_vec);
        if similarity < params.threshold {
            continue;
        }

        results.push(SearchResult {
            id: row.id,
            content: row.content,
            summary: row.summary,
            knowledge_type: row.knowledge_type,
            source_type: row.source_type,
            scope: row.scope,
            role_tag: row.role_tag,
            dialectic_tag: row.dialectic_tag,
            confidence: row.confidence,
            relevance_score: row.relevance_score,
            usage_count: row.usage_count,
            similarity: similarity as f64,
            hybrid_score: similarity as f64,
            project_id: row.project_id,
            user_id: row.user_id,
        });
    }

    results.sort_by(|a, b| b.similarity.partial_cmp(&a.similarity).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(params.limit);

    Ok(results)
}

/// Build RAG context string for LLM injection.
pub fn build_rag_context(items: &[SearchResult], max_chars: usize) -> String {
    if items.is_empty() {
        return String::new();
    }

    let mut output = String::from(
        "## 참고 지식 (Knowledge Base)\n\
         아래는 이 조직에서 축적된 실제 판단 기록입니다. 반드시 이 내용을 바탕으로 구체적으로 답변하세요.\n\n"
    );
    let mut chars_used = output.len();

    for item in items {
        let confidence_pct = (item.confidence * 100.0) as i32;
        let header = format!("### {} (신뢰도: {}%)\n", item.knowledge_type, confidence_pct);
        let body = item.summary.as_deref().unwrap_or(&item.content);
        let entry = format!("{}{}\n\n", header, body);

        if chars_used + entry.len() > max_chars {
            let remaining = max_chars.saturating_sub(chars_used + header.len() + 5);
            if remaining > 50 {
                let truncated: String = body.chars().take(remaining).collect();
                output.push_str(&format!("{}{}…\n\n", header, truncated));
            }
            break;
        }

        output.push_str(&entry);
        chars_used += entry.len();
    }

    output
}

// ── Internal types ──────────────────────────────────────

struct VecRow {
    knowledge_id: String,
    distance: f64,
    content: String,
    summary: Option<String>,
    knowledge_type: String,
    source_type: String,
    scope: String,
    role_tag: Option<String>,
    dialectic_tag: Option<String>,
    confidence: f64,
    relevance_score: f64,
    usage_count: i64,
    project_id: Option<String>,
    user_id: Option<String>,
}

struct LegacyRow {
    id: String,
    content: String,
    summary: Option<String>,
    knowledge_type: String,
    source_type: String,
    scope: String,
    role_tag: Option<String>,
    dialectic_tag: Option<String>,
    confidence: f64,
    relevance_score: f64,
    usage_count: i64,
    project_id: Option<String>,
    user_id: Option<String>,
    vector_blob: Vec<u8>,
}

fn matches_scope_vec(
    row: &VecRow,
    search_scope: &str,
    user_id: &Option<String>,
    project_id: &Option<String>,
    role_tag: &Option<String>,
) -> bool {
    match search_scope {
        "personal" => row.scope == "personal" && user_id.as_deref() == row.user_id.as_deref(),
        "team" => (row.scope == "team" || row.scope == "global")
            && (project_id.as_deref() == row.project_id.as_deref() || row.project_id.is_none()),
        "role" => (row.scope == "role" || row.scope == "global")
            && (role_tag.as_deref() == row.role_tag.as_deref() || row.role_tag.is_none()),
        "all" => {
            let is_own = user_id.as_deref() == row.user_id.as_deref() && row.user_id.is_some();
            let is_team = project_id.as_deref() == row.project_id.as_deref()
                && row.project_id.is_some()
                && (row.scope == "team" || row.scope == "global");
            let is_global = row.scope == "role" || row.scope == "global";
            is_own || is_team || is_global
        }
        _ => false,
    }
}

fn matches_scope_legacy(
    row: &LegacyRow,
    search_scope: &str,
    user_id: &Option<String>,
    project_id: &Option<String>,
    role_tag: &Option<String>,
) -> bool {
    match search_scope {
        "personal" => row.scope == "personal" && user_id.as_deref() == row.user_id.as_deref(),
        "team" => (row.scope == "team" || row.scope == "global")
            && (project_id.as_deref() == row.project_id.as_deref() || row.project_id.is_none()),
        "role" => (row.scope == "role" || row.scope == "global")
            && (role_tag.as_deref() == row.role_tag.as_deref() || row.role_tag.is_none()),
        "all" => {
            let is_own = user_id.as_deref() == row.user_id.as_deref() && row.user_id.is_some();
            let is_team = project_id.as_deref() == row.project_id.as_deref()
                && row.project_id.is_some()
                && (row.scope == "team" || row.scope == "global");
            let is_global = row.scope == "role" || row.scope == "global";
            is_own || is_team || is_global
        }
        _ => false,
    }
}
