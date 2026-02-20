/**
 * sheets-sync — Bidirectional sync between Google Sheets (총액지출내역서) and Re-Be DB.
 *
 * Supports:
 *   - 'pull': Read from Google Sheets → parse → upsert to DB
 *   - 'push': Read from DB → write to Google Sheets
 *   - 'both': Pull then Push (default)
 *   - 'link': Initial link — validate spreadsheet, pull data, create link record
 *
 * Request body: {
 *   userId: string,
 *   projectId: string,
 *   spreadsheetId?: string,   // required for 'link'
 *   spreadsheetUrl?: string,  // required for 'link'
 *   direction?: 'pull' | 'push' | 'both' | 'link'
 * }
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ensureValidToken } from '../_shared/gcal-client.ts';
import type { GoogleTokenRow } from '../_shared/gcal-client.ts';
import {
  getSpreadsheetInfo,
  readAllSheets,
  type SheetData,
} from '../_shared/sheets-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Sheet Name Matching ────────────────────────────
// The sheet names may vary slightly between templates.
// Match by partial/contains logic.

function findSheet(sheets: SheetData[], ...keywords: string[]): SheetData | undefined {
  return sheets.find(s => keywords.some(kw => s.sheetName.includes(kw)));
}

// ─── Parsers ────────────────────────────────────────

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = toStr(v).toLowerCase();
  return s === 'true' || s === '완료' || s === 'o' || s === '1';
}

/**
 * Parse 개요요약 sheet → BudgetSummary + PaymentSchedule[]
 * Searches all columns for labels (not just B→D) and uses space-normalized matching.
 */
function parseOverviewSheet(values: (string | number | boolean | null)[][]) {
  // Flexible cell search: find label in any column, return first non-empty cell to the right
  const getVal = (label: string): string | number | null => {
    const norm = label.replace(/\s/g, '');
    for (const row of values) {
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        if (toStr(row[c]).replace(/\s/g, '').includes(norm)) {
          // Return the first non-empty value to the right of the label
          for (let v = c + 1; v < row.length; v++) {
            if (row[v] !== null && row[v] !== undefined && row[v] !== '') return row[v];
          }
          return null;
        }
      }
    }
    return null;
  };

  const summary = {
    company_name: toStr(getVal('업체명')),
    contract_name: toStr(getVal('계약명')),
    department: toStr(getVal('담당부서')),
    author: toStr(getVal('작성자')),
    shooting_date: toStr(getVal('촬영예정일')),
    phase: toStr(getVal('진행단계')),
    total_contract_amount: toNum(getVal('총계약금액') || getVal('총 계약금액')),
    vat_amount: toNum(getVal('부가세')),
    total_with_vat: toNum(getVal('총공급가액') || getVal('총 공급가액')),
    target_expense_with_vat: toNum(getVal('목표지출비용') || getVal('목표지출비용(VAT포함)')),
    target_profit_with_vat: toNum(getVal('목표수익') || getVal('목표수익(내부+마크업)(VAT포함)')),
    actual_expense_with_vat: toNum(getVal('실제지출') || getVal('실제지출(내부+마크업)(VAT포함)')),
    actual_profit_with_vat: toNum(getVal('실제수익') || getVal('실제수익(내부+마크업)(VAT포함)')),
    actual_expense_without_vat: toNum(getVal('실제지출(VAT미포함)') || 0),
    actual_profit_without_vat: toNum(getVal('실제수익(내부+마크업)(VAT미포함)') || 0),
  };

  // Log warning if total_contract_amount is still 0
  if (summary.total_contract_amount === 0) {
    console.warn('[sheets-sync] parseOverview: total_contract_amount is 0. First 15 rows:',
      JSON.stringify(values.slice(0, 15).map(r => r?.slice(0, 8))));
  }

  // Parse payment schedule — look for 입금/계약금/결제 section
  const paymentSchedules: Record<string, unknown>[] = [];
  let inPaymentSection = false;
  let paymentIdx = 0;

  for (const row of values) {
    if (!row) continue;
    // Check all cells in row for payment section start
    const rowText = row.map(c => toStr(c)).join(' ');

    if (!inPaymentSection) {
      if (/입금|계약금|결제/.test(rowText) && /일정|스케줄|현황/.test(rowText)) {
        inPaymentSection = true;
        continue;
      }
      // Also match simpler patterns like just "입금" in B column
      const bVal = toStr(row[1]);
      if (bVal.includes('입금')) {
        inPaymentSection = true;
        continue;
      }
    }

    if (inPaymentSection) {
      const cVal = toStr(row[2]);
      if (!cVal) continue;
      if (/합계|총계/.test(cVal)) break; // stop at totals
      // Match installment rows: 1차, 2차, 선금, 중도금, 잔금, etc.
      if (/차|선금|중도금|잔금/.test(cVal)) {
        paymentSchedules.push({
          row_index: paymentIdx++,
          installment: cVal,
          expected_amount: toNum(row[3]),  // D
          expected_date: toStr(row[4]),    // E
          actual_amount: toNum(row[5]),    // F
          balance: toNum(row[6]),          // G
        });
      }
    }
  }

  return { summary, paymentSchedules };
}

/**
 * Parse 예산안 sheet → BudgetLineItem[]
 * Headers at row 13 (0-indexed: row 12), data from row 14+.
 * Columns: A=NO., B=완료, C=구분, D=대분류, E=소분류, F=목표단가, G=회/식/수,
 *          H=목표지출액, I=부가세, J=목표지출합계, K=실지출액, L=지급시기,
 *          M=카드/원천/세금, N=계획대비차액
 */
function parseBudgetPlanSheet(values: (string | number | boolean | null)[][]) {
  // Find header row (contains 'NO.' and '소분류')
  let headerIdx = -1;
  for (let i = 0; i < Math.min(values.length, 20); i++) {
    const row = values[i];
    if (row && toStr(row[0]).includes('NO') && row.some(c => toStr(c).includes('소분류'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const items: Record<string, unknown>[] = [];
  let currentCategory = '';
  let currentMainCategory = '';
  let rowIdx = 0;

  for (let i = headerIdx + 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue;

    // Track merged category/main_category values
    const cat = toStr(row[2]);
    const mainCat = toStr(row[3]);
    const subCat = toStr(row[4]);

    if (cat) currentCategory = cat;
    if (mainCat) currentMainCategory = mainCat;

    // Skip rows that only have category headers (no sub_category and no amounts)
    if (!subCat && !toNum(row[5]) && !toNum(row[7]) && !toNum(row[10])) continue;

    items.push({
      row_index: rowIdx++,
      order_no: toNum(row[0]) || null,
      completed: toBool(row[1]),
      category: currentCategory,
      main_category: currentMainCategory,
      sub_category: subCat,
      target_unit_price: toNum(row[5]),
      quantity: toNum(row[6]),
      target_expense: toNum(row[7]),
      vat_rate: toNum(row[8]),
      target_expense_with_vat: toNum(row[9]),
      actual_expense_with_vat: toNum(row[10]),
      payment_timing: toStr(row[11]),
      payment_method: toStr(row[12]),
      variance: toNum(row[13]),
    });
  }

  return items;
}

/**
 * Parse expense sheet (세금계산서, 원천징수, 개인지출, 법인카드, 법인현금)
 * Generic parser — uses column mapping per sheet type.
 * Headers at row 3 (0-indexed: row 2), data from row 4+.
 */
function parseTaxInvoices(values: (string | number | boolean | null)[][]) {
  // Header row at index 2 (row 3), data from index 3 (row 4)
  const dataStart = findDataStart(values, '목차');
  const items: Record<string, unknown>[] = [];
  let rowIdx = 0;

  for (let i = dataStart; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue;
    // Skip if no meaningful data (at least description or amount)
    if (!toStr(row[3]) && !toNum(row[4])) continue;

    items.push({
      row_index: rowIdx++,
      order_no: toNum(row[1]) || null,     // B: 목차
      payment_due_date: toStr(row[2]),       // C: 입금약일
      description: toStr(row[3]),            // D: 내용
      supply_amount: toNum(row[4]),          // E: 공급가(세전)
      tax_amount: toNum(row[5]),             // F: 세액
      total_amount: toNum(row[6]),           // G: 총액(VAT포함)
      company_name: toStr(row[7]),           // H: 회사명/대표자
      business_number: toStr(row[8]),        // I: 사업자번호
      bank: toStr(row[9]),                   // J: 은행
      account_number: toStr(row[10]),        // K: 계좌번호
      status: toStr(row[11]),                // L: 진행단계
      issue_date: toStr(row[12]),            // M: 발행일자
      payment_date: toStr(row[13]),          // N: 입금일자
      note: toStr(row[14]),                  // O: 비고
    });
  }
  return items;
}

function parseWithholdingPayments(values: (string | number | boolean | null)[][]) {
  const dataStart = findDataStart(values, '입금요청일자');
  const items: Record<string, unknown>[] = [];
  let rowIdx = 0;

  for (let i = dataStart; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue;
    if (!toStr(row[2]) && !toNum(row[7])) continue; // need name or amount

    // Skip total/subtotal rows (합계, 소계, 총계)
    const personName = toStr(row[2]);
    if (/합계|소계|총계|합\s*계/.test(personName)) continue;
    // Skip total row with empty name but has amount (합계 row without label)
    if (!personName && toNum(row[7]) > 0 && !toStr(row[3])) continue;

    items.push({
      row_index: rowIdx++,
      payment_due_date: toStr(row[1]),       // B: 입금요청일자
      person_name: personName,               // C: 이름
      role: toStr(row[3]),                   // D: 역할
      // E: 주민등록번호 — SKIP (PII)
      bank_account: toStr(row[5]),           // F: 계좌번호
      bank_name: toStr(row[6]),              // G: 입금은행
      gross_amount: toNum(row[7]),           // H: 세전금액
      net_amount: toNum(row[8]),             // I: 세후금액
      status: toStr(row[9]),                 // J: 비고 (입금완료 등)
      payment_confirmed_date: toStr(row[10]), // K: 입금여부/날짜
      note: toStr(row[11]),                  // L: 비고
    });
  }
  return items;
}

function parsePersonalExpenses(values: (string | number | boolean | null)[][]) {
  const dataStart = findDataStart(values, '목차');
  const items: Record<string, unknown>[] = [];
  let rowIdx = 0;

  for (let i = dataStart; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue;
    if (!toStr(row[6]) && !toNum(row[8])) continue; // need content or amount

    items.push({
      row_index: rowIdx++,
      order_no: toNum(row[1]) || null,
      payment_method: toStr(row[2]),          // C: 지출방식
      receipt_submitted: toStr(row[3]).includes('제출'),
      reimbursement_status: toStr(row[4]),    // E: 지출자지급단계
      usage_date: toStr(row[5]),              // F: 사용날짜
      description: toStr(row[6]),             // G: 사용내용
      used_by: toStr(row[7]),                 // H: 사용자
      amount_with_vat: toNum(row[8]),         // I: 사용액(VAT포함)
      vendor: toStr(row[9]),                  // J: 거래처명
      note: toStr(row[10]),                   // K: 비고
    });
  }
  return items;
}

function parseCorporateCardExpenses(values: (string | number | boolean | null)[][]) {
  const dataStart = findDataStart(values, '목차');
  const items: Record<string, unknown>[] = [];
  let rowIdx = 0;

  for (let i = dataStart; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue;
    if (!toStr(row[5]) && !toNum(row[7])) continue;

    const desc = toStr(row[5]);
    const usedBy = toStr(row[6]);
    const hasAmount = toNum(row[7]) > 0;
    // Skip total/subtotal rows (합계, 소계, 총계) in any field
    if (/합계|소계|총계/.test(desc) || /합계|소계|총계/.test(usedBy)) continue;
    // Skip category subtotal rows: have amount but no order_no AND no usage_date
    // These are rows like "식대", "교통", "비품", "장비" totals
    if (hasAmount && !toNum(row[1]) && !toStr(row[4])) continue;

    items.push({
      row_index: rowIdx++,
      order_no: toNum(row[1]) || null,
      card_holder: toStr(row[2]),             // C: 사용법인카드
      receipt_submitted: toStr(row[3]).includes('제출'),
      usage_date: toStr(row[4]),              // E: 사용날짜
      description: desc,                     // F: 사용내용
      used_by: toStr(row[6]),                 // G: 사용자
      amount_with_vat: toNum(row[7]),         // H: 사용액(VAT포함)
      vendor: toStr(row[8]),                  // I: 거래처명
      note: toStr(row[9]),                    // J: 비고
    });
  }
  return items;
}

function parseCorporateCashExpenses(values: (string | number | boolean | null)[][]) {
  const dataStart = findDataStart(values, '목차');
  const items: Record<string, unknown>[] = [];
  let rowIdx = 0;

  for (let i = dataStart; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue;
    if (!toStr(row[4]) && !toNum(row[6])) continue;

    items.push({
      row_index: rowIdx++,
      order_no: toNum(row[1]) || null,
      receipt_submitted: toStr(row[2]).includes('제출'),
      usage_date: toStr(row[3]),              // D: 사용날짜
      description: toStr(row[4]),             // E: 사용내용
      used_by: toStr(row[5]),                 // F: 사용자
      amount_with_vat: toNum(row[6]),         // G: 사용액(VAT포함)
      vendor: toStr(row[7]),                  // H: 거래처명
      note: toStr(row[8]),                    // I: 비고
    });
  }
  return items;
}

function findDataStart(values: (string | number | boolean | null)[][], headerKeyword: string): number {
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const row = values[i];
    if (row && row.some(c => toStr(c).includes(headerKeyword))) {
      return i + 1; // data starts after header
    }
  }
  return 3; // default: row 4 (0-indexed: 3)
}

// ─── DB Operations ──────────────────────────────────

// deno-lint-ignore no-explicit-any
async function upsertBudgetData(supabase: any, projectId: string, sheets: SheetData[]) {
  const errors: string[] = [];

  // 1. Parse 개요요약 (or 개요/요약)
  const overviewSheet = findSheet(sheets, '개요요약', '개요/요약', '개요');
  if (overviewSheet) {
    const { summary, paymentSchedules } = parseOverviewSheet(overviewSheet.values);

    // Upsert summary
    const { error: sumErr } = await supabase
      .from('budget_summaries')
      .upsert({ project_id: projectId, ...summary }, { onConflict: 'project_id' });
    if (sumErr) errors.push(`summary: ${sumErr.message}`);

    // Replace payment schedules
    await supabase.from('budget_payment_schedules').delete().eq('project_id', projectId);
    if (paymentSchedules.length > 0) {
      const { error: psErr } = await supabase
        .from('budget_payment_schedules')
        .insert(paymentSchedules.map(ps => ({ project_id: projectId, ...ps })));
      if (psErr) errors.push(`payment_schedules: ${psErr.message}`);
    }
  }

  // 2. Parse 예산안
  const budgetSheet = findSheet(sheets, '예산안');
  if (budgetSheet) {
    const lineItems = parseBudgetPlanSheet(budgetSheet.values);
    await supabase.from('budget_line_items').delete().eq('project_id', projectId);
    if (lineItems.length > 0) {
      const { error: liErr } = await supabase
        .from('budget_line_items')
        .insert(lineItems.map(li => ({ project_id: projectId, ...li })));
      if (liErr) errors.push(`line_items: ${liErr.message}`);
    }
  }

  // 3. Parse 세금계산서
  const taxSheet = findSheet(sheets, '세금계산서');
  if (taxSheet) {
    const invoices = parseTaxInvoices(taxSheet.values);
    await supabase.from('budget_tax_invoices').delete().eq('project_id', projectId);
    if (invoices.length > 0) {
      const { error: tiErr } = await supabase
        .from('budget_tax_invoices')
        .insert(invoices.map(inv => ({ project_id: projectId, ...inv })));
      if (tiErr) errors.push(`tax_invoices: ${tiErr.message}`);
    }
  }

  // 4. Parse 원천징수
  const whSheet = findSheet(sheets, '원천징수');
  if (whSheet) {
    const payments = parseWithholdingPayments(whSheet.values);
    await supabase.from('budget_withholding_payments').delete().eq('project_id', projectId);
    if (payments.length > 0) {
      const { error: whErr } = await supabase
        .from('budget_withholding_payments')
        .insert(payments.map(p => ({ project_id: projectId, ...p })));
      if (whErr) errors.push(`withholding: ${whErr.message}`);
    }
  }

  // 5. Parse 개인지출
  const peSheet = findSheet(sheets, '개인지출');
  if (peSheet) {
    const expenses = parsePersonalExpenses(peSheet.values);
    await supabase.from('budget_personal_expenses').delete().eq('project_id', projectId);
    if (expenses.length > 0) {
      const { error: peErr } = await supabase
        .from('budget_personal_expenses')
        .insert(expenses.map(e => ({ project_id: projectId, ...e })));
      if (peErr) errors.push(`personal_expenses: ${peErr.message}`);
    }
  }

  // 6. Parse 법인카드
  const ccSheet = findSheet(sheets, '법인카드');
  if (ccSheet) {
    const expenses = parseCorporateCardExpenses(ccSheet.values);
    await supabase.from('budget_corporate_card_expenses').delete().eq('project_id', projectId);
    if (expenses.length > 0) {
      const { error: ccErr } = await supabase
        .from('budget_corporate_card_expenses')
        .insert(expenses.map(e => ({ project_id: projectId, ...e })));
      if (ccErr) errors.push(`card_expenses: ${ccErr.message}`);
    }
  }

  // 7. Parse 법인현금
  const cashSheet = findSheet(sheets, '법인현금');
  if (cashSheet) {
    const expenses = parseCorporateCashExpenses(cashSheet.values);
    await supabase.from('budget_corporate_cash_expenses').delete().eq('project_id', projectId);
    if (expenses.length > 0) {
      const { error: ceErr } = await supabase
        .from('budget_corporate_cash_expenses')
        .insert(expenses.map(e => ({ project_id: projectId, ...e })));
      if (ceErr) errors.push(`cash_expenses: ${ceErr.message}`);
    }
  }

  return errors;
}

// ─── Main Handler ────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, projectId, spreadsheetId: inputSpreadsheetId, spreadsheetUrl, direction = 'pull' } = await req.json() as {
      userId: string;
      projectId: string;
      spreadsheetId?: string;
      spreadsheetUrl?: string;
      direction?: 'pull' | 'push' | 'both' | 'link';
    };

    if (!userId || !projectId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, projectId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 1. Load token ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: tokenRow, error: tokenError } = await supabase
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: 'Google account not connected.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const scope = (tokenRow as GoogleTokenRow).scope || '';
    if (!scope.includes('spreadsheets')) {
      // Return 200 with error field so supabase.functions.invoke() passes data to caller
      return new Response(
        JSON.stringify({ error: 'SHEETS_SCOPE_MISSING' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const accessToken = await ensureValidToken(supabase, tokenRow as GoogleTokenRow);

    // ── 2. Determine spreadsheet ID ──
    let spreadsheetId = inputSpreadsheetId;

    if (!spreadsheetId && direction !== 'link') {
      // Load from existing link
      const { data: link } = await supabase
        .from('project_budget_links')
        .select('spreadsheet_id')
        .eq('project_id', projectId)
        .single();

      if (!link?.spreadsheet_id) {
        return new Response(
          JSON.stringify({ error: 'No spreadsheet linked to this project.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      spreadsheetId = link.spreadsheet_id;
    }

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ error: 'spreadsheetId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 3. Handle 'link' — initial connection ──
    if (direction === 'link') {
      // Validate spreadsheet access
      const info = await getSpreadsheetInfo(accessToken, spreadsheetId);

      // Create/update link record
      await supabase
        .from('project_budget_links')
        .upsert({
          project_id: projectId,
          spreadsheet_id: spreadsheetId,
          spreadsheet_url: spreadsheetUrl || info.spreadsheetUrl,
          sync_status: 'SYNCING',
        }, { onConflict: 'project_id' });

      // Pull data
      const sheets = await readAllSheets(accessToken, spreadsheetId);
      const errors = await upsertBudgetData(supabase, projectId, sheets);

      // Update link status
      await supabase
        .from('project_budget_links')
        .update({
          sync_status: errors.length > 0 ? 'ERROR' : 'CONNECTED',
          sync_error: errors.length > 0 ? errors.join('; ') : null,
          last_sync_at: new Date().toISOString(),
        })
        .eq('project_id', projectId);

      return new Response(
        JSON.stringify({
          success: true,
          title: info.title,
          sheetCount: info.sheets.length,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── 4. Handle 'pull' ──
    if (direction === 'pull' || direction === 'both') {
      await supabase
        .from('project_budget_links')
        .update({ sync_status: 'SYNCING' })
        .eq('project_id', projectId);

      const sheets = await readAllSheets(accessToken, spreadsheetId);
      const errors = await upsertBudgetData(supabase, projectId, sheets);

      await supabase
        .from('project_budget_links')
        .update({
          sync_status: errors.length > 0 ? 'ERROR' : 'CONNECTED',
          sync_error: errors.length > 0 ? errors.join('; ') : null,
          last_sync_at: new Date().toISOString(),
        })
        .eq('project_id', projectId);

      if (direction === 'pull') {
        return new Response(
          JSON.stringify({ success: true, direction: 'pull', errors: errors.length > 0 ? errors : undefined }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // ── 5. Handle 'push' (DB → Sheets) ──
    // For now, push is a placeholder — the primary flow is Sheets → DB.
    // Full push implementation can be added in Phase B.
    if (direction === 'push' || direction === 'both') {
      // TODO: Implement DB → Sheets push in Phase B
      return new Response(
        JSON.stringify({ success: true, direction, note: 'Push sync not yet implemented. Pull completed successfully.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('[sheets-sync] Error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
