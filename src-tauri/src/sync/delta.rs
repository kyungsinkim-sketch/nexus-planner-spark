/// Delta Change Detection — Track and extract changes for sync
///
/// Detects which knowledge items have been created/updated since the last sync.
/// Uses `updated_at` timestamps for Last-Write-Wins conflict resolution.
///
/// Delta format: JSON array of KnowledgeItem + embedding pairs.

use crate::rag::db::RagDb;
use crate::rag::embedding::blob_to_vector;
use serde::{Deserialize, Serialize};

/// A single knowledge item with its embedding, ready for sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncItem {
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
    pub source_context: Option<String>,
    pub user_id: Option<String>,
    pub project_id: Option<String>,
    pub did_author: Option<String>,
    pub is_active: bool,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    /// Embedding vector (384-dim f32)
    pub embedding: Vec<f32>,
}

/// Delta payload for sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncDelta {
    /// Items that are new or updated since last sync
    pub items: Vec<SyncItem>,
    /// Timestamp of this delta extraction
    pub extracted_at: String,
    /// The `since` timestamp used for this delta
    pub since: Option<String>,
    /// Total item count in the local DB
    pub total_count: i64,
}

/// Sync metadata stored locally to track last sync time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMeta {
    pub last_sync_at: Option<String>,
    pub last_sync_item_count: i64,
    pub sync_enabled: bool,
}

/// Get all knowledge items that changed since a given timestamp.
/// If `since` is None, returns ALL items (full export).
pub fn get_delta(db: &RagDb, since: Option<&str>) -> Result<SyncDelta, String> {
    let conn = db.conn();

    let (query_str, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match since {
        Some(ts) => (
            "SELECT k.id, k.content, k.summary, k.knowledge_type, k.source_type,
                    k.scope, k.scope_layer, k.role_tag, k.dialectic_tag,
                    k.confidence, k.relevance_score, k.usage_count,
                    k.decision_maker, k.outcome, k.financial_impact_krw,
                    k.source_id, k.source_context, k.user_id, k.project_id,
                    k.did_author, k.is_active, k.expires_at, k.created_at, k.updated_at,
                    e.vector
             FROM knowledge_items k
             LEFT JOIN embeddings e ON e.knowledge_id = k.id
             WHERE k.updated_at > ?1
             ORDER BY k.updated_at ASC".to_string(),
            vec![Box::new(ts.to_string())],
        ),
        None => (
            "SELECT k.id, k.content, k.summary, k.knowledge_type, k.source_type,
                    k.scope, k.scope_layer, k.role_tag, k.dialectic_tag,
                    k.confidence, k.relevance_score, k.usage_count,
                    k.decision_maker, k.outcome, k.financial_impact_krw,
                    k.source_id, k.source_context, k.user_id, k.project_id,
                    k.did_author, k.is_active, k.expires_at, k.created_at, k.updated_at,
                    e.vector
             FROM knowledge_items k
             LEFT JOIN embeddings e ON e.knowledge_id = k.id
             ORDER BY k.updated_at ASC".to_string(),
            vec![],
        ),
    };

    let mut stmt = conn
        .prepare(&query_str)
        .map_err(|e| format!("Delta query prepare failed: {}", e))?;

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let items: Vec<SyncItem> = stmt
        .query_map(params_refs.as_slice(), |row| {
            let embedding_blob: Option<Vec<u8>> = row.get(24)?;
            let embedding = embedding_blob
                .map(|b| blob_to_vector(&b))
                .unwrap_or_default();

            Ok(SyncItem {
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
                embedding,
            })
        })
        .map_err(|e| format!("Delta query failed: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let total_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM knowledge_items", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(SyncDelta {
        items,
        extracted_at: chrono::Utc::now().to_rfc3339(),
        since: since.map(|s| s.to_string()),
        total_count,
    })
}

/// Apply incoming sync items to the local database (Last-Write-Wins).
/// Returns (upserted_count, skipped_count).
pub fn apply_delta(
    db: &RagDb,
    delta: &SyncDelta,
) -> Result<(usize, usize), String> {
    let conn = db.conn();
    let mut upserted = 0;
    let mut skipped = 0;

    for item in &delta.items {
        // Check if item exists locally
        let local_updated: Option<String> = conn
            .query_row(
                "SELECT updated_at FROM knowledge_items WHERE id = ?1",
                [&item.id],
                |row| row.get(0),
            )
            .ok();

        let should_upsert = match &local_updated {
            Some(local_ts) => {
                // Last-Write-Wins: incoming is newer
                item.updated_at > *local_ts
            }
            None => true, // New item
        };

        if !should_upsert {
            skipped += 1;
            continue;
        }

        // Upsert knowledge item
        conn.execute(
            "INSERT OR REPLACE INTO knowledge_items (
                id, content, summary, knowledge_type, source_type,
                scope, scope_layer, role_tag, dialectic_tag,
                confidence, relevance_score, usage_count,
                decision_maker, outcome, financial_impact_krw,
                source_id, source_context, user_id, project_id,
                did_author, is_active, expires_at, created_at, updated_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
                ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24
            )",
            rusqlite::params![
                item.id,
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
        .map_err(|e| format!("Upsert knowledge_item failed: {}", e))?;

        // Upsert embedding
        if !item.embedding.is_empty() {
            let blob = crate::rag::embedding::vector_to_blob(&item.embedding);
            conn.execute(
                "INSERT OR REPLACE INTO embeddings (knowledge_id, vector) VALUES (?1, ?2)",
                rusqlite::params![item.id, blob],
            )
            .map_err(|e| format!("Upsert embedding failed: {}", e))?;
        }

        upserted += 1;
    }

    log::info!(
        "Applied sync delta: {} upserted, {} skipped (LWW)",
        upserted,
        skipped
    );

    Ok((upserted, skipped))
}

/// Get the count of items changed since a timestamp.
pub fn count_changes(db: &RagDb, since: Option<&str>) -> Result<i64, String> {
    let conn = db.conn();
    match since {
        Some(ts) => conn
            .query_row(
                "SELECT COUNT(*) FROM knowledge_items WHERE updated_at > ?1",
                [ts],
                |row| row.get(0),
            )
            .map_err(|e| format!("Count changes failed: {}", e)),
        None => conn
            .query_row("SELECT COUNT(*) FROM knowledge_items", [], |row| row.get(0))
            .map_err(|e| format!("Count total failed: {}", e)),
    }
}
