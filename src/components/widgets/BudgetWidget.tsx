/**
 * BudgetWidget — Shows project budget summary (admin only).
 * Dark gradient card, no title bar.
 */

import { useAppStore } from '@/stores/appStore';
import { useNavigate } from 'react-router-dom';
import type { WidgetDataContext } from '@/types/widget';

function BudgetWidget({ context }: { context: WidgetDataContext }) {
  const { getProjectById } = useAppStore();
  const navigate = useNavigate();
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
    <div
      className="h-full widget-dark-card progress-gradient-bg p-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
      onClick={() => navigate(`/projects/${project.id}?tab=budget`)}
    >
      <div>
        <p className="text-[10px] text-white/50 mb-0.5">전체 예산</p>
        <p className="text-lg font-bold text-white tabular-nums">{fmt(totalBudget)}원</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-white/50 mb-0.5">집행률</p>
        <p className="text-lg font-bold text-white tabular-nums">{usagePercent}%</p>
      </div>
    </div>
  );
}

export default BudgetWidget;
