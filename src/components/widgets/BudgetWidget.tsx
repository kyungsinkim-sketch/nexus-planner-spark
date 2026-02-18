/**
 * BudgetWidget — Shows project budget summary (admin only).
 * Dark gradient card, no title bar.
 *
 * Layout: 총 계약금액 | 목표지출비용 | 내수율 | 예산관리 button
 * Items are evenly spaced with proper padding.
 */

import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { PieChart } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function BudgetWidget({ context }: { context: WidgetDataContext }) {
  const { getProjectById } = useAppStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const project = context.projectId ? getProjectById(context.projectId) : null;

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full widget-dark-card progress-gradient-bg text-white/40 text-sm">
        No project selected
      </div>
    );
  }

  const totalBudget = project.budget || 0; // 총 계약금액
  // 목표지출비용: estimated at 60% of total contract (production cost target)
  const targetExpense = Math.round(totalBudget * 0.6);
  // 내수율: (totalBudget - targetExpense) / totalBudget * 100
  const internalRate = totalBudget > 0 ? Math.round(((totalBudget - targetExpense) / totalBudget) * 100) : 0;

  const fmt = (v: number) =>
    new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(v);

  return (
    <div className="h-full widget-dark-card progress-gradient-bg p-4 flex items-center">
      {/* Evenly distributed metrics */}
      <div className="flex-1 flex items-center justify-around gap-2">
        {/* 총 계약금액 */}
        <div className="text-center min-w-0">
          <p className="text-[10px] text-white/50 mb-0.5 whitespace-nowrap">총 계약금액</p>
          <p className="text-sm font-bold text-white tabular-nums leading-tight">{fmt(totalBudget)}<span className="text-[10px] font-normal text-white/60">원</span></p>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/15 shrink-0" />

        {/* 목표지출비용 */}
        <div className="text-center min-w-0">
          <p className="text-[10px] text-white/50 mb-0.5 whitespace-nowrap">목표지출비용</p>
          <p className="text-sm font-bold text-white tabular-nums leading-tight">{fmt(targetExpense)}<span className="text-[10px] font-normal text-white/60">원</span></p>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-white/15 shrink-0" />

        {/* 내수율 */}
        <div className="text-center min-w-0">
          <p className="text-[10px] text-white/50 mb-0.5 whitespace-nowrap">내수율</p>
          <p className="text-sm font-bold text-emerald-400 tabular-nums leading-tight">{internalRate}<span className="text-[10px] font-normal text-emerald-400/60">%</span></p>
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
