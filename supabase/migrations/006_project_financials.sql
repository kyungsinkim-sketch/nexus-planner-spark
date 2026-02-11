-- =====================================================
-- PROJECT FINANCIALS MIGRATION
-- 프로젝트별 재무 + 연간 손익 테이블
-- Version: 2026.02.11
-- =====================================================

-- =====================================================
-- 1. PROJECT FINANCIALS TABLE (프로젝트별 재무)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_financials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_amount NUMERIC NOT NULL DEFAULT 0,
    expenses NUMERIC NOT NULL DEFAULT 0,
    profit NUMERIC GENERATED ALWAYS AS (contract_amount - expenses) STORED,
    profit_rate NUMERIC GENERATED ALWAYS AS (
        CASE WHEN contract_amount > 0
        THEN ROUND(((contract_amount - expenses) / contract_amount) * 100, 1)
        ELSE 0 END
    ) STORED,
    vat_amount NUMERIC GENERATED ALWAYS AS (ROUND(contract_amount * 0.1, 0)) STORED,
    net_revenue NUMERIC GENERATED ALWAYS AS (ROUND(contract_amount / 1.1, 0)) STORED,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID'
        CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE')),
    payment_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- 프로젝트당 하나의 재무 레코드
    CONSTRAINT unique_project_financial UNIQUE (project_id)
);

COMMENT ON TABLE project_financials IS '프로젝트별 재무 정보. 수주액, 비용, 이익률, VAT 자동 계산';

-- =====================================================
-- 2. ANNUAL FINANCIALS TABLE (연간 손익)
-- =====================================================
CREATE TABLE IF NOT EXISTS annual_financials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fiscal_year INTEGER NOT NULL,
    total_revenue NUMERIC NOT NULL DEFAULT 0,
    total_expenses NUMERIC NOT NULL DEFAULT 0,
    overhead NUMERIC NOT NULL DEFAULT 0,
    payroll NUMERIC NOT NULL DEFAULT 0,
    production_cost NUMERIC NOT NULL DEFAULT 0,
    net_profit NUMERIC GENERATED ALWAYS AS (total_revenue - total_expenses) STORED,
    profit_rate NUMERIC GENERATED ALWAYS AS (
        CASE WHEN total_revenue > 0
        THEN ROUND(((total_revenue - total_expenses) / total_revenue) * 100, 1)
        ELSE 0 END
    ) STORED,
    quarterly_breakdown JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- 연도당 하나의 레코드
    CONSTRAINT unique_fiscal_year UNIQUE (fiscal_year)
);

COMMENT ON TABLE annual_financials IS '연간 손익 요약. quarterly_breakdown은 분기별 상세 JSONB';

-- =====================================================
-- 3. INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_project_financials_project ON project_financials(project_id);
CREATE INDEX IF NOT EXISTS idx_project_financials_status ON project_financials(payment_status);
CREATE INDEX IF NOT EXISTS idx_annual_financials_year ON annual_financials(fiscal_year DESC);

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE project_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_financials ENABLE ROW LEVEL SECURITY;

-- 프로젝트 재무: 관리자만 조회/수정 가능
CREATE POLICY "Admins can view project financials"
    ON project_financials FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "Admins can insert project financials"
    ON project_financials FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "Admins can update project financials"
    ON project_financials FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- PM도 자기 프로젝트 재무 조회 가능
CREATE POLICY "PMs can view own project financials"
    ON project_financials FOR SELECT
    USING (
        project_id IN (
            SELECT id FROM projects WHERE pm_id = auth.uid()
        )
    );

-- 연간 재무: 관리자만 조회/수정 가능
CREATE POLICY "Admins can view annual financials"
    ON annual_financials FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "Admins can insert annual financials"
    ON annual_financials FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "Admins can update annual financials"
    ON annual_financials FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- =====================================================
-- 5. TRIGGERS: updated_at 자동 갱신
-- =====================================================
CREATE TRIGGER update_project_financials_updated_at BEFORE UPDATE ON project_financials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annual_financials_updated_at BEFORE UPDATE ON annual_financials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
