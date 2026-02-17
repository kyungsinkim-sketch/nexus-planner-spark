/**
 * BudgetPage — Full-screen budget management page for a project.
 * Rendered inside TabLayout (bottom nav stays visible).
 * Navigated to from BudgetWidget's "예산 관리" button.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { BudgetTab } from '@/components/project';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function BudgetPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getProjectById, currentUser } = useAppStore();
  const project = projectId ? getProjectById(projectId) : null;

  // Admin-only guard
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t('adminOnly')}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 w-8 h-8"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">
            {project.name} {t('budgetManagement')}
          </h1>
        </div>
      </div>

      {/* BudgetTab content */}
      <div className="flex-1 overflow-auto p-6">
        <BudgetTab projectId={projectId!} />
      </div>
    </div>
  );
}
