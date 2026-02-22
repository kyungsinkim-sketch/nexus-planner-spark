-- Migration 058: Persona Chat Integration
-- chat_messages에 persona_response 타입 + persona_response_data 컬럼 추가
-- @pablo 멘션 → AI 페르소나 응답 메시지 지원

-- ─── 1. message_type CHECK 확장 ────────────────────────
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IN (
    'text', 'file', 'location', 'schedule', 'decision', 'brain_action',
    'persona_response'   -- 신규: AI 페르소나 응답 (Pablo AI 등)
  ));

-- ─── 2. persona_response_data JSONB 컬럼 추가 ─────────
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS persona_response_data JSONB;

COMMENT ON COLUMN chat_messages.persona_response_data IS
  'AI 페르소나 응답 데이터: {personaId, personaName, response, ragContext[], queryLogId}';
