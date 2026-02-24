/// Knowledge Items CRUD — Local SQLite operations
///
/// Provides create, read, update, delete for knowledge_items + embeddings.
/// Maps to Supabase knowledge_items table operations.

use crate::rag::db::RagDb;
use crate::rag::embedding::vector_to_blob;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Knowledge item for insert/update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeItem {
    pub id: String,
    pub content: String,
    pub summary: Option<String>,
    pub knowledge_type: String,
    pub source_type: String,
    pub scope: String,
    pub scope_layer: Option<String>,
    pub role_tag: Option<String>,
    pub dialectic_tag: Option<String>,
    pub confidence: f64,
    pub relevance_score: f64,
    pub usage_count: i64,
    pub decision_maker: Option<String>,
    pub outcome: Option<String>,
    pub financial_impact_krw: Option<i64>,
    pub source_id: Option<String>,
    pub source_context: Option<String>, // JSON string
    pub user_id: Option<String>,
    pub project_id: Option<String>,
    pub did_author: Option<String>,
    pub is_active: bool,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Create a new knowledge item with its embedding vector.
pub fn create_knowledge_item(
    db: &RagDb,
    item: &KnowledgeItem,
    embedding: &[f32],
) -> Result<String, String> {
    let conn = db.conn();

    let id = if item.id.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        item.id.clone()
    };

    conn.execute(
        "INSERT INTO knowledge_items (
            id, content, summary, knowledge_type, source_type, scope, scope_layer,
            role_tag, dialectic_tag, confidence, relevance_score, usage_count,
            decision_maker, outcome, financial_impact_krw,
            source_id, source_context, user_id, project_id, did_author,
            is_active, expires_at, created_at, updated_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
            ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24
        )",
        rusqlite::params![
            id,
            item.content,
            item.summary,
            item.knowledge_type,
            item.source_type,
            item.scope,
            item.scope_layer,
            item.role_tag,
            item.dialectic_tag,
            item.confidence,
            item.relevance_score,
            item.usage_count,
            item.decision_maker,
            item.outcome,
            item.financial_impact_krw,
            item.source_id,
            item.source_context,
            item.user_id,
            item.project_id,
            item.did_author,
            item.is_active as i32,
            item.expires_at,
            item.created_at,
            item.updated_at,
        ],
    )
    .map_err(|e| format!("Insert knowledge_item failed: {}", e))?;

    // Store embedding in both legacy BLOB table and sqlite-vec virtual table
    let blob = vector_to_blob(embedding);
    conn.execute(
        "INSERT INTO embeddings (knowledge_id, vector) VALUES (?1, ?2)",
        rusqlite::params![id, blob],
    )
    .map_err(|e| format!("Insert embedding failed: {}", e))?;

    // Also insert into sqlite-vec virtual table for fast KNN search
    let _ = conn.execute(
        "INSERT OR REPLACE INTO vec_knowledge (knowledge_id, embedding) VALUES (?1, ?2)",
        rusqlite::params![id, blob],
    );

    log::info!("Created knowledge item {} (type: {})", id, item.knowledge_type);
    Ok(id)
}

/// Get knowledge item by ID.
pub fn get_knowledge_item(db: &RagDb, id: &str) -> Result<Option<KnowledgeItem>, String> {
    let conn = db.conn();

    let result = conn.query_row(
        "SELECT id, content, summary, knowledge_type, source_type, scope, scope_layer,
                role_tag, dialectic_tag, confidence, relevance_score, usage_count,
                decision_maker, outcome, financial_impact_krw,
                source_id, source_context, user_id, project_id, did_author,
                is_active, expires_at, created_at, updated_at
         FROM knowledge_items WHERE id = ?1",
        [id],
        |row| {
            Ok(KnowledgeItem {
                id: row.get(0)?,
                content: row.get(1)?,
                summary: row.get(2)?,
                knowledge_type: row.get(3)?,
                source_type: row.get(4)?,
                scope: row.get(5)?,
                scope_layer: row.get(6)?,
                role_tag: row.get(7)?,
                dialectic_tag: row.get(8)?,
                confidence: row.get(9)?,
                relevance_score: row.get(10)?,
                usage_count: row.get(11)?,
                decision_maker: row.get(12)?,
                outcome: row.get(13)?,
                financial_impact_krw: row.get(14)?,
                source_id: row.get(15)?,
                source_context: row.get(16)?,
                user_id: row.get(17)?,
                project_id: row.get(18)?,
                did_author: row.get(19)?,
                is_active: row.get::<_, i32>(20)? != 0,
                expires_at: row.get(21)?,
                created_at: row.get(22)?,
                updated_at: row.get(23)?,
            })
        },
    );

    match result {
        Ok(item) => Ok(Some(item)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Get knowledge_item failed: {}", e)),
    }
}

/// Update relevance score based on feedback.
/// 👍 → +0.02 (max 1.0), 👎 → -0.03 (min 0.0)
pub fn update_feedback(db: &RagDb, item_id: &str, was_helpful: bool) -> Result<(), String> {
    let conn = db.conn();
    let delta: f64 = if was_helpful { 0.02 } else { -0.03 };

    conn.execute(
        "UPDATE knowledge_items
         SET relevance_score = MIN(1.0, MAX(0.0, relevance_score + ?1)),
             updated_at = datetime('now')
         WHERE id = ?2",
        rusqlite::params![delta, item_id],
    )
    .map_err(|e| format!("Update feedback failed: {}", e))?;

    Ok(())
}

/// Soft-delete a knowledge item.
pub fn deactivate_knowledge_item(db: &RagDb, id: &str) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "UPDATE knowledge_items SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
        [id],
    )
    .map_err(|e| format!("Deactivate failed: {}", e))?;
    Ok(())
}

/// Get RAG statistics for the local knowledge base.
#[derive(Debug, Serialize, Deserialize)]
pub struct RagStats {
    pub initialized: bool,
    pub knowledge_count: i64,
    pub active_count: i64,
    pub by_scope: Vec<ScopeCount>,
    pub by_type: Vec<TypeCount>,
    pub last_created_at: Option<String>,
    pub total_usage: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScopeCount {
    pub scope: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TypeCount {
    pub knowledge_type: String,
    pub count: i64,
}

pub fn get_stats(db: &RagDb) -> Result<RagStats, String> {
    let conn = db.conn();

    let knowledge_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM knowledge_items", [], |row| row.get(0))
        .unwrap_or(0);

    let active_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM knowledge_items WHERE is_active = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let last_created_at: Option<String> = conn
        .query_row(
            "SELECT MAX(created_at) FROM knowledge_items",
            [],
            |row| row.get(0),
        )
        .unwrap_or(None);

    let total_usage: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(usage_count), 0) FROM knowledge_items WHERE is_active = 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Count by scope
    let mut scope_stmt = conn
        .prepare("SELECT scope, COUNT(*) FROM knowledge_items WHERE is_active = 1 GROUP BY scope")
        .map_err(|e| format!("Stats query failed: {}", e))?;
    let by_scope: Vec<ScopeCount> = scope_stmt
        .query_map([], |row| {
            Ok(ScopeCount {
                scope: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Stats query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Count by knowledge_type (top 10)
    let mut type_stmt = conn
        .prepare(
            "SELECT knowledge_type, COUNT(*) as cnt FROM knowledge_items
             WHERE is_active = 1 GROUP BY knowledge_type ORDER BY cnt DESC LIMIT 10"
        )
        .map_err(|e| format!("Stats query failed: {}", e))?;
    let by_type: Vec<TypeCount> = type_stmt
        .query_map([], |row| {
            Ok(TypeCount {
                knowledge_type: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Stats query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(RagStats {
        initialized: true,
        knowledge_count,
        active_count,
        by_scope,
        by_type,
        last_created_at,
        total_usage,
    })
}

/// Check if a source has already been extracted (duplicate prevention).
pub fn is_extracted(db: &RagDb, source_type: &str, source_id: &str) -> Result<bool, String> {
    let conn = db.conn();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM extraction_log WHERE source_type = ?1 AND source_id = ?2",
            rusqlite::params![source_type, source_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(count > 0)
}

/// Record extraction completion.
pub fn mark_extracted(
    db: &RagDb,
    source_type: &str,
    source_id: &str,
    items_created: i64,
) -> Result<(), String> {
    let conn = db.conn();
    conn.execute(
        "INSERT OR REPLACE INTO extraction_log (id, source_type, source_id, items_created, completed_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            source_type,
            source_id,
            items_created,
        ],
    )
    .map_err(|e| format!("Mark extracted failed: {}", e))?;
    Ok(())
}

/// Log a RAG query for feedback tracking.
pub fn log_query(
    db: &RagDb,
    query_text: &str,
    scope: &str,
    project_id: Option<&str>,
    retrieved_ids: &[String],
    top_similarity: f64,
) -> Result<String, String> {
    let conn = db.conn();
    let id = Uuid::new_v4().to_string();
    let ids_json = serde_json::to_string(retrieved_ids).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO rag_query_log (id, query_text, scope, project_id, retrieved_item_ids, result_count, top_similarity)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            id,
            query_text,
            scope,
            project_id,
            ids_json,
            retrieved_ids.len() as i64,
            top_similarity,
        ],
    )
    .map_err(|e| format!("Log query failed: {}", e))?;

    Ok(id)
}

/// Record user feedback on a query.
pub fn record_query_feedback(
    db: &RagDb,
    query_log_id: &str,
    was_helpful: bool,
) -> Result<(), String> {
    let conn = db.conn();

    // Update query log
    conn.execute(
        "UPDATE rag_query_log SET was_helpful = ?1 WHERE id = ?2",
        rusqlite::params![was_helpful as i32, query_log_id],
    )
    .map_err(|e| format!("Record feedback failed: {}", e))?;

    // Also update relevance scores for the retrieved items
    let ids_json: String = conn
        .query_row(
            "SELECT retrieved_item_ids FROM rag_query_log WHERE id = ?1",
            [query_log_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "[]".to_string());

    if let Ok(ids) = serde_json::from_str::<Vec<String>>(&ids_json) {
        for item_id in ids {
            let _ = update_feedback(db, &item_id, was_helpful);
        }
    }

    Ok(())
}
