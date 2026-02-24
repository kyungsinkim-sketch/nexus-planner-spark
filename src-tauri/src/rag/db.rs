/// SQLite database initialization with sqlite-vec for vector search.
///
/// Migration v1: Core tables (knowledge_items, embeddings, extraction_log, etc.)
/// Migration v2: sqlite-vec virtual table for native vector similarity search

use rusqlite::{Connection, Result as SqlResult, ffi::sqlite3_auto_extension};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct RagDb {
    conn: Mutex<Connection>,
}

impl RagDb {
    pub fn open(db_path: &PathBuf) -> SqlResult<Self> {
        // Register sqlite-vec as auto extension BEFORE opening the connection
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite_vec::sqlite3_vec_init as *const (),
            )));
        }

        let conn = Connection::open(db_path)?;

        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        conn.execute_batch("PRAGMA synchronous=NORMAL;")?;

        // Verify sqlite-vec is loaded
        match conn.query_row("SELECT vec_version()", [], |row| row.get::<_, String>(0)) {
            Ok(version) => log::info!("sqlite-vec {} loaded successfully", version),
            Err(e) => log::warn!("sqlite-vec may not be available: {}", e),
        }

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;

        log::info!("RAG database opened at {:?}", db_path);
        Ok(db)
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().expect("Database lock poisoned")
    }

    fn run_migrations(&self) -> SqlResult<()> {
        let conn = self.conn();

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _schema_version (
                version INTEGER PRIMARY KEY,
                applied_at TEXT DEFAULT (datetime('now'))
            );"
        )?;

        let current_version: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM _schema_version",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if current_version < 1 {
            self.migrate_v1(&conn)?;
        }
        if current_version < 2 {
            self.migrate_v2(&conn)?;
        }

        Ok(())
    }

    /// V1: Core RAG tables
    fn migrate_v1(&self, conn: &Connection) -> SqlResult<()> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS knowledge_items (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                summary TEXT,
                knowledge_type TEXT NOT NULL DEFAULT 'context',
                source_type TEXT NOT NULL DEFAULT 'manual',
                role_tag TEXT,
                scope TEXT NOT NULL DEFAULT 'personal'
                    CHECK (scope IN ('personal', 'team', 'role', 'global')),
                scope_layer TEXT
                    CHECK (scope_layer IS NULL OR scope_layer IN (
                        'operations', 'creative', 'pitch',
                        'strategy', 'execution', 'culture'
                    )),
                confidence REAL NOT NULL DEFAULT 0.5,
                relevance_score REAL NOT NULL DEFAULT 0.5,
                usage_count INTEGER NOT NULL DEFAULT 0,
                last_used_at TEXT,
                dialectic_tag TEXT
                    CHECK (dialectic_tag IS NULL OR dialectic_tag IN (
                        'risk', 'opportunity', 'constraint',
                        'quality', 'client_concern'
                    )),
                decision_maker TEXT,
                outcome TEXT
                    CHECK (outcome IS NULL OR outcome IN (
                        'confirmed', 'rejected', 'pending', 'escalated'
                    )),
                financial_impact_krw INTEGER,
                source_id TEXT,
                source_context TEXT,
                user_id TEXT,
                project_id TEXT,
                did_author TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                expires_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_ki_user
                ON knowledge_items(user_id) WHERE is_active = 1;
            CREATE INDEX IF NOT EXISTS idx_ki_project
                ON knowledge_items(project_id) WHERE is_active = 1;
            CREATE INDEX IF NOT EXISTS idx_ki_scope
                ON knowledge_items(scope) WHERE is_active = 1;
            CREATE INDEX IF NOT EXISTS idx_ki_type
                ON knowledge_items(knowledge_type) WHERE is_active = 1;
            CREATE INDEX IF NOT EXISTS idx_ki_role
                ON knowledge_items(role_tag) WHERE is_active = 1 AND role_tag IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_ki_dialectic
                ON knowledge_items(dialectic_tag) WHERE is_active = 1 AND dialectic_tag IS NOT NULL;

            -- Legacy embeddings table (kept for backward compatibility during migration)
            CREATE TABLE IF NOT EXISTS embeddings (
                knowledge_id TEXT PRIMARY KEY REFERENCES knowledge_items(id) ON DELETE CASCADE,
                vector BLOB NOT NULL
            );

            CREATE TABLE IF NOT EXISTS extraction_log (
                id TEXT PRIMARY KEY,
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                items_created INTEGER DEFAULT 0,
                completed_at TEXT,
                UNIQUE(source_type, source_id)
            );

            CREATE TABLE IF NOT EXISTS rag_query_log (
                id TEXT PRIMARY KEY,
                query_text TEXT,
                scope TEXT,
                project_id TEXT,
                retrieved_item_ids TEXT,
                result_count INTEGER,
                top_similarity REAL,
                was_helpful INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS chat_digests (
                id TEXT PRIMARY KEY,
                room_id TEXT,
                project_id TEXT,
                digest_type TEXT NOT NULL,
                content TEXT NOT NULL,
                message_range_start TEXT,
                message_range_end TEXT,
                message_count INTEGER,
                confidence REAL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS decision_patterns (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                knowledge_domain TEXT NOT NULL,
                pattern_type TEXT,
                pattern_summary TEXT,
                evidence_item_ids TEXT,
                confidence REAL,
                sample_count INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, knowledge_domain)
            );

            CREATE TABLE IF NOT EXISTS context_snapshots (
                project_id TEXT PRIMARY KEY,
                snapshot_data TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS persona_query_log (
                id TEXT PRIMARY KEY,
                persona_id TEXT,
                query TEXT,
                rag_context TEXT,
                response TEXT,
                was_helpful INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Sync metadata
            CREATE TABLE IF NOT EXISTS sync_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT (datetime('now'))
            );

            INSERT INTO _schema_version (version) VALUES (1);
            "
        )?;

        log::info!("RAG database migrated to v1");
        Ok(())
    }

    /// V2: sqlite-vec virtual table for native vector search
    fn migrate_v2(&self, conn: &Connection) -> SqlResult<()> {
        // Create sqlite-vec virtual table for 384-dim float32 vectors
        conn.execute_batch(
            "
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_knowledge USING vec0(
                knowledge_id TEXT PRIMARY KEY,
                embedding float[384]
            );

            -- Migrate existing embeddings from BLOB table to vec0
            INSERT OR IGNORE INTO vec_knowledge(knowledge_id, embedding)
            SELECT knowledge_id, vector FROM embeddings;

            INSERT INTO _schema_version (version) VALUES (2);
            "
        )?;

        log::info!("RAG database migrated to v2 (sqlite-vec)");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_and_migrate() {
        let tmp = std::env::temp_dir().join("rag_test_v2.db");
        let _ = std::fs::remove_file(&tmp);
        let db = RagDb::open(&tmp).expect("Failed to open DB");
        let conn = db.conn();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='knowledge_items'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        // Verify sqlite-vec virtual table exists
        let vec_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name='vec_knowledge'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(vec_count, 1);

        drop(conn);
        drop(db);
        let _ = std::fs::remove_file(tmp);
    }
}
