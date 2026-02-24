/**
 * BudgetWidget — Shows project budget summary (admin only).
 * Dark gradient card, no title bar.
 *
 * Shows real data ONLY for projects with a Google Sheets budget link.
 * Projects without a budget link show an empty "not connected" state.
 *
 * Layout: 총 계약금액 | 목표지출비용 | 내수율 | 예산관리 button
 * Items are evenly spaced with proper padding.
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { PieChart, LinkIcon } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { WidgetDataContext } from '@/types/widget';

interface BudgetData {
  totalContractAmount: number;
  targetExpense: number;
  actualExpense: number;
  internalRate: number;
}

function BudgetWidget({ context }: { context: WidgetDataContext }) {
  const { getProjectById } = useAppStore();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const project = context.projectId ? getProjectById(context.projectId) : null;
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [hasLink, setHasLink] = useState<boolean | null>(null); // null = loading
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!project || !isSupabaseConfigured()) {
      setIsLoading(false);
      setHasLink(false);
      return;
    }

    let cancelled = false;

    const loadBudget = async () => {
      try {
        const { getBudgetLink } = await import('@/services/googleSheetsService');
        const link = await getBudgetLink(project.id);

        if (cancelled) return;

        if (!link) {
          setHasLink(false);
          setIsLoading(false);
          return;
        }

        setHasLink(true);

        // Load real budget data from synced tables
        const { loadBudget: loadBudgetData } = await import('@/services/budgetService');
        const data = await loadBudgetData(project.id);

        if (cancelled) return;

        if (data?.summary) {
          const total = data.summary.totalContractAmount || 0;
          const target = data.summary.targetExpenseWithVat || Math.round(total * 0.6);
          // Compute actual expense from all 5 expense tables
          const computedActual = [
            ...(data.taxInvoices || []),
            ...(data.withholdingPayments || []),
            ...(data.corporateCardExpenses || []),
            ...(data.corporateCashExpenses || []),
            ...(data.personalExpenses || []),
          ].reduce((sum, item) => sum + (('supplyAmount' in item ? item.supplyAmount : 0) || ('amount' in item ? item.amount : 0) || 0), 0);
          const actual = data.summary.actualExpenseWithVat || computedActual;
          const rate = total > 0 ? Math.round(((total - (actual || target)) / total) * 100) : 0;
          setBudgetData({
            totalContractAmount: total,
            targetExpense: target,
            actualExpense: actual,
            internalRate: rate,
          });
        }
      } catch (error) {
        console.error('[BudgetWidget] Failed to load budget:', error);
        setHasLink(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadBudget();
    return () => { cancelled = true; };
  }, [project?.id]);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full widget-dark-card progress-gradient-bg text-white/40 text-sm">
        No project selected
      </div>
    );
  }

  const fmt = (v: number) =>
    new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(v);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full widget-dark-card progress-gradient-bg p-4 flex items-center justify-center">
        <div className="text-white/40 text-xs animate-pulse">
          {language === 'ko' ? '예산 데이터 로딩...' : 'Loading budget...'}
        </div>
      </div>
    );
  }

  // No budget link — show empty state
  if (!hasLink || !budgetData) {
    return (
      <div className="h-full widget-dark-card progress-gradient-bg p-4 flex items-center">
        <div className="flex-1 flex items-center justify-center gap-2 text-white/40">
          <LinkIcon className="w-4 h-4" />
          <span className="text-xs">
            {language === 'ko' ? '예산 시트 미연동' : 'No budget sheet linked'}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/budget`); }}
          className="ml-3 p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white/70 hover:text-white
                     transition-colors backdrop-blur-sm border border-white/10 shrink-0"
          title={t('budgetManagement')}
        >
          <PieChart className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full widget-dark-card progress-gradient-bg p-4 flex items-center">
      {/* Evenly distributed metrics */}
      <div className="flex-1 flex items-center justify-around gap-2">
        {/* 총 계약금액 */}
        <div className="text-center min-w-0">
          <p className="text-[10px] text-white/50 mb-0.5 whitespace-nowrap">
            {language === 'ko' ? '총 계약금액' : 'Contract'}
          </p>
          <p className="text-sm font-bold text-white tabular-nums leading-tight">{fmt(budgetData.totalContractAmount)}<span className="text-[10px] font-normal text-white/60">원</span></p>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/15 shrink-0" />

        {/* 목표지출비용 */}
        <div className="text-center min-w-0">
          <p className="text-[10px] text-white/50 mb-0.5 whitespace-nowrap">
            {language === 'ko' ? '목표지출비용' : 'Target Expense'}
          </p>
          <p className="text-sm font-bold text-white tabular-nums leading-tight">{fmt(budgetData.targetExpense)}<span className="text-[10px] font-normal text-white/60">원</span></p>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/15 shrink-0" />

        {/* 내수율 */}
        <div className="text-center min-w-0">
          <p className="text-[10px] text-white/50 mb-0.5 whitespace-nowrap">
            {language === 'ko' ? '내수율' : 'Margin'}
          </p>
          <p className={`text-sm font-bold tabular-nums leading-tight ${budgetData.internalRate >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {budgetData.internalRate}<span className={`text-[10px] font-normal ${budgetData.internalRate >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>%</span>
          </p>
        </div>
      </div>

      {/* Budget management button — pie chart icon */}
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/budget`); }}
        className="ml-3 p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white/70 hover:text-white
                   transition-colors backdrop-blur-sm border border-white/10 shrink-0"
        title={t('budgetManagement')}
      >
        <PieChart className="w-4 h-4" />
      </button>
    </div>
  );
}

export default BudgetWidget;
