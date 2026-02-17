/**
 * BudgetWidget — Shows project budget summary (admin only).
 * Dark gradient card, no title bar.
 */

import { useAppStore } from '@/stores/appStore';
import type { WidgetDataContext } from '@/types/widget';

function BudgetWidget({ context }: { context: WidgetDataContext }) {
  const { getProjectById } = useAppStore();
  const project = context.projectId ? getProjectById(context.projectId) : null;

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full widget-dark-card progress-gradient-bg text-white/40 text-sm">
        No project selected
      </div>
    );
  }

  const totalBudget = project.budget || 0;
  // Estimate used budget from project progress (mock — real data would come from budget service)
  const usedBudget = Math.round(totalBudget * ((project.progress || 0) / 100));
  const remaining = totalBudget - usedBudget;
  const usagePercent = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;

  const fmt = (v: number) =>
    new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(v);

  return (
    <div className="h-full widget-dark-card progress-gradient-bg p-4 flex flex-col justify-center gap-3">
      {/* Total & Used */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] text-white/50 mb-0.5">전체 예산</p>
          <p className="text-xl font-bold text-white tabular-nums">{fmt(totalBudget)}원</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/50 mb-0.5">사용 예산</p>
          <p className="text-lg font-semibold text-white/90 tabular-nums">{fmt(usedBudget)}원</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(usagePercent, 100)}%`,
              background: usagePercent > 90
                ? 'hsl(0 84% 60%)'
                : usagePercent > 70
                  ? 'hsl(38 92% 50%)'
                  : 'hsl(142 76% 50%)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-white/40">{usagePercent}% 사용</span>
          <span className="text-[10px] text-white/40">잔여 {fmt(remaining)}원</span>
        </div>
      </div>
    </div>
  );
}

export default BudgetWidget;
