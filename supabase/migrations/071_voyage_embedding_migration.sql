-- Migration 071: Voyage AI Embedding Migration
--
-- OpenAI text-embedding-3-small (1536 dims) → Voyage AI voyage-3-lite (512 dims)
--
-- Strategy:
--   1. Add new embedding_v2 column (vector(512)) for Voyage embeddings
--   2. Keep legacy embedding column (vector(1536)) for backward compat during migration
--   3. Create search_knowledge_v3 that works with either dimension
--   4. Add embedding_model column to track which model generated the embedding
--
-- Data sovereignty: Voyage AI does NOT retain or train on API data.
-- Embeddings are stateless computations — no user data is stored by the provider.

-- Step 1: Add embedding model tracking
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'openai-text-embedding-3-small';

-- Step 2: Add Voyage embedding column (512 dims)
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS embedding_v2 vector(512);

-- Step 3: Create index for Voyage embeddings
CREATE INDEX IF NOT EXISTS idx_knowledge_items_embedding_v2
  ON knowledge_items
  USING ivfflat (embedding_v2 vector_cosine_ops)
  WITH (lists = 10);

-- Step 4: Create search function that supports both embedding dimensions
-- Uses embedding_v2 (Voyage 512) if available, falls back to embedding (OpenAI 1536)
CREATE OR REPLACE FUNCTION search_knowledge_v3(
    query_embedding TEXT,  -- JSON array string (works with any dimension)
    query_dims INT DEFAULT 512,  -- 512 for Voyage, 1536 for legacy OpenAI
    search_scope TEXT DEFAULT 'all',
    search_user_id UUID DEFAULT NULL,
    search_project_id UUID DEFAULT NULL,
    search_role_tag TEXT DEFAULT NULL,
    search_knowledge_type TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 5,
    vector_weight FLOAT DEFAULT 0.70,
    relevance_weight FLOAT DEFAULT 0.20,
    usage_weight FLOAT DEFAULT 0.10
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
    similarity FLOAT,
    hybrid_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
    query_vec_512 vector(512);
    query_vec_1536 vector(1536);
    use_v2 BOOLEAN;
BEGIN
    -- Determine which embedding column to search based on query dimensions
    IF query_dims = 512 THEN
        query_vec_512 := query_embedding::vector(512);
        use_v2 := TRUE;
    ELSE
        query_vec_1536 := query_embedding::vector(1536);
        use_v2 := FALSE;
    END IF;

    IF use_v2 THEN
        -- Search using Voyage embeddings (v2)
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
            (1 - (ki.embedding_v2 <=> query_vec_512))::FLOAT AS similarity,
            (
                (1 - (ki.embedding_v2 <=> query_vec_512)) * vector_weight +
                COALESCE(ki.relevance_score, 0.5) * relevance_weight +
                LEAST(COALESCE(ki.usage_count, 0)::FLOAT / 20.0, 1.0) * usage_weight
            )::FLOAT AS hybrid_score
        FROM knowledge_items ki
        WHERE ki.is_active = TRUE
            AND ki.embedding_v2 IS NOT NULL
            AND (ki.expires_at IS NULL OR ki.expires_at > NOW())
            AND (search_knowledge_type IS NULL OR ki.knowledge_type = search_knowledge_type)
            AND (
                CASE
                    WHEN search_scope = 'personal' THEN
                        ki.user_id = search_user_id AND ki.scope = 'personal'
                    WHEN search_scope = 'team' THEN
                        ki.project_id = search_project_id AND ki.scope IN ('team', 'global')
                    WHEN search_scope = 'role' THEN
                        ki.role_tag = search_role_tag AND ki.scope IN ('role', 'global')
                    WHEN search_scope = 'all' THEN (
                        ki.user_id = search_user_id
                        OR ki.project_id = search_project_id
                        OR ki.scope IN ('role', 'global')
                    )
                    ELSE FALSE
                END
            )
            AND 1 - (ki.embedding_v2 <=> query_vec_512) > match_threshold
        ORDER BY hybrid_score DESC
        LIMIT match_count;
    ELSE
        -- Legacy: Search using OpenAI embeddings (v1)
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
            (1 - (ki.embedding <=> query_vec_1536))::FLOAT AS similarity,
            (
                (1 - (ki.embedding <=> query_vec_1536)) * vector_weight +
                COALESCE(ki.relevance_score, 0.5) * relevance_weight +
                LEAST(COALESCE(ki.usage_count, 0)::FLOAT / 20.0, 1.0) * usage_weight
            )::FLOAT AS hybrid_score
        FROM knowledge_items ki
        WHERE ki.is_active = TRUE
            AND ki.embedding IS NOT NULL
            AND (ki.expires_at IS NULL OR ki.expires_at > NOW())
            AND (search_knowledge_type IS NULL OR ki.knowledge_type = search_knowledge_type)
            AND (
                CASE
                    WHEN search_scope = 'personal' THEN
                        ki.user_id = search_user_id AND ki.scope = 'personal'
                    WHEN search_scope = 'team' THEN
                        ki.project_id = search_project_id AND ki.scope IN ('team', 'global')
                    WHEN search_scope = 'role' THEN
                        ki.role_tag = search_role_tag AND ki.scope IN ('role', 'global')
                    WHEN search_scope = 'all' THEN (
                        ki.user_id = search_user_id
                        OR ki.project_id = search_project_id
                        OR ki.scope IN ('role', 'global')
                    )
                    ELSE FALSE
                END
            )
            AND 1 - (ki.embedding <=> query_vec_1536) > match_threshold
        ORDER BY hybrid_score DESC
        LIMIT match_count;
    END IF;
END;
$$;

-- Step 5: Mark existing embeddings as OpenAI-generated
UPDATE knowledge_items
SET embedding_model = 'openai-text-embedding-3-small'
WHERE embedding IS NOT NULL AND embedding_model IS NULL;
