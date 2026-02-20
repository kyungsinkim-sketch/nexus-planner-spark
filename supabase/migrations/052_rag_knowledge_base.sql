-- Migration 052: Personalized RAG Knowledge Base
-- Three-tier knowledge system: Personal Brain, Team Brain, Role Brain
-- Uses pgvector for semantic search on embedded knowledge items.
-- Knowledge is built automatically as users work (chat, decisions, actions).
--
-- Key principle: "업무를 하다 보면 RAG가 자동으로 생깁니다"
-- Users never manually create knowledge — it emerges from their workflow.

-- ─── Enable pgvector extension ───────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Knowledge Items ─────────────────────────────────
-- Core knowledge store: each item is an atomic piece of knowledge
-- with a vector embedding for semantic search.
CREATE TABLE IF NOT EXISTS knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ownership & scope
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,       -- NULL = shared/team
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,    -- NULL = cross-project
    scope TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'team', 'role', 'global')),

    -- Content
    content TEXT NOT NULL,                          -- The knowledge text (max ~2000 chars)
    summary TEXT,                                   -- Short summary for display
    embedding vector(1536),                         -- OpenAI text-embedding-3-small (1536 dims)

    -- Classification
    knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
        'decision_pattern',      -- How this person/team makes decisions
        'preference',            -- Work style preferences
        'judgment',              -- Risk tolerance, budget sense, quality standards
        'collaboration_pattern', -- How team members interact
        'recurring_risk',        -- Risks that appear across projects
        'workflow',              -- Standard operating procedures
        'domain_expertise',      -- Subject matter knowledge
        'feedback_pattern',      -- How they give/receive feedback
        'communication_style',   -- Communication preferences
        'lesson_learned'         -- Post-project insights
    )),

    -- Metadata
    source_type TEXT NOT NULL CHECK (source_type IN (
        'chat_digest',          -- From brain-digest analysis
        'brain_action',         -- From confirmed brain actions
        'peer_review',          -- From project completion reviews
        'decision_log',         -- From explicit decisions
        'meeting_note',         -- From Notion/document analysis
        'manual'                -- Rare: manually added
    )),
    source_id TEXT,                                 -- Reference to original source
    source_context JSONB,                           -- Additional context from source

    -- Role tagging (for role-based RAG)
    role_tag TEXT CHECK (role_tag IN ('CD', 'PD', 'EDITOR', 'DIRECTOR', 'WRITER', 'DESIGNER', 'MANAGER', NULL)),

    -- Quality & relevance
    confidence FLOAT NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    relevance_score FLOAT DEFAULT 0.5,              -- Decays over time, boosted by re-use
    usage_count INT NOT NULL DEFAULT 0,              -- How often this was retrieved
    last_used_at TIMESTAMPTZ,

    -- Lifecycle
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,                          -- Optional TTL for time-sensitive knowledge
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient retrieval
CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge_items(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_items(project_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_knowledge_scope ON knowledge_items(scope) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_items(knowledge_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_knowledge_role ON knowledge_items(role_tag) WHERE is_active = TRUE AND role_tag IS NOT NULL;

-- Vector similarity search index (IVFFlat for production performance)
-- Using cosine distance for normalized embeddings
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_items
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

-- Personal items: user can see their own
DROP POLICY IF EXISTS "Users can view own knowledge" ON knowledge_items;
CREATE POLICY "Users can view own knowledge" ON knowledge_items
    FOR SELECT USING (
        user_id = (select auth.uid())
        OR scope IN ('team', 'role', 'global')
    );

DROP POLICY IF EXISTS "Users can manage own knowledge" ON knowledge_items;
CREATE POLICY "Users can manage own knowledge" ON knowledge_items
    FOR ALL USING (user_id = (select auth.uid()));

-- Service role (Edge Functions) can manage all
DROP POLICY IF EXISTS "Service role full access to knowledge" ON knowledge_items;
CREATE POLICY "Service role full access to knowledge" ON knowledge_items
    FOR ALL USING (true);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_knowledge_items_updated_at') THEN
        CREATE TRIGGER update_knowledge_items_updated_at BEFORE UPDATE ON knowledge_items
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ─── RAG Query Log ──────────────────────────────────
-- Tracks what knowledge was retrieved and whether it was useful
-- Enables feedback loop to improve relevance scoring
CREATE TABLE IF NOT EXISTS rag_query_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    query_embedding vector(1536),
    scope TEXT NOT NULL,                             -- personal, team, role
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

    -- Results
    retrieved_item_ids UUID[] DEFAULT '{}',           -- IDs of knowledge_items returned
    result_count INT NOT NULL DEFAULT 0,
    top_similarity FLOAT,                             -- Best cosine similarity score

    -- Feedback
    was_helpful BOOLEAN,                              -- User feedback (optional)

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_log_user ON rag_query_log(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_log_created ON rag_query_log(created_at);

ALTER TABLE rag_query_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own rag logs" ON rag_query_log;
CREATE POLICY "Users can view own rag logs" ON rag_query_log
    FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Service role full access to rag logs" ON rag_query_log;
CREATE POLICY "Service role full access to rag logs" ON rag_query_log
    FOR ALL USING (true);

-- ─── Knowledge Extraction Queue ─────────────────────
-- Tracks which sources have been processed for knowledge extraction
-- Prevents duplicate extraction from the same source
CREATE TABLE IF NOT EXISTS knowledge_extraction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    items_created INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_extraction_source
    ON knowledge_extraction_log(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_extraction_status
    ON knowledge_extraction_log(status) WHERE status IN ('pending', 'processing');

ALTER TABLE knowledge_extraction_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to extraction log" ON knowledge_extraction_log;
CREATE POLICY "Service role full access to extraction log" ON knowledge_extraction_log
    FOR ALL USING (true);

-- ─── Semantic Search Function ────────────────────────
-- RPC function for vector similarity search with scope filtering
CREATE OR REPLACE FUNCTION search_knowledge(
    query_embedding vector(1536),
    search_scope TEXT DEFAULT 'personal',
    search_user_id UUID DEFAULT NULL,
    search_project_id UUID DEFAULT NULL,
    search_role_tag TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    summary TEXT,
    knowledge_type TEXT,
    scope TEXT,
    source_type TEXT,
    confidence FLOAT,
    relevance_score FLOAT,
    role_tag TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ki.id,
        ki.content,
        ki.summary,
        ki.knowledge_type,
        ki.scope,
        ki.source_type,
        ki.confidence,
        ki.relevance_score,
        ki.role_tag,
        1 - (ki.embedding <=> query_embedding) AS similarity
    FROM knowledge_items ki
    WHERE ki.is_active = TRUE
        AND ki.embedding IS NOT NULL
        AND (ki.expires_at IS NULL OR ki.expires_at > NOW())
        AND (
            -- Scope filtering
            CASE
                WHEN search_scope = 'personal' THEN ki.user_id = search_user_id AND ki.scope = 'personal'
                WHEN search_scope = 'team' THEN ki.project_id = search_project_id AND ki.scope IN ('team', 'global')
                WHEN search_scope = 'role' THEN ki.role_tag = search_role_tag AND ki.scope IN ('role', 'global')
                WHEN search_scope = 'all' THEN (
                    ki.user_id = search_user_id
                    OR ki.project_id = search_project_id
                    OR ki.scope IN ('role', 'global')
                )
                ELSE FALSE
            END
        )
        AND 1 - (ki.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;
