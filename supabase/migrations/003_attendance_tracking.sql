-- =====================================================
-- ATTENDANCE TRACKING MIGRATION
-- 근태관리 테이블 (GPS 좌표 포함)
-- Version: 2026.02.08
-- =====================================================

-- =====================================================
-- 1. ATTENDANCE RECORDS TABLE (출퇴근 기록)
-- =====================================================
CREATE TABLE IF NOT EXISTS nexus_attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 출근 정보
    check_in_at TIMESTAMPTZ,
    check_in_type TEXT CHECK (check_in_type IN ('office', 'remote', 'overseas', 'filming', 'field')),
    check_in_latitude DECIMAL(10, 8),
    check_in_longitude DECIMAL(11, 8),
    check_in_address TEXT,
    check_in_note TEXT,
    
    -- 퇴근 정보
    check_out_at TIMESTAMPTZ,
    check_out_latitude DECIMAL(10, 8),
    check_out_longitude DECIMAL(11, 8),
    check_out_address TEXT,
    check_out_note TEXT,
    
    -- 근무 시간 계산 (분 단위)
    working_minutes INTEGER GENERATED ALWAYS AS (
        CASE 
            WHEN check_in_at IS NOT NULL AND check_out_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 60
            ELSE NULL 
        END
    ) STORED,
    
    -- 날짜 (조회 편의용)
    work_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- 상태
    status TEXT DEFAULT 'working' CHECK (status IN ('working', 'completed', 'early_leave', 'absent', 'holiday')),
    
    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 하루에 한 레코드만 (같은 날 중복 출근 방지)
    CONSTRAINT unique_user_work_date UNIQUE (user_id, work_date)
);

-- =====================================================
-- 2. ATTENDANCE TYPES 참조 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS nexus_attendance_types (
    id TEXT PRIMARY KEY,
    label_ko TEXT NOT NULL,
    label_en TEXT NOT NULL,
    requires_gps BOOLEAN DEFAULT false,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터 삽입
INSERT INTO nexus_attendance_types (id, label_ko, label_en, requires_gps, icon, color) VALUES
    ('office', '사무실 출근', 'Office', false, 'Building2', 'blue'),
    ('remote', '재택근무', 'Remote Work', true, 'Home', 'green'),
    ('overseas', '해외출장', 'Overseas Trip', true, 'Plane', 'purple'),
    ('filming', '촬영 현장', 'Filming', true, 'Film', 'orange'),
    ('field', '현장 방문', 'Field Work', true, 'MapPin', 'teal')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON nexus_attendance(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON nexus_attendance(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON nexus_attendance(status);

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE nexus_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_attendance_types ENABLE ROW LEVEL SECURITY;

-- 본인 기록만 조회/수정 가능
CREATE POLICY "Users can view own attendance"
    ON nexus_attendance FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attendance"
    ON nexus_attendance FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance"
    ON nexus_attendance FOR UPDATE
    USING (auth.uid() = user_id);

-- 관리자는 모든 기록 조회 가능
CREATE POLICY "Admins can view all attendance"
    ON nexus_attendance FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'ADMIN'
        )
    );

-- Attendance types는 모두 조회 가능
CREATE POLICY "Anyone can view attendance types"
    ON nexus_attendance_types FOR SELECT
    USING (true);

-- =====================================================
-- 5. TRIGGER FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_attendance_updated_at ON nexus_attendance;
CREATE TRIGGER trigger_attendance_updated_at
    BEFORE UPDATE ON nexus_attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_updated_at();

-- =====================================================
-- 6. HELPER FUNCTION: 오늘 출근 여부 확인
-- =====================================================
CREATE OR REPLACE FUNCTION get_today_attendance(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    check_in_at TIMESTAMPTZ,
    check_in_type TEXT,
    check_out_at TIMESTAMPTZ,
    status TEXT,
    working_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.check_in_at,
        a.check_in_type,
        a.check_out_at,
        a.status,
        a.working_minutes
    FROM nexus_attendance a
    WHERE a.user_id = p_user_id
    AND a.work_date = CURRENT_DATE
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. MONTHLY SUMMARY VIEW
-- =====================================================
CREATE OR REPLACE VIEW attendance_monthly_summary AS
SELECT 
    user_id,
    DATE_TRUNC('month', work_date) AS month,
    COUNT(*) FILTER (WHERE status = 'completed') AS days_worked,
    COUNT(*) FILTER (WHERE check_in_type = 'remote') AS remote_days,
    COUNT(*) FILTER (WHERE check_in_type = 'overseas') AS overseas_days,
    COUNT(*) FILTER (WHERE check_in_type = 'filming') AS filming_days,
    SUM(working_minutes) AS total_minutes,
    ROUND(AVG(working_minutes)) AS avg_minutes_per_day
FROM nexus_attendance
WHERE status IN ('completed', 'early_leave')
GROUP BY user_id, DATE_TRUNC('month', work_date);

COMMENT ON TABLE nexus_attendance IS '근태 기록 테이블 - GPS 좌표 포함';
COMMENT ON COLUMN nexus_attendance.check_in_type IS '출근 유형: office(사무실), remote(재택), overseas(해외출장), filming(촬영), field(현장)';
