/**
 * Budget Service — CRUD operations for budget data via Supabase.
 *
 * Loads budget data from DB (synced from Google Sheets) and
 * saves edits back to DB for later push to Sheets.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  ProjectBudget,
  BudgetSummary,
  PaymentSchedule,
  BudgetLineItem,
  TaxInvoice,
  WithholdingPayment,
  CorporateCardExpense,
  CorporateCashExpense,
  PersonalExpense,
} from '@/types/budget';

// ─── Load Full Budget ───────────────────────────────

/**
 * Load the full ProjectBudget for a project from Supabase.
 * Returns null if no budget data exists in DB.
 */
export async function loadBudget(projectId: string): Promise<ProjectBudget | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    // Load all budget tables in parallel — use Promise.allSettled for partial failure resilience
    const results = await Promise.allSettled([
      supabase.from('budget_summaries').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('budget_payment_schedules').select('*').eq('project_id', projectId).order('row_index'),
      supabase.from('budget_line_items').select('*').eq('project_id', projectId).order('row_index'),
      supabase.from('budget_tax_invoices').select('*').eq('project_id', projectId).order('row_index'),
      supabase.from('budget_withholding_payments').select('*').eq('project_id', projectId).order('row_index'),
      supabase.from('budget_corporate_card_expenses').select('*').eq('project_id', projectId).order('row_index'),
      supabase.from('budget_corporate_cash_expenses').select('*').eq('project_id', projectId).order('row_index'),
      supabase.from('budget_personal_expenses').select('*').eq('project_id', projectId).order('row_index'),
    ]);

    // Extract data safely — failed queries return null/empty instead of crashing everything
    const extract = <T,>(r: PromiseSettledResult<{ data: T; error: unknown }>): T | null =>
      r.status === 'fulfilled' && !r.error ? r.value.data : null;
    const summaryData = extract(results[0] as PromiseSettledResult<{ data: unknown; error: unknown }>) as Record<string, unknown> | null;
    const scheduleData = (extract(results[1] as PromiseSettledResult<{ data: unknown; error: unknown }>) ?? []) as Record<string, unknown>[];
    const lineItemData = (extract(results[2] as PromiseSettledResult<{ data: unknown; error: unknown }>) ?? []) as Record<string, unknown>[];
    const taxData = (extract(results[3] as PromiseSettledResult<{ data: unknown; error: unknown }>) ?? []) as Record<string, unknown>[];
    const withholdingData = (extract(results[4] as PromiseSettledResult<{ data: unknown; error: unknown }>) ?? []) as Record<string, unknown>[];
    const cardData = (extract(results[5] as PromiseSettledResult<{ data: unknown; error: unknown }>) ?? []) as Record<string, unknown>[];
    const cashData = (extract(results[6] as PromiseSettledResult<{ data: unknown; error: unknown }>) ?? []) as Record<string, unknown>[];
    const personalData = (extract(results[7] as PromiseSettledResult<{ data: unknown; error: unknown }>) ?? []) as Record<string, unknown>[];

    // Check if any data exists at all
    const hasAnyData = summaryData ||
      (lineItemData && lineItemData.length > 0) ||
      (taxData && taxData.length > 0) ||
      (withholdingData && withholdingData.length > 0) ||
      (cardData && cardData.length > 0) ||
      (cashData && cashData.length > 0) ||
      (personalData && personalData.length > 0);

    if (!hasAnyData) return null;

    const summary: BudgetSummary = summaryData ? {
      id: summaryData.id,
      projectId,
      companyName: summaryData.company_name || '',
      contractName: summaryData.contract_name || '',
      department: summaryData.department || '',
      author: summaryData.author || '',
      shootingDate: summaryData.shooting_date || undefined,
      phase: summaryData.phase || '',
      totalContractAmount: Number(summaryData.total_contract_amount) || 0,
      vatAmount: Number(summaryData.vat_amount) || 0,
      totalWithVat: Number(summaryData.total_with_vat) || 0,
      targetExpenseWithVat: Number(summaryData.target_expense_with_vat) || 0,
      targetProfitWithVat: Number(summaryData.target_profit_with_vat) || 0,
      actualExpenseWithVat: Number(summaryData.actual_expense_with_vat) || 0,
      actualProfitWithVat: Number(summaryData.actual_profit_with_vat) || 0,
      actualExpenseWithoutVat: Number(summaryData.actual_expense_without_vat) || 0,
      actualProfitWithoutVat: Number(summaryData.actual_profit_without_vat) || 0,
    } : {
      id: '',
      projectId,
      companyName: '',
      contractName: '',
      department: '',
      author: '',
      phase: '',
      totalContractAmount: 0,
      vatAmount: 0,
      totalWithVat: 0,
      targetExpenseWithVat: 0,
      targetProfitWithVat: 0,
      actualExpenseWithVat: 0,
      actualProfitWithVat: 0,
      actualExpenseWithoutVat: 0,
      actualProfitWithoutVat: 0,
    };

    const paymentSchedules: PaymentSchedule[] = (scheduleData || []).map((ps: Record<string, unknown>) => ({
      id: ps.id as string,
      projectId,
      installment: (ps.installment as string) || '',
      expectedAmount: Number(ps.expected_amount) || 0,
      expectedDate: (ps.expected_date as string) || undefined,
      actualAmount: Number(ps.actual_amount) || 0,
      balance: Number(ps.balance) || 0,
    }));

    const lineItems: BudgetLineItem[] = (lineItemData || []).map((li: Record<string, unknown>) => {
      const targetExpense = Number(li.target_expense) || 0;
      const vatRate = Number(li.vat_rate) || 0;
      const rawTargetWithVat = Number(li.target_expense_with_vat) || 0;
      // 방어: DB에 target_expense_with_vat가 0이면 target_expense 기반으로 자동 보정
      const targetExpenseWithVat = rawTargetWithVat > 0
        ? rawTargetWithVat
        : vatRate > 0
          ? Math.round(targetExpense * (1 + vatRate))
          : targetExpense;

      return {
        id: li.id as string,
        projectId,
        orderNo: Number(li.order_no) || 0,
        completed: Boolean(li.completed),
        category: (li.category as string) || '' as BudgetLineItem['category'],
        mainCategory: (li.main_category as string) || '',
        subCategory: (li.sub_category as string) || '',
        targetUnitPrice: Number(li.target_unit_price) || 0,
        quantity: Number(li.quantity) || 0,
        targetExpense,
        vatRate,
        targetExpenseWithVat,
        actualExpenseWithVat: Number(li.actual_expense_with_vat) || 0,
        paymentMethod: (li.payment_method as string) || undefined,
        paymentTiming: (li.payment_timing as string) || undefined,
        note: (li.note as string) || undefined,
        variance: Number(li.variance) || 0,
      };
    });

    const taxInvoices: TaxInvoice[] = (taxData || []).map((inv: Record<string, unknown>) => ({
      id: inv.id as string,
      projectId,
      orderNo: Number(inv.order_no) || 0,
      paymentDueDate: (inv.payment_due_date as string) || undefined,
      description: (inv.description as string) || '',
      supplyAmount: Number(inv.supply_amount) || 0,
      taxAmount: Number(inv.tax_amount) || 0,
      totalAmount: Number(inv.total_amount) || 0,
      companyName: (inv.company_name as string) || '',
      businessNumber: (inv.business_number as string) || '',
      bank: (inv.bank as string) || undefined,
      accountNumber: (inv.account_number as string) || undefined,
      status: ((inv.status as string) || 'PENDING') as TaxInvoice['status'],
      issueDate: (inv.issue_date as string) || undefined,
      paymentDate: (inv.payment_date as string) || undefined,
      note: (inv.note as string) || undefined,
    }));

    const withholdingPayments: WithholdingPayment[] = (withholdingData || []).map((wp: Record<string, unknown>) => ({
      id: wp.id as string,
      projectId,
      orderNo: Number(wp.order_no) || 0,
      paymentDueDate: (wp.payment_due_date as string) || undefined,
      personName: (wp.person_name as string) || '',
      role: (wp.role as string) || '',
      amount: Number(wp.gross_amount) || 0,
      withholdingTax: (Number(wp.gross_amount) || 0) - (Number(wp.net_amount) || 0),
      totalAmount: Number(wp.net_amount) || 0,
      grossAmount: Number(wp.gross_amount) || 0,
      netAmount: Number(wp.net_amount) || 0,
      bankName: (wp.bank_name as string) || undefined,
      bankAccount: (wp.bank_account as string) || undefined,
      status: ((wp.status as string) || 'PENDING') as WithholdingPayment['status'],
      paymentConfirmedDate: (wp.payment_confirmed_date as string) || undefined,
      note: (wp.note as string) || undefined,
    }));

    const corporateCardExpenses: CorporateCardExpense[] = (cardData || []).map((cc: Record<string, unknown>) => ({
      id: cc.id as string,
      projectId,
      orderNo: Number(cc.order_no) || 0,
      cardHolder: (cc.card_holder as string) || '',
      receiptSubmitted: Boolean(cc.receipt_submitted),
      usageDate: (cc.usage_date as string) || '',
      description: (cc.description as string) || '',
      usedBy: (cc.used_by as string) || '',
      amountWithVat: Number(cc.amount_with_vat) || 0,
      vendor: (cc.vendor as string) || '',
      note: (cc.note as string) || undefined,
    }));

    const corporateCashExpenses: CorporateCashExpense[] = (cashData || []).map((ce: Record<string, unknown>) => ({
      id: ce.id as string,
      projectId,
      orderNo: Number(ce.order_no) || 0,
      receiptSubmitted: Boolean(ce.receipt_submitted),
      usageDate: (ce.usage_date as string) || '',
      description: (ce.description as string) || '',
      usedBy: (ce.used_by as string) || '',
      amountWithVat: Number(ce.amount_with_vat) || 0,
      vendor: (ce.vendor as string) || '',
      note: (ce.note as string) || undefined,
    }));

    const personalExpenses: PersonalExpense[] = (personalData || []).map((pe: Record<string, unknown>) => ({
      id: pe.id as string,
      projectId,
      orderNo: Number(pe.order_no) || 0,
      paymentMethod: (pe.payment_method as string) || '',
      receiptSubmitted: Boolean(pe.receipt_submitted),
      reimbursementStatus: ((pe.reimbursement_status as string) || 'PENDING') as PersonalExpense['reimbursementStatus'],
      usageDate: (pe.usage_date as string) || '',
      description: (pe.description as string) || '',
      usedBy: (pe.used_by as string) || '',
      amountWithVat: Number(pe.amount_with_vat) || 0,
      vendor: (pe.vendor as string) || '',
      note: (pe.note as string) || undefined,
    }));

    return {
      summary,
      paymentSchedules,
      lineItems,
      taxInvoices,
      withholdingPayments,
      corporateCardExpenses,
      corporateCashExpenses,
      personalExpenses,
    };
  } catch (err) {
    console.error('[BudgetService] loadBudget error:', err);
    return null;
  }
}
