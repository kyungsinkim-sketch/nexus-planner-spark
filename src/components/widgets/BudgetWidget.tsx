/**
 * BudgetWidget — Shows project budget (admin only).
 */

import { useAppStore } from '@/stores/appStore';
import { DollarSign } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function BudgetWidget({ context }: { context: WidgetDataContext }) {
  const { getProjectById } = useAppStore();
  const project = context.projectId ? getProjectById(context.projectId) : null;

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        No project selected
      </div>
    );
  }

  const budget = project.budget || 0;
  const formatted = new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(budget);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <DollarSign className="w-8 h-8 text-primary/70" />
      <p className="text-2xl font-bold text-foreground">{formatted}</p>
      <p className="text-xs text-muted-foreground">Project Budget</p>
    </div>
  );
}

export default BudgetWidget;
