/// Sync Engine — Export/import encrypted knowledge blobs
///
/// Orchestrates the full sync flow:
/// 1. Extract delta changes from local DB
/// 2. Serialize to JSON
/// 3. Encrypt with AES-256-GCM (key derived from DID private key)
/// 4. Return base64 blob (for Supabase Storage or file transfer)
///
/// Import is the reverse:
/// 1. Receive base64 blob
/// 2. Decrypt with DID-derived key
/// 3. Parse JSON delta
/// 4. Apply to local DB with Last-Write-Wins conflict resolution

use crate::did::identity::DidIdentity;
use crate::rag::db::RagDb;
use crate::sync::delta::{self, SyncDelta, SyncMeta};
use crate::sync::encryption;
use serde::{Deserialize, Serialize};

/// Result of an export operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    /// Base64-encoded encrypted blob
    pub blob: String,
    /// Number of items included in the export
    pub item_count: usize,
    /// Total items in local DB
    pub total_count: i64,
    /// Whether this was a delta or full export
    pub is_delta: bool,
    /// The `since` timestamp used (None = full export)
    pub since: Option<String>,
    /// Timestamp of this export
    pub exported_at: String,
    /// Unencrypted size in bytes (for UI display)
    pub raw_size_bytes: usize,
    /// Encrypted blob size in bytes
    pub blob_size_bytes: usize,
}

/// Result of an import operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    /// Number of items successfully upserted
    pub upserted: usize,
    /// Number of items skipped (local is newer — LWW)
    pub skipped: usize,
    /// Total items in the incoming delta
    pub incoming_count: usize,
    /// Timestamp of the import
    pub imported_at: String,
}

/// Sync status information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    /// Whether sync is enabled by user
    pub enabled: bool,
    /// Last successful sync timestamp
    pub last_sync_at: Option<String>,
    /// Number of items synced last time
    pub last_sync_item_count: i64,
    /// Number of items changed since last sync
    pub pending_changes: i64,
    /// Total items in local DB
    pub total_items: i64,
    /// The user's DID (for display)
    pub did: Option<String>,
}

/// Export knowledge items as an encrypted blob.
///
/// If `since` is provided, only items updated after that timestamp are included (delta).
/// If `since` is None, ALL items are exported (full export).
///
/// The blob is encrypted with AES-256-GCM using a key derived from the DID private key.
/// Only devices with the same DID (same private key) can decrypt.
pub fn export_encrypted(
    db: &RagDb,
    identity: &DidIdentity,
    since: Option<&str>,
) -> Result<ExportResult, String> {
    // 1. Get the DID private key for encryption
    let signing_key = identity.get_signing_key()?;
    let sync_key = encryption::derive_sync_key(&signing_key.to_bytes())?;

    // 2. Extract delta (or full export)
    let delta = delta::get_delta(db, since)?;
    let item_count = delta.items.len();
    let total_count = delta.total_count;
    let is_delta = since.is_some();

    if item_count == 0 {
        return Ok(ExportResult {
            blob: String::new(),
            item_count: 0,
            total_count,
            is_delta,
            since: since.map(|s| s.to_string()),
            exported_at: chrono::Utc::now().to_rfc3339(),
            raw_size_bytes: 0,
            blob_size_bytes: 0,
        });
    }

    // 3. Serialize to JSON
    let json = serde_json::to_string(&delta)
        .map_err(|e| format!("Failed to serialize delta: {}", e))?;
    let raw_size = json.len();

    // 4. Encrypt
    let blob = encryption::encrypt_json(&sync_key, &json)?;
    let blob_size = blob.len();

    log::info!(
        "Exported {} items ({} bytes → {} bytes encrypted, delta={})",
        item_count,
        raw_size,
        blob_size,
        is_delta
    );

    Ok(ExportResult {
        blob,
        item_count,
        total_count,
        is_delta,
        since: since.map(|s| s.to_string()),
        exported_at: chrono::Utc::now().to_rfc3339(),
        raw_size_bytes: raw_size,
        blob_size_bytes: blob_size,
    })
}

/// Import an encrypted blob and apply to local database.
///
/// Decrypts the blob, parses the delta, and applies Last-Write-Wins merge.
/// Items where local is newer are skipped.
pub fn import_encrypted(
    db: &RagDb,
    identity: &DidIdentity,
    encrypted_blob: &str,
) -> Result<ImportResult, String> {
    if encrypted_blob.is_empty() {
        return Ok(ImportResult {
            upserted: 0,
            skipped: 0,
            incoming_count: 0,
            imported_at: chrono::Utc::now().to_rfc3339(),
        });
    }

    // 1. Get the DID private key for decryption
    let signing_key = identity.get_signing_key()?;
    let sync_key = encryption::derive_sync_key(&signing_key.to_bytes())?;

    // 2. Decrypt
    let json = encryption::decrypt_json(&sync_key, encrypted_blob)?;

    // 3. Parse delta
    let delta: SyncDelta = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse sync delta: {}", e))?;

    let incoming_count = delta.items.len();

    // 4. Apply with LWW
    let (upserted, skipped) = delta::apply_delta(db, &delta)?;

    log::info!(
        "Imported {} items: {} upserted, {} skipped (LWW)",
        incoming_count,
        upserted,
        skipped
    );

    Ok(ImportResult {
        upserted,
        skipped,
        incoming_count,
        imported_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Get the current sync status.
pub fn get_sync_status(
    db: &RagDb,
    identity: &DidIdentity,
) -> Result<SyncStatus, String> {
    let meta = get_sync_meta(db)?;
    let did = identity.get_did().ok();

    let pending_changes = delta::count_changes(db, meta.last_sync_at.as_deref())?;
    let total_items = delta::count_changes(db, None)?;

    Ok(SyncStatus {
        enabled: meta.sync_enabled,
        last_sync_at: meta.last_sync_at,
        last_sync_item_count: meta.last_sync_item_count,
        pending_changes,
        total_items,
        did,
    })
}

/// Enable or disable sync.
pub fn set_sync_enabled(db: &RagDb, enabled: bool) -> Result<(), String> {
    let conn = db.conn();
    ensure_sync_meta_table(&conn)?;
    conn.execute(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('sync_enabled', ?1)",
        [if enabled { "true" } else { "false" }],
    )
    .map_err(|e| format!("Failed to set sync_enabled: {}", e))?;

    log::info!("Sync {}", if enabled { "enabled" } else { "disabled" });
    Ok(())
}

/// Record that a sync was completed successfully.
pub fn mark_sync_complete(db: &RagDb, item_count: i64) -> Result<(), String> {
    let conn = db.conn();
    ensure_sync_meta_table(&conn)?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_sync_at', ?1)",
        [&now],
    )
    .map_err(|e| format!("Failed to set last_sync_at: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_sync_item_count', ?1)",
        [&item_count.to_string()],
    )
    .map_err(|e| format!("Failed to set last_sync_item_count: {}", e))?;

    log::info!("Sync marked complete at {} ({} items)", now, item_count);
    Ok(())
}

// ── Internal helpers ────────────────────────────────────

/// Ensure the sync_meta table exists.
fn ensure_sync_meta_table(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create sync_meta table: {}", e))?;
    Ok(())
}

/// Read sync metadata from the local key-value store.
fn get_sync_meta(db: &RagDb) -> Result<SyncMeta, String> {
    let conn = db.conn();
    ensure_sync_meta_table(&conn)?;

    let last_sync_at: Option<String> = conn
        .query_row(
            "SELECT value FROM sync_meta WHERE key = 'last_sync_at'",
            [],
            |row| row.get(0),
        )
        .ok();

    let last_sync_item_count: i64 = conn
        .query_row(
            "SELECT value FROM sync_meta WHERE key = 'last_sync_item_count'",
            [],
            |row| {
                let val: String = row.get(0)?;
                Ok(val.parse::<i64>().unwrap_or(0))
            },
        )
        .unwrap_or(0);

    let sync_enabled: bool = conn
        .query_row(
            "SELECT value FROM sync_meta WHERE key = 'sync_enabled'",
            [],
            |row| {
                let val: String = row.get(0)?;
                Ok(val == "true")
            },
        )
        .unwrap_or(false); // Default: OFF

    Ok(SyncMeta {
        last_sync_at,
        last_sync_item_count,
        sync_enabled,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rag::embedding::EmbeddingEngine;
    use crate::rag::knowledge;

    fn setup_test_env() -> (RagDb, DidIdentity, EmbeddingEngine) {
        let temp_dir = std::env::temp_dir().join(format!(
            "rebe_sync_test_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp_dir).unwrap();

        let db = RagDb::open(&temp_dir.join("test.db")).unwrap();
        let embedding = EmbeddingEngine::new(temp_dir.join("models"));

        let did_dir = temp_dir.join("did");
        let identity = DidIdentity::new(did_dir);
        identity.initialize().unwrap();

        (db, identity, embedding)
    }

    fn ingest_test_item(db: &RagDb, embedding: &EmbeddingEngine, content: &str) -> String {
        let result = embedding.embed(content).unwrap();
        let item = knowledge::KnowledgeItem {
            id: String::new(),
            content: content.to_string(),
            summary: None,
            knowledge_type: "context".to_string(),
            source_type: "test".to_string(),
            scope: "personal".to_string(),
            scope_layer: None,
            role_tag: None,
            dialectic_tag: None,
            confidence: 0.7,
            relevance_score: 0.5,
            usage_count: 0,
            decision_maker: None,
            outcome: None,
            financial_impact_krw: None,
            source_id: None,
            source_context: None,
            user_id: None,
            project_id: None,
            did_author: None,
            is_active: true,
            expires_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        knowledge::create_knowledge_item(db, &item, &result.vector).unwrap()
    }

    #[test]
    fn test_export_empty_db() {
        let (db, identity, _embedding) = setup_test_env();
        let result = export_encrypted(&db, &identity, None).unwrap();
        assert_eq!(result.item_count, 0);
        assert!(result.blob.is_empty());
    }

    #[test]
    fn test_export_import_roundtrip() {
        let (db1, identity1, embedding1) = setup_test_env();

        // Insert items into db1
        ingest_test_item(&db1, &embedding1, "예산 3000만원 확정");
        ingest_test_item(&db1, &embedding1, "크리에이티브 방향 논의 필요");
        ingest_test_item(&db1, &embedding1, "납품일 2월 28일 확정");

        // Export from db1
        let export = export_encrypted(&db1, &identity1, None).unwrap();
        assert_eq!(export.item_count, 3);
        assert!(!export.blob.is_empty());
        assert!(!export.is_delta);

        // Import into a new db (same DID identity for decryption)
        let temp_dir2 = std::env::temp_dir().join(format!(
            "rebe_sync_import_test_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp_dir2).unwrap();
        let db2 = RagDb::open(&temp_dir2.join("test.db")).unwrap();

        let import = import_encrypted(&db2, &identity1, &export.blob).unwrap();
        assert_eq!(import.upserted, 3);
        assert_eq!(import.skipped, 0);
        assert_eq!(import.incoming_count, 3);
    }

    #[test]
    fn test_wrong_identity_cannot_decrypt() {
        let (db, identity1, embedding) = setup_test_env();
        ingest_test_item(&db, &embedding, "비밀 데이터");

        let export = export_encrypted(&db, &identity1, None).unwrap();

        // Different identity cannot decrypt
        let temp_dir2 = std::env::temp_dir().join(format!(
            "rebe_sync_wrong_key_{}",
            uuid::Uuid::new_v4()
        ));
        let identity2 = DidIdentity::new(temp_dir2);
        identity2.initialize().unwrap();

        let temp_dir3 = std::env::temp_dir().join(format!(
            "rebe_sync_wrong_db_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp_dir3).unwrap();
        let db2 = RagDb::open(&temp_dir3.join("test.db")).unwrap();

        let result = import_encrypted(&db2, &identity2, &export.blob);
        assert!(result.is_err(), "Should fail with wrong key");
    }

    #[test]
    fn test_delta_export() {
        let (db, identity, embedding) = setup_test_env();

        // Insert initial items
        ingest_test_item(&db, &embedding, "초기 항목 1");
        ingest_test_item(&db, &embedding, "초기 항목 2");

        // Record sync timestamp
        let sync_time = chrono::Utc::now().to_rfc3339();

        // Wait a tiny bit and add new item
        std::thread::sleep(std::time::Duration::from_millis(10));
        ingest_test_item(&db, &embedding, "새로운 항목 3");

        // Delta export should only include the new item
        let export = export_encrypted(&db, &identity, Some(&sync_time)).unwrap();
        assert_eq!(export.item_count, 1);
        assert!(export.is_delta);
    }

    #[test]
    fn test_sync_status() {
        let (db, identity, _embedding) = setup_test_env();

        let status = get_sync_status(&db, &identity).unwrap();
        assert!(!status.enabled);
        assert!(status.last_sync_at.is_none());
        assert_eq!(status.pending_changes, 0);
        assert!(status.did.is_some());
    }

    #[test]
    fn test_enable_disable_sync() {
        let (db, identity, _embedding) = setup_test_env();

        // Default: disabled
        let status = get_sync_status(&db, &identity).unwrap();
        assert!(!status.enabled);

        // Enable
        set_sync_enabled(&db, true).unwrap();
        let status = get_sync_status(&db, &identity).unwrap();
        assert!(status.enabled);

        // Disable
        set_sync_enabled(&db, false).unwrap();
        let status = get_sync_status(&db, &identity).unwrap();
        assert!(!status.enabled);
    }

    #[test]
    fn test_mark_sync_complete() {
        let (db, identity, _embedding) = setup_test_env();

        mark_sync_complete(&db, 42).unwrap();

        let status = get_sync_status(&db, &identity).unwrap();
        assert!(status.last_sync_at.is_some());
        assert_eq!(status.last_sync_item_count, 42);
    }

    #[test]
    fn test_import_empty_blob() {
        let (db, identity, _embedding) = setup_test_env();

        let result = import_encrypted(&db, &identity, "").unwrap();
        assert_eq!(result.upserted, 0);
        assert_eq!(result.incoming_count, 0);
    }

    #[test]
    fn test_lww_on_import() {
        let (db, identity, embedding) = setup_test_env();

        // Insert item
        let id = ingest_test_item(&db, &embedding, "원본 내용");

        // Export
        let export = export_encrypted(&db, &identity, None).unwrap();

        // Modify local item to be newer
        std::thread::sleep(std::time::Duration::from_millis(10));
        {
            let conn = db.conn();
            conn.execute(
                "UPDATE knowledge_items SET content = '수정된 내용', updated_at = ?1 WHERE id = ?2",
                rusqlite::params![chrono::Utc::now().to_rfc3339(), id],
            ).unwrap();
        } // ← conn dropped here to avoid deadlock

        // Import the old export — should be skipped because local is newer
        let import = import_encrypted(&db, &identity, &export.blob).unwrap();
        assert_eq!(import.skipped, 1);
        assert_eq!(import.upserted, 0);

        // Verify local content is unchanged
        {
            let conn = db.conn();
            let content: String = conn
                .query_row(
                    "SELECT content FROM knowledge_items WHERE id = ?1",
                    [&id],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(content, "수정된 내용");
        }
    }
}
