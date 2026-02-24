// Re-Be.io Desktop — Tauri entry point
// Phase 1: Desktop app wrapping
// Phase 2: Local RAG with SQLite + ONNX embeddings
// Phase 3: Knowledge pipeline (digest, ingest, seed)
// Phase 4: DID agent identity (Ed25519 + did:key)
// Phase 5: E2E encrypted sync
// Phase 6: macOS native notifications + dock badge

mod did;
mod rag;
mod sync;

use did::identity::DidIdentity;
use did::signing;
use rag::db::RagDb;
use rag::digest;
use rag::embedding::EmbeddingEngine;
use rag::ingest;
use rag::knowledge;
use rag::query;
use rag::seed;
use sync::sync as sync_engine;
use std::sync::Arc;
use tauri::Manager;


/// Shared state accessible from all IPC commands
struct AppState {
    db: Arc<RagDb>,
    embedding: Arc<EmbeddingEngine>,
    did_identity: Arc<DidIdentity>,
}

// ── General IPC ──────────────────────────────────────────

/// IPC: Check if running in desktop mode (Tauri)
#[tauri::command]
fn is_desktop() -> bool {
    true
}

/// IPC: Get app version
#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// IPC: Ping — health check for frontend ↔ Rust bridge
#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

// ── Phase 2: Local RAG IPC ──────────────────────────────

/// IPC: Search local knowledge base (hybrid vector + text search)
#[tauri::command]
fn rag_search(
    state: tauri::State<'_, AppState>,
    query: String,
    scope: Option<String>,
    user_id: Option<String>,
    project_id: Option<String>,
    role_tag: Option<String>,
    knowledge_type: Option<String>,
    threshold: Option<f32>,
    limit: Option<usize>,
) -> Result<String, String> {
    let embedding_result = state.embedding.embed(&query)?;

    let params = query::SearchParams {
        query_embedding: embedding_result.vector,
        scope: scope.unwrap_or_else(|| "all".to_string()),
        user_id,
        project_id: project_id.clone(),
        role_tag,
        knowledge_type,
        threshold: threshold.unwrap_or(0.30),
        limit: limit.unwrap_or(5),
        ..Default::default()
    };

    let results = query::hybrid_search(&state.db, &params)?;

    // Log the query
    let retrieved_ids: Vec<String> = results.iter().map(|r| r.id.clone()).collect();
    let top_sim = results.first().map(|r| r.similarity).unwrap_or(0.0);
    let _ = knowledge::log_query(
        &state.db,
        &query,
        &params.scope,
        project_id.as_deref(),
        &retrieved_ids,
        top_sim,
    );

    serde_json::to_string(&results).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Dialectic search for 정반합 (antithesis pass)
#[tauri::command]
fn rag_dialectic_search(
    state: tauri::State<'_, AppState>,
    query: String,
    user_id: Option<String>,
    project_id: Option<String>,
    role_tag: Option<String>,
    opposing_tags: Option<Vec<String>>,
    threshold: Option<f32>,
    limit: Option<usize>,
) -> Result<String, String> {
    let embedding_result = state.embedding.embed(&query)?;

    let params = query::DialecticParams {
        query_embedding: embedding_result.vector,
        user_id,
        project_id,
        role_tag,
        opposing_tags: opposing_tags.unwrap_or_else(|| {
            vec![
                "risk".to_string(),
                "constraint".to_string(),
                "client_concern".to_string(),
            ]
        }),
        threshold: threshold.unwrap_or(0.25),
        limit: limit.unwrap_or(3),
    };

    let results = query::dialectic_search(&state.db, &params)?;
    serde_json::to_string(&results).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Get RAG context string for LLM injection (3-pass search)
#[tauri::command]
fn rag_get_context(
    state: tauri::State<'_, AppState>,
    query: String,
    scope: Option<String>,
    user_id: Option<String>,
    project_id: Option<String>,
    role_tag: Option<String>,
    max_chars: Option<usize>,
) -> Result<String, String> {
    let embedding_result = state.embedding.embed(&query)?;

    // Pass 1 (정 thesis): General hybrid search
    let thesis_params = query::SearchParams {
        query_embedding: embedding_result.vector.clone(),
        scope: scope.unwrap_or_else(|| "all".to_string()),
        user_id: user_id.clone(),
        project_id: project_id.clone(),
        role_tag: role_tag.clone(),
        threshold: 0.30,
        limit: 5,
        ..Default::default()
    };
    let thesis_results = query::hybrid_search(&state.db, &thesis_params)?;

    // Pass 2 (반 antithesis): Dialectic opposing search
    let anti_params = query::DialecticParams {
        query_embedding: embedding_result.vector.clone(),
        user_id: user_id.clone(),
        project_id: project_id.clone(),
        role_tag: role_tag.clone(),
        threshold: 0.25,
        limit: 3,
        ..Default::default()
    };
    let anti_results = query::dialectic_search(&state.db, &anti_params)?;

    // Pass 3 (개인 personal): Personal scope search
    let personal_params = query::SearchParams {
        query_embedding: embedding_result.vector,
        scope: "personal".to_string(),
        user_id,
        project_id: None,
        role_tag: None,
        threshold: 0.25,
        limit: 3,
        ..Default::default()
    };
    let personal_results = query::hybrid_search(&state.db, &personal_params)?;

    // Merge and deduplicate (thesis → anti → personal)
    let mut all_results: Vec<query::SearchResult> = Vec::new();
    let mut seen_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

    for result in thesis_results
        .into_iter()
        .chain(anti_results)
        .chain(personal_results)
    {
        if seen_ids.insert(result.id.clone()) {
            all_results.push(result);
        }
    }

    let context = query::build_rag_context(&all_results, max_chars.unwrap_or(800));
    Ok(context)
}

/// IPC: Ingest knowledge item into local DB (with DID author tagging)
#[tauri::command]
fn rag_ingest(
    state: tauri::State<'_, AppState>,
    content: String,
    knowledge_type: String,
    source_type: String,
    scope: Option<String>,
    scope_layer: Option<String>,
    role_tag: Option<String>,
    dialectic_tag: Option<String>,
    confidence: Option<f64>,
    user_id: Option<String>,
    project_id: Option<String>,
    source_id: Option<String>,
    source_context: Option<String>,
) -> Result<String, String> {
    let embedding_result = state.embedding.embed(&content)?;

    // Tag with DID author
    let did_author = state.did_identity.get_did().ok();

    let item = knowledge::KnowledgeItem {
        id: String::new(),
        content,
        summary: None,
        knowledge_type,
        source_type,
        scope: scope.unwrap_or_else(|| "personal".to_string()),
        scope_layer,
        role_tag,
        dialectic_tag,
        confidence: confidence.unwrap_or(0.5),
        relevance_score: 0.5,
        usage_count: 0,
        decision_maker: None,
        outcome: None,
        financial_impact_krw: None,
        source_id,
        source_context,
        user_id,
        project_id,
        did_author,
        is_active: true,
        expires_at: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let id = knowledge::create_knowledge_item(&state.db, &item, &embedding_result.vector)?;

    Ok(serde_json::json!({
        "id": id,
        "is_pseudo_embedding": embedding_result.is_pseudo,
        "did_author": item.did_author,
    })
    .to_string())
}

/// IPC: Get local RAG statistics
#[tauri::command]
fn rag_stats(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let stats = knowledge::get_stats(&state.db)?;
    serde_json::to_string(&stats).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Submit feedback on a RAG query
#[tauri::command]
fn rag_feedback(
    state: tauri::State<'_, AppState>,
    query_log_id: String,
    was_helpful: bool,
) -> Result<(), String> {
    knowledge::record_query_feedback(&state.db, &query_log_id, was_helpful)
}

// ── Phase 3: Knowledge Pipeline IPC ─────────────────────

/// IPC: Analyze chat messages using Claude Haiku (digest)
#[tauri::command]
async fn rag_digest(
    state: tauri::State<'_, AppState>,
    messages: Vec<digest::ChatMessage>,
    room_id: String,
    project_id: Option<String>,
    api_key: String,
) -> Result<String, String> {
    if messages.is_empty() {
        return Err("No messages to analyze".into());
    }

    let result = digest::analyze_conversation(&messages, &api_key).await?;

    let digest_ids = digest::store_digest(
        &state.db,
        &room_id,
        project_id.as_deref(),
        &result,
        messages.len() as i64,
    )?;

    Ok(serde_json::json!({
        "digest": result,
        "stored_ids": digest_ids,
    })
    .to_string())
}

/// IPC: Extract knowledge from a stored digest (deep analysis via Claude)
#[tauri::command]
async fn rag_extract_from_digest(
    state: tauri::State<'_, AppState>,
    digest_json: String,
    user_id: Option<String>,
    project_id: Option<String>,
    source_id: String,
    api_key: String,
) -> Result<String, String> {
    let digest_result: digest::DigestResult = serde_json::from_str(&digest_json)
        .map_err(|e| format!("Invalid digest JSON: {}", e))?;

    let result = ingest::from_digest(
        &state.db,
        &state.embedding,
        &digest_result,
        user_id.as_deref(),
        project_id.as_deref(),
        &source_id,
        &api_key,
    )
    .await?;

    serde_json::to_string(&result).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Ingest knowledge from a brain action (no Claude API needed)
#[tauri::command]
fn rag_ingest_action(
    state: tauri::State<'_, AppState>,
    action_type: String,
    action_content: String,
    user_id: Option<String>,
    project_id: Option<String>,
    source_id: String,
) -> Result<String, String> {
    let result = ingest::from_action(
        &state.db,
        &state.embedding,
        &action_type,
        &action_content,
        user_id.as_deref(),
        project_id.as_deref(),
        &source_id,
    )?;

    serde_json::to_string(&result).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Ingest knowledge from a peer review
#[tauri::command]
fn rag_ingest_review(
    state: tauri::State<'_, AppState>,
    reviewer_name: String,
    reviewee_name: String,
    rating: f64,
    comment: String,
    user_id: Option<String>,
    project_id: Option<String>,
    source_id: String,
) -> Result<String, String> {
    let result = ingest::from_review(
        &state.db,
        &state.embedding,
        &reviewer_name,
        &reviewee_name,
        rating,
        &comment,
        user_id.as_deref(),
        project_id.as_deref(),
        &source_id,
    )?;

    serde_json::to_string(&result).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Get recent digests for a room
#[tauri::command]
fn rag_get_digests(
    state: tauri::State<'_, AppState>,
    room_id: String,
    limit: Option<usize>,
) -> Result<String, String> {
    let digests = digest::get_recent_digests(&state.db, &room_id, limit.unwrap_or(10))?;
    serde_json::to_string(&digests).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Seed CEO patterns (runs on first launch)
#[tauri::command]
fn rag_seed_ceo(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let count = seed::seed_ceo_patterns(&state.db, &state.embedding)?;
    Ok(serde_json::json!({
        "seeded": count,
        "already_seeded": count == 0,
    })
    .to_string())
}

/// IPC: Check if CEO patterns are seeded
#[tauri::command]
fn rag_is_seeded(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    seed::is_seeded(&state.db)
}

// ── Phase 4: DID Identity IPC ────────────────────────────

/// IPC: Get or create DID identity
#[tauri::command]
fn did_get_identity(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let info = state.did_identity.initialize()?;
    serde_json::to_string(&info).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Check if a DID identity exists
#[tauri::command]
fn did_has_identity(state: tauri::State<'_, AppState>) -> bool {
    state.did_identity.has_identity()
}

/// IPC: Get the current DID string
#[tauri::command]
fn did_get_did(state: tauri::State<'_, AppState>) -> Result<String, String> {
    state.did_identity.get_did()
}

/// IPC: Sign a knowledge item
#[tauri::command]
fn did_sign_knowledge(
    state: tauri::State<'_, AppState>,
    content: String,
    knowledge_type: String,
    created_at: String,
) -> Result<String, String> {
    let sig = signing::sign_knowledge(
        &state.did_identity,
        &content,
        &knowledge_type,
        &created_at,
    )?;
    serde_json::to_string(&sig).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Verify a knowledge item signature
#[tauri::command]
fn did_verify_knowledge(
    sig_json: String,
    content: String,
    knowledge_type: String,
    created_at: String,
) -> Result<bool, String> {
    let sig: signing::KnowledgeSignature = serde_json::from_str(&sig_json)
        .map_err(|e| format!("Invalid signature JSON: {}", e))?;
    signing::verify_knowledge(&sig, &content, &knowledge_type, &created_at)
}

/// IPC: Export keypair for multi-device transfer
/// ⚠️ Contains private key — handle with extreme care!
#[tauri::command]
fn did_export_keypair(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let exported = state.did_identity.export_keypair()?;
    serde_json::to_string(&exported).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Import keypair from another device
#[tauri::command]
fn did_import_keypair(
    state: tauri::State<'_, AppState>,
    private_key_hex: String,
) -> Result<String, String> {
    let info = state.did_identity.import_keypair(&private_key_hex)?;
    serde_json::to_string(&info).map_err(|e| format!("Serialize failed: {}", e))
}

// ── Phase 5: E2E Sync IPC ─────────────────────────────

/// IPC: Export knowledge as encrypted blob
/// If `since` is provided, exports only changes after that timestamp (delta).
/// If `since` is None, exports ALL items (full export).
#[tauri::command]
fn sync_export(
    state: tauri::State<'_, AppState>,
    since: Option<String>,
) -> Result<String, String> {
    let result = sync_engine::export_encrypted(
        &state.db,
        &state.did_identity,
        since.as_deref(),
    )?;
    serde_json::to_string(&result).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Import an encrypted blob into local database
/// Decrypts and applies Last-Write-Wins merge.
#[tauri::command]
fn sync_import(
    state: tauri::State<'_, AppState>,
    encrypted_blob: String,
) -> Result<String, String> {
    let result = sync_engine::import_encrypted(
        &state.db,
        &state.did_identity,
        &encrypted_blob,
    )?;

    // Mark sync complete
    let _ = sync_engine::mark_sync_complete(
        &state.db,
        result.upserted as i64,
    );

    serde_json::to_string(&result).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Get sync status (enabled, last sync, pending changes)
#[tauri::command]
fn sync_status(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let status = sync_engine::get_sync_status(&state.db, &state.did_identity)?;
    serde_json::to_string(&status).map_err(|e| format!("Serialize failed: {}", e))
}

/// IPC: Enable or disable sync
#[tauri::command]
fn sync_set_enabled(
    state: tauri::State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    sync_engine::set_sync_enabled(&state.db, enabled)
}

/// IPC: Get count of items changed since last sync
#[tauri::command]
fn sync_pending_count(state: tauri::State<'_, AppState>) -> Result<i64, String> {
    // Get last sync time from meta
    let status = sync_engine::get_sync_status(&state.db, &state.did_identity)?;
    sync::delta::count_changes(&state.db, status.last_sync_at.as_deref())
}

// ── Phase 6: macOS Notification + Dock Badge ─────────

/// IPC: Set the Dock badge count (macOS red number badge)
/// Pass 0 to clear the badge.
/// Uses osascript for reliable cross-version macOS support.
#[tauri::command]
fn set_badge_count(_app: tauri::AppHandle, count: i32) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let badge_label = if count > 0 {
            count.to_string()
        } else {
            String::new()
        };

        // Use osascript to set dock badge — simple and reliable
        let script = format!(
            r#"
            use framework "AppKit"
            set badgeLabel to "{}"
            (current application's NSApplication's sharedApplication())'s dockTile()'s setBadgeLabel_(badgeLabel)
            "#,
            badge_label
        );

        std::process::Command::new("osascript")
            .arg("-l")
            .arg("AppleScriptObjC")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| format!("osascript failed: {}", e))?;

        log::info!("Dock badge set to '{}'", badge_label);
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = count;
    }
    Ok(())
}

/// IPC: Request the app window to gain focus (e.g., on notification click)
#[tauri::command]
fn focus_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(desktop)]
        {
            let _ = window.set_focus();
            let _ = window.unminimize();
        }
        let _ = window; // suppress unused warning on mobile
    }
    Ok(())
}

// ── App entry ──────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Register plugins BEFORE setup (Tauri v2 requirement)
    builder = builder.plugin(tauri_plugin_notification::init());

    if cfg!(debug_assertions) {
        builder = builder.plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        );
    } else {
        // Release mode: register log plugin with Warn level for crash diagnostics
        builder = builder.plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Warn)
                .build(),
        );
    }

    builder
        .setup(|app| {
            // Initialize local RAG database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

            let db_path = app_data_dir.join("rag.db");
            let db = RagDb::open(&db_path).expect("Failed to open RAG database");
            let db = Arc::new(db);

            // Initialize embedding engine
            let model_dir = app_data_dir.join("models").join("all-MiniLM-L6-v2");
            let embedding = EmbeddingEngine::new(model_dir);

            if embedding.is_model_available() {
                log::info!("ONNX embedding model loaded");
            } else {
                log::warn!(
                    "ONNX model not found — using pseudo-embeddings (download model for production)"
                );
            }

            let embedding = Arc::new(embedding);

            // Initialize DID identity (Ed25519 keypair)
            let did_dir = app_data_dir.join("did");
            let did_identity = DidIdentity::new(did_dir);
            match did_identity.initialize() {
                Ok(info) => {
                    log::info!("DID identity ready: {}", info.did);
                }
                Err(e) => {
                    log::error!("Failed to initialize DID identity: {}", e);
                }
            }
            let did_identity = Arc::new(did_identity);

            // CEO pattern seeding on first launch
            match seed::seed_ceo_patterns(&db, &embedding) {
                Ok(count) if count > 0 => {
                    log::info!("Seeded {} CEO knowledge patterns on first launch", count);
                }
                Ok(_) => {
                    log::info!("CEO patterns already seeded");
                }
                Err(e) => {
                    log::error!("Failed to seed CEO patterns: {}", e);
                }
            }

            // Store shared state
            app.manage(AppState {
                db,
                embedding,
                did_identity,
            });

            log::info!(
                "Re-Be.io Desktop v{} started (RAG DB: {:?})",
                env!("CARGO_PKG_VERSION"),
                db_path
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // General
            is_desktop,
            get_app_version,
            ping,
            // RAG search (Phase 2)
            rag_search,
            rag_dialectic_search,
            rag_get_context,
            // RAG ingest (Phase 2)
            rag_ingest,
            // RAG stats & feedback (Phase 2)
            rag_stats,
            rag_feedback,
            // Knowledge pipeline (Phase 3)
            rag_digest,
            rag_extract_from_digest,
            rag_ingest_action,
            rag_ingest_review,
            rag_get_digests,
            rag_seed_ceo,
            rag_is_seeded,
            // DID identity (Phase 4)
            did_get_identity,
            did_has_identity,
            did_get_did,
            did_sign_knowledge,
            did_verify_knowledge,
            did_export_keypair,
            did_import_keypair,
            // E2E Sync (Phase 5)
            sync_export,
            sync_import,
            sync_status,
            sync_set_enabled,
            sync_pending_count,
            // macOS Notifications + Badge (Phase 6)
            set_badge_count,
            focus_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
