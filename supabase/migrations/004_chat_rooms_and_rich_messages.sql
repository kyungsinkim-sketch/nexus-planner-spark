-- =====================================================
-- CHAT ROOMS & RICH MESSAGES MIGRATION
-- 프로젝트 내 다중 채팅방(서브채널) + 리치 메시지 지원
-- Version: 2026.02.11
-- =====================================================

-- =====================================================
-- 1. CHAT ROOMS TABLE (채팅방)
-- 프로젝트 내에서 다수의 채팅방을 생성할 수 있음
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE chat_rooms IS '프로젝트 내 채팅방 (서브채널). is_default=true 는 프로젝트 기본 "전체" 채팅방';
COMMENT ON COLUMN chat_rooms.is_default IS '기본 채팅방 여부 — 프로젝트 당 하나만 존재, 삭제 불가';

-- =====================================================
-- 2. CHAT ROOM MEMBERS TABLE (채팅방 멤버)
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_room_members (
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

COMMENT ON TABLE chat_room_members IS '채팅방 멤버 매핑. 기본 채팅방은 프로젝트 전체 팀원이 자동 추가됨';

-- =====================================================
-- 3. UPDATE profiles work_status CHECK CONSTRAINT
-- 새로운 상태 추가: REMOTE, OVERSEAS, FILMING, FIELD
-- =====================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_work_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_work_status_check
    CHECK (work_status IN ('AT_WORK', 'NOT_AT_WORK', 'LUNCH', 'TRAINING', 'REMOTE', 'OVERSEAS', 'FILMING', 'FIELD'));

-- =====================================================
-- 4. ALTER chat_messages — room_id + 리치 메시지 컬럼
-- =====================================================

-- 채팅방 참조 (NULL이면 DM 또는 레거시 메시지)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE;

-- 메시지 유형
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'file', 'location', 'schedule', 'decision'));

-- 리치 메시지 데이터 (JSONB)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS location_data JSONB;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS schedule_data JSONB;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS decision_data JSONB;

-- =====================================================
-- 5. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_chat_rooms_project ON chat_rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_default ON chat_rooms(project_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room ON chat_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user ON chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(message_type);

-- =====================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;

-- Chat rooms: 프로젝트 팀 멤버만 채팅방 조회 가능
CREATE POLICY "Team members can view project chat rooms"
    ON chat_rooms FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM projects WHERE auth.uid()::uuid = ANY(team_member_ids)
        )
    );

-- Chat rooms: 프로젝트 팀 멤버가 채팅방 생성 가능
CREATE POLICY "Team members can create chat rooms"
    ON chat_rooms FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM projects WHERE auth.uid()::uuid = ANY(team_member_ids)
        )
        AND created_by = auth.uid()
    );

-- Chat rooms: 생성자 또는 관리자만 수정 가능
CREATE POLICY "Creator or admin can update chat rooms"
    ON chat_rooms FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Chat rooms: 기본 채팅방 삭제 방지 (created_by 또는 admin, is_default=false만)
CREATE POLICY "Creator or admin can delete non-default rooms"
    ON chat_rooms FOR DELETE
    USING (
        is_default = FALSE AND (
            created_by = auth.uid() OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
        )
    );

-- Chat room members: 참여 중인 방만 멤버 목록 조회 가능
CREATE POLICY "Members can view room members"
    ON chat_room_members FOR SELECT
    USING (
        room_id IN (
            SELECT room_id FROM chat_room_members WHERE user_id = auth.uid()
        )
    );

-- Chat room members: 팀 멤버가 멤버 추가 가능
CREATE POLICY "Team members can add room members"
    ON chat_room_members FOR INSERT
    WITH CHECK (
        room_id IN (
            SELECT cr.id FROM chat_rooms cr
            JOIN projects p ON p.id = cr.project_id
            WHERE auth.uid()::uuid = ANY(p.team_member_ids)
        )
    );

-- Chat room members: 본인 탈퇴 또는 관리자/방장이 제거 가능
CREATE POLICY "Members can leave or admin can remove"
    ON chat_room_members FOR DELETE
    USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN') OR
        room_id IN (
            SELECT id FROM chat_rooms WHERE created_by = auth.uid()
        )
    );

-- =====================================================
-- 7. TRIGGER: 프로젝트 생성 시 기본 채팅방 자동 생성
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_chat_room()
RETURNS TRIGGER AS $$
BEGIN
    -- 기본 "전체" 채팅방 생성
    INSERT INTO chat_rooms (project_id, name, description, is_default, created_by)
    VALUES (NEW.id, '전체', '프로젝트 전체 채팅방', TRUE, NEW.pm_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_default_chat_room ON projects;
CREATE TRIGGER trigger_create_default_chat_room
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION create_default_chat_room();

-- =====================================================
-- 8. TRIGGER: 기본 채팅방에 팀 멤버 자동 추가
-- 프로젝트의 team_member_ids 변경 시 기본 채팅방 멤버 동기화
-- =====================================================
CREATE OR REPLACE FUNCTION sync_default_room_members()
RETURNS TRIGGER AS $$
DECLARE
    default_room_id UUID;
    member_id UUID;
BEGIN
    -- 기본 채팅방 찾기
    SELECT id INTO default_room_id
    FROM chat_rooms
    WHERE project_id = NEW.id AND is_default = TRUE
    LIMIT 1;

    IF default_room_id IS NOT NULL AND NEW.team_member_ids IS NOT NULL THEN
        -- 새 팀 멤버들을 기본 채팅방에 추가 (이미 있으면 무시)
        FOREACH member_id IN ARRAY NEW.team_member_ids
        LOOP
            INSERT INTO chat_room_members (room_id, user_id)
            VALUES (default_room_id, member_id)
            ON CONFLICT (room_id, user_id) DO NOTHING;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_default_room_members ON projects;
CREATE TRIGGER trigger_sync_default_room_members
    AFTER INSERT OR UPDATE OF team_member_ids ON projects
    FOR EACH ROW
    EXECUTE FUNCTION sync_default_room_members();

-- =====================================================
-- 9. TRIGGER: updated_at 자동 갱신
-- =====================================================
CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON chat_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. ENABLE REALTIME for chat_messages (if not already)
-- Supabase Dashboard에서 수동으로 활성화해도 됨
-- =====================================================
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_room_members;
-- 위 명령은 Supabase Dashboard > Realtime 설정에서 활성화 권장
