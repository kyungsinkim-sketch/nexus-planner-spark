-- Migration 050: Budget system tables for Google Sheets bidirectional sync
-- Stores per-project budget data synced from/to Google Sheets (총액지출내역서).
-- Uses IF NOT EXISTS for idempotent re-runs.

-- ─── Project ↔ Spreadsheet Link ─────────────────────

CREATE TABLE IF NOT EXISTS project_budget_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    spreadsheet_id TEXT NOT NULL,
    spreadsheet_url TEXT NOT NULL,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK (sync_status IN ('CONNECTED', 'SYNCING', 'ERROR', 'DISCONNECTED')),
    sync_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_link_project ON project_budget_links(project_id);

ALTER TABLE project_budget_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view budget links" ON project_budget_links;
CREATE POLICY "Authenticated users can view budget links" ON project_budget_links
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage budget links" ON project_budget_links;
CREATE POLICY "Authenticated users can manage budget links" ON project_budget_links
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Budget Summary (개요요약) ──────────────────────

CREATE TABLE IF NOT EXISTS budget_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_name TEXT,
    contract_name TEXT,
    department TEXT,
    author TEXT,
    shooting_date TEXT,
    phase TEXT,
    total_contract_amount NUMERIC DEFAULT 0,
    vat_amount NUMERIC DEFAULT 0,
    total_with_vat NUMERIC DEFAULT 0,
    target_expense_with_vat NUMERIC DEFAULT 0,
    target_profit_with_vat NUMERIC DEFAULT 0,
    actual_expense_with_vat NUMERIC DEFAULT 0,
    actual_profit_with_vat NUMERIC DEFAULT 0,
    actual_expense_without_vat NUMERIC DEFAULT 0,
    actual_profit_without_vat NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_summary_project ON budget_summaries(project_id);
ALTER TABLE budget_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view budget summaries" ON budget_summaries;
CREATE POLICY "Authenticated users can view budget summaries" ON budget_summaries
    FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can manage budget summaries" ON budget_summaries;
CREATE POLICY "Authenticated users can manage budget summaries" ON budget_summaries
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Payment Schedule (입금일정, part of 개요요약) ──

CREATE TABLE IF NOT EXISTS budget_payment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    row_index INT NOT NULL DEFAULT 0,
    installment TEXT,
    expected_amount NUMERIC DEFAULT 0,
    expected_date TEXT,
    actual_amount NUMERIC DEFAULT 0,
    balance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE budget_payment_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view payment schedules" ON budget_payment_schedules;
CREATE POLICY "Authenticated users can view payment schedules" ON budget_payment_schedules
    FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can manage payment schedules" ON budget_payment_schedules;
CREATE POLICY "Authenticated users can manage payment schedules" ON budget_payment_schedules
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Budget Line Items (예산안) ─────────────────────

CREATE TABLE IF NOT EXISTS budget_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    row_index INT NOT NULL DEFAULT 0,
    order_no INT,
    completed BOOLEAN DEFAULT FALSE,
    category TEXT,            -- 구분 (스텝 인건비/장비, 제작비, 출연료, etc.)
    main_category TEXT,       -- 대분류 (촬영, 조명, 미술, etc.)
    sub_category TEXT,        -- 소분류 (촬영감독, 헌팅차지, etc.)
    target_unit_price NUMERIC DEFAULT 0,
    quantity NUMERIC DEFAULT 0,
    target_expense NUMERIC DEFAULT 0,
    vat_rate NUMERIC DEFAULT 0.1,
    target_expense_with_vat NUMERIC DEFAULT 0,
    actual_expense_with_vat NUMERIC DEFAULT 0,
    payment_timing TEXT,      -- 지급시기
    payment_method TEXT,      -- 카드/원천/세금
    note TEXT,
    variance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view budget line items" ON budget_line_items;
CREATE POLICY "Authenticated users can view budget line items" ON budget_line_items
    FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can manage budget line items" ON budget_line_items;
CREATE POLICY "Authenticated users can manage budget line items" ON budget_line_items
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Tax Invoices (세금계산서) ──────────────────────

CREATE TABLE IF NOT EXISTS budget_tax_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    row_index INT NOT NULL DEFAULT 0,
    order_no INT,
    payment_due_date TEXT,    -- 입금약일
    description TEXT,         -- 내용
    supply_amount NUMERIC DEFAULT 0,   -- 공급가 (세전)
    tax_amount NUMERIC DEFAULT 0,      -- 세액
    total_amount NUMERIC DEFAULT 0,    -- 총액 (VAT 포함)
    company_name TEXT,        -- 회사명 / 대표자
    business_number TEXT,     -- 사업자번호
    bank TEXT,                -- 은행
    account_number TEXT,      -- 계좌번호
    status TEXT,              -- 진행단계
    issue_date TEXT,          -- 발행일자
    payment_date TEXT,        -- 입금일자
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE budget_tax_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view tax invoices" ON budget_tax_invoices;
CREATE POLICY "Authenticated users can view tax invoices" ON budget_tax_invoices
    FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can manage tax invoices" ON budget_tax_invoices;
CREATE POLICY "Authenticated users can manage tax invoices" ON budget_tax_invoices
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Withholding Payments (원천징수/용역) ───────────
-- NOTE: 주민등록번호(PII)는 의도적으로 제외

CREATE TABLE IF NOT EXISTS budget_withholding_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    row_index INT NOT NULL DEFAULT 0,
    order_no INT,
    payment_due_date TEXT,    -- 입금요청일자
    person_name TEXT,         -- 이름
    role TEXT,                -- 역할
    gross_amount NUMERIC DEFAULT 0,    -- 세전금액
    net_amount NUMERIC DEFAULT 0,      -- 세후금액
    bank_name TEXT,           -- 입금은행
    bank_account TEXT,        -- 계좌번호
    status TEXT,              -- 비고 (입금완료 등)
    payment_confirmed_date TEXT, -- 입금여부 / 날짜
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE budget_withholding_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view withholding payments" ON budget_withholding_payments;
CREATE POLICY "Authenticated users can view withholding payments" ON budget_withholding_payments
    FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can manage withholding payments" ON budget_withholding_payments;
CREATE POLICY "Authenticated users can manage withholding payments" ON budget_withholding_payments
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Corporate Card Expenses (법인카드) ─────────────

CREATE TABLE IF NOT EXISTS budget_corporate_card_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    row_index INT NOT NULL DEFAULT 0,
    order_no INT,
    card_holder TEXT,         -- 사용법인카드
    receipt_submitted BOOLEAN DEFAULT FALSE,
    usage_date TEXT,          -- 사용날짜
    description TEXT,         -- 사용내용
    used_by TEXT,             -- 사용자
    amount_with_vat NUMERIC DEFAULT 0,
    vendor TEXT,              -- 거래처명
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE budget_corporate_card_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view card expenses" ON budget_corporate_card_expenses;
CREATE POLICY "Authenticated users can view card expenses" ON budget_corporate_card_expenses
    FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can manage card expenses" ON budget_corporate_card_expenses;
CREATE POLICY "Authenticated users can manage card expenses" ON budget_corporate_card_expenses
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Corporate Cash Expenses (법인현금) ─────────────

CREATE TABLE IF NOT EXISTS budget_corporate_cash_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    row_index INT NOT NULL DEFAULT 0,
    order_no INT,
    receipt_submitted BOOLEAN DEFAULT FALSE,
    usage_date TEXT,
    description TEXT,
    used_by TEXT,
    amount_with_vat NUMERIC DEFAULT 0,
    vendor TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE budget_corporate_cash_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view cash expenses" ON budget_corporate_cash_expenses;
CREATE POLICY "Authenticated users can view cash expenses" ON budget_corporate_cash_expenses
    FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can manage cash expenses" ON budget_corporate_cash_expenses;
CREATE POLICY "Authenticated users can manage cash expenses" ON budget_corporate_cash_expenses
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── Personal Expenses (개인지출) ───────────────────

CREATE TABLE IF NOT EXISTS budget_personal_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    row_index INT NOT NULL DEFAULT 0,
    order_no INT,
    payment_method TEXT,      -- 지출방식
    receipt_submitted BOOLEAN DEFAULT FALSE,
    reimbursement_status TEXT, -- 지출자지급단계
    usage_date TEXT,
    description TEXT,
    used_by TEXT,
    amount_with_vat NUMERIC DEFAULT 0,
    vendor TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE budget_personal_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view personal expenses" ON budget_personal_expenses;
CREATE POLICY "Authenticated users can view personal expenses" ON budget_personal_expenses
    FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can manage personal expenses" ON budget_personal_expenses;
CREATE POLICY "Authenticated users can manage personal expenses" ON budget_personal_expenses
    FOR ALL USING (auth.uid() IS NOT NULL);

-- ─── updated_at Triggers ────────────────────────────

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_links_updated_at') THEN
        CREATE TRIGGER update_budget_links_updated_at BEFORE UPDATE ON project_budget_links
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_summaries_updated_at') THEN
        CREATE TRIGGER update_budget_summaries_updated_at BEFORE UPDATE ON budget_summaries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_payment_schedules_updated_at') THEN
        CREATE TRIGGER update_budget_payment_schedules_updated_at BEFORE UPDATE ON budget_payment_schedules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_line_items_updated_at') THEN
        CREATE TRIGGER update_budget_line_items_updated_at BEFORE UPDATE ON budget_line_items
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_tax_invoices_updated_at') THEN
        CREATE TRIGGER update_budget_tax_invoices_updated_at BEFORE UPDATE ON budget_tax_invoices
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_withholding_updated_at') THEN
        CREATE TRIGGER update_budget_withholding_updated_at BEFORE UPDATE ON budget_withholding_payments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_card_expenses_updated_at') THEN
        CREATE TRIGGER update_budget_card_expenses_updated_at BEFORE UPDATE ON budget_corporate_card_expenses
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_cash_expenses_updated_at') THEN
        CREATE TRIGGER update_budget_cash_expenses_updated_at BEFORE UPDATE ON budget_corporate_cash_expenses
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_personal_expenses_updated_at') THEN
        CREATE TRIGGER update_budget_personal_expenses_updated_at BEFORE UPDATE ON budget_personal_expenses
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
