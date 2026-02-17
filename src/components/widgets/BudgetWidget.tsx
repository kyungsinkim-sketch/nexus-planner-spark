/**
 * BudgetWidget — Shows project budget summary (admin only).
 * Dark gradient card, no title bar.
 */

import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { DollarSign } from 'lucide-react';
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

  const totalBudget = project.budget || 0;
  const usedBudget = Math.round(totalBudget * ((project.progress || 0) / 100));
  const usagePercent = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;

  const fmt = (v: number) =>
    new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(v);

  return (
    <div className="h-full widget-dark-card progress-gradient-bg p-3 flex flex-col justify-center">
      {/* Summary row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-white/50 mb-0.5">전체 예산</p>
          <p className="text-lg font-bold text-white tabular-nums leading-tight">{fmt(totalBudget)}원</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-[10px] text-white/50 mb-0.5">집행률</p>
            <p className="text-lg font-bold text-white tabular-nums leading-tight">{usagePercent}%</p>
          </div>
          {/* Small budget management button */}
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}/budget`); }}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white/70 hover:text-white
                       transition-colors backdrop-blur-sm border border-white/10 shrink-0"
            title={t('budgetManagement')}
          >
            <DollarSign className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default BudgetWidget;
