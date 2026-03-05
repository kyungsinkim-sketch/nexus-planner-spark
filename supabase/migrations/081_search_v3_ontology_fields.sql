-- Migration 081: Add dialectic_tag and scope_layer to search_knowledge_v3 return type
-- Enables Brain AI to understand context type (risk/opportunity/constraint) and scope layer

CREATE OR REPLACE FUNCTION search_knowledge_v3(
    query_embedding TEXT,
    query_dims INT DEFAULT 512,
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
    dialectic_tag TEXT,
    scope_layer TEXT,
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
    IF query_dims = 512 THEN
        query_vec_512 := query_embedding::vector(512);
        use_v2 := TRUE;
    ELSE
        query_vec_1536 := query_embedding::vector(1536);
        use_v2 := FALSE;
    END IF;

    IF use_v2 THEN
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
            ki.dialectic_tag,
            ki.scope_layer,
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
            ki.dialectic_tag,
            ki.scope_layer,
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
