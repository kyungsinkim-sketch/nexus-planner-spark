-- Migration 054: RAG Feedback Loop — was_helpful → relevance_score
--
-- 1. increment_knowledge_usage(): 검색 결과 항목의 usage_count 원자적 증가
-- 2. update_knowledge_relevance(): 사용자 피드백(👍/👎)을 relevance_score에 자동 반영
-- 3. trg_feedback_relevance: rag_query_log UPDATE 시 자동 실행 트리거

-- ─── 1. Usage Count 원자적 증가 함수 ────────────────
-- rag-query Edge Function에서 검색 결과 반환 시 호출
CREATE OR REPLACE FUNCTION increment_knowledge_usage(item_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item_id UUID;
BEGIN
  FOREACH item_id IN ARRAY COALESCE(item_ids, '{}')
  LOOP
    UPDATE knowledge_items
    SET usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = item_id AND is_active = TRUE;
  END LOOP;
END;
$$;

-- ─── 2. 피드백 → relevance_score 반영 트리거 함수 ────
-- was_helpful = true  → +0.05 (max 1.0)
-- was_helpful = false → -0.10 (min 0.0)
-- 부정 피드백에 더 높은 감소치 적용하여 저품질 지식 빠르게 걸러냄
CREATE OR REPLACE FUNCTION update_knowledge_relevance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item_id UUID;
  delta FLOAT;
BEGIN
  -- was_helpful이 NULL → 값이 들어올 때만 실행
  IF NEW.was_helpful IS NOT NULL AND (OLD.was_helpful IS NULL OR OLD.was_helpful IS DISTINCT FROM NEW.was_helpful) THEN
    delta := CASE WHEN NEW.was_helpful THEN 0.05 ELSE -0.10 END;

    FOREACH item_id IN ARRAY COALESCE(NEW.retrieved_item_ids, '{}')
    LOOP
      UPDATE knowledge_items
      SET relevance_score = GREATEST(0.0, LEAST(1.0, COALESCE(relevance_score, 0.5) + delta)),
          updated_at = NOW()
      WHERE id = item_id AND is_active = TRUE;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 3. 트리거 연결 ─────────────────────────────────
DROP TRIGGER IF EXISTS trg_feedback_relevance ON rag_query_log;
CREATE TRIGGER trg_feedback_relevance
  AFTER UPDATE OF was_helpful ON rag_query_log
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_relevance();
