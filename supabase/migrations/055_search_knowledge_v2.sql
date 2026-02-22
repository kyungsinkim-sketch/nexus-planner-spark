-- Migration 055: Hybrid Search — search_knowledge_v2
--
-- 기존 search_knowledge() (순수 벡터 유사도)를 확장하여
-- 벡터 유사도(70%) + relevance_score(20%) + usage_count(10%) 하이브리드 점수로 정렬.
-- knowledge_type 필터, 가중치 조절 파라미터 추가.

CREATE OR REPLACE FUNCTION search_knowledge_v2(
    query_embedding vector(1536),
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
        (1 - (ki.embedding <=> query_embedding))::FLOAT AS similarity,
        (
            (1 - (ki.embedding <=> query_embedding)) * vector_weight +
            COALESCE(ki.relevance_score, 0.5) * relevance_weight +
            LEAST(COALESCE(ki.usage_count, 0)::FLOAT / 20.0, 1.0) * usage_weight
        )::FLOAT AS hybrid_score
    FROM knowledge_items ki
    WHERE ki.is_active = TRUE
        AND ki.embedding IS NOT NULL
        -- 만료된 항목 제외
        AND (ki.expires_at IS NULL OR ki.expires_at > NOW())
        -- knowledge_type 필터 (NULL이면 전체)
        AND (search_knowledge_type IS NULL OR ki.knowledge_type = search_knowledge_type)
        -- scope 필터 (기존 v1과 동일 로직)
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
        -- 벡터 유사도 최소 임계값 (IVFFlat 인덱스 활용)
        AND 1 - (ki.embedding <=> query_embedding) > match_threshold
    ORDER BY hybrid_score DESC
    LIMIT match_count;
END;
$$;
