-- ============================================================
-- Migration 075: Decision Context, Threading & Ownership Layer
-- ============================================================
-- Supports Re-Be.io positioning: "Not just what we did, but why we decided to do it"
-- 
-- 1. decision_context — structured decision data (alternatives, reasoning, outcome)
-- 2. decision_threads — cross-tool threading (link multiple knowledge_items to one decision)
-- 3. ownership_type — personal vs organizational data ownership (DID/wallet prep)
-- ============================================================

-- ─── 1. Decision Context on knowledge_items ─────────────────

-- Structured decision data: what alternatives existed, what was chosen, why
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS decision_context JSONB;

COMMENT ON COLUMN knowledge_items.decision_context IS 
  'Structured decision data: { alternatives: string[], chosen: string, reasoning: string, participants: string[], outcome_note: string | null, decided_at: ISO timestamp }';

-- ─── 2. Decision Threads ────────────────────────────────────

-- A decision thread groups multiple knowledge_items from different sources
-- (meeting recording, chat discussion, email confirmation) into one decision narrative.
CREATE TABLE IF NOT EXISTS decision_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Thread metadata
  title TEXT NOT NULL,                    -- "3월 납품일 연기 결정"
  summary TEXT,                           -- AI-generated summary of the full decision arc
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'decided', 'revisited', 'reversed')),
  
  -- Decision outcome (aggregated from linked items)
  final_decision TEXT,                    -- The actual decision made
  final_reasoning TEXT,                   -- Why this was chosen
  decided_at TIMESTAMPTZ,                 -- When the decision was finalized
  
  -- Pattern tagging (for meta-analysis)
  decision_category TEXT CHECK (decision_category IS NULL OR decision_category IN (
    'scope_change',        -- 범위 변경
    'timeline_change',     -- 일정 변경  
    'budget_change',       -- 예산 변경
    'quality_tradeoff',    -- 퀄리티 트레이드오프
    'resource_allocation', -- 리소스 배분
    'client_negotiation',  -- 클라이언트 협상
    'creative_direction',  -- 크리에이티브 방향
    'risk_mitigation',     -- 리스크 대응
    'team_conflict',       -- 팀 갈등 해결
    'vendor_selection',    -- 벤더/파트너 선정
    'process_change',      -- 프로세스 변경
    'other'
  )),
  
  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link table: knowledge_items ↔ decision_threads (many-to-many)
CREATE TABLE IF NOT EXISTS decision_thread_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES decision_threads(id) ON DELETE CASCADE,
  knowledge_item_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  
  -- Order and role within the thread
  sequence_no INT NOT NULL DEFAULT 0,       -- chronological order
  role_in_thread TEXT NOT NULL DEFAULT 'context' CHECK (role_in_thread IN (
    'trigger',      -- 의사결정을 촉발한 이벤트
    'discussion',   -- 논의/토론
    'proposal',     -- 제안
    'objection',    -- 반대 의견
    'resolution',   -- 최종 결정
    'followup',     -- 후속 조치
    'outcome',      -- 결과 피드백
    'context'       -- 배경 정보
  )),
  
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(thread_id, knowledge_item_id)
);

-- ─── 3. Ownership Layer (DID/Wallet prep) ───────────────────

-- Data ownership: personal data follows the user, organizational stays with company
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'personal' 
    CHECK (ownership_type IN ('personal', 'organizational'));

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS org_id UUID;

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'owner_only'
    CHECK (visibility IN ('owner_only', 'org_members', 'connected_ids', 'public'));

-- DID field on profiles (reserved for Ark.ID / Ark.Cards / Re-Be.ID integration)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ark_did TEXT;

COMMENT ON COLUMN knowledge_items.ownership_type IS 'personal = 유저 소유 (퇴사 시 가져감), organizational = 조직 소유 (회사에 남음)';
COMMENT ON COLUMN knowledge_items.org_id IS '소속 조직 ID (organizations 테이블 연동 예정)';
COMMENT ON COLUMN knowledge_items.visibility IS 'owner_only = 본인만, org_members = 같은 조직, connected_ids = 신뢰 네트워크, public = 공개';
COMMENT ON COLUMN profiles.ark_did IS 'DID identifier for Ark.ID / Ark.Cards / Re-Be.ID wallet integration';

-- ─── 4. Extend knowledge_type for decision items ────────────

-- Add new source_type for decision threads
ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_source_type_check;
ALTER TABLE knowledge_items ADD CONSTRAINT knowledge_items_source_type_check CHECK (source_type IN (
    'chat_digest',
    'brain_action',
    'peer_review',
    'decision_log',
    'meeting_note',
    'manual',
    'voice_call',
    'email_analysis',
    'decision_thread'   -- NEW: auto-generated from decision thread analysis
));

-- ─── 5. Indexes ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_knowledge_items_ownership ON knowledge_items(ownership_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_org_id ON knowledge_items(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_items_visibility ON knowledge_items(visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_decision_context ON knowledge_items USING GIN (decision_context) WHERE decision_context IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_decision_threads_user_id ON decision_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_threads_project_id ON decision_threads(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decision_threads_status ON decision_threads(status);
CREATE INDEX IF NOT EXISTS idx_decision_threads_category ON decision_threads(decision_category) WHERE decision_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_decision_thread_items_thread ON decision_thread_items(thread_id);
CREATE INDEX IF NOT EXISTS idx_decision_thread_items_knowledge ON decision_thread_items(knowledge_item_id);

-- ─── 6. RLS Policies ───────────────────────────────────────

ALTER TABLE decision_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_thread_items ENABLE ROW LEVEL SECURITY;

-- Users can see their own decision threads
CREATE POLICY "Users can view own decision threads"
  ON decision_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own decision threads"
  ON decision_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own decision threads"
  ON decision_threads FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do everything (for Brain AI Edge Functions)
CREATE POLICY "Service role full access decision_threads"
  ON decision_threads FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own thread items"
  ON decision_thread_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM decision_threads dt 
    WHERE dt.id = decision_thread_items.thread_id 
    AND dt.user_id = auth.uid()
  ));

CREATE POLICY "Service role full access thread items"
  ON decision_thread_items FOR ALL
  USING (auth.role() = 'service_role');

-- ─── 7. Updated_at trigger ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_decision_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decision_threads_updated_at
  BEFORE UPDATE ON decision_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_decision_thread_timestamp();
