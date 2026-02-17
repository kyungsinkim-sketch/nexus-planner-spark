import { useState } from 'react';
import { Project } from '@/types/core';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Building2, Clock, CheckCircle2, Lock, Mail } from 'lucide-react';
import { ProjectHealthBlock } from './ProjectHealthBlock';
import { NextActionsSection } from './NextActionsSection';
import { BrainInsightsPanel } from './BrainInsightsPanel';
import { TeamLoadSnapshot } from './TeamLoadSnapshot';
import { ProjectCompleteModal } from './ProjectCompleteModal';
import { useTranslation } from '@/hooks/useTranslation';

interface OverviewTabProps {
  project: Project;
  onCompleteProject?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export function OverviewTab({ project, onCompleteProject, onNavigateToTab }: OverviewTabProps) {
  const { t, language } = useTranslation();
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const localeMap: Record<string, string> = { en: 'en-US', ko: 'ko-KR' };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(localeMap[language] || 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate total duration and elapsed days
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const today = new Date();
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, totalDays - elapsedDays);

  const handleCompleteClick = () => {
    setShowCompleteModal(true);
  };

  const handleConfirmComplete = () => {
    onCompleteProject?.();
    setShowCompleteModal(false);
  };

  const handleNavigateToTab = (tab: string) => {
    onNavigateToTab?.(tab);
  };

  return (
    <div className="space-y-6">
      {/* Project Health Block */}
      <ProjectHealthBlock project={project} />

      {/* Project Info Card */}
      <Card className="p-6 shadow-card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t('projectInformation')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t('overviewAndKeyDetails')}</p>
          </div>
          <div className="flex items-center gap-2">
            {project.isLocked && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="w-3 h-3" />
                {t('locked')}
              </Badge>
            )}
            {project.feedbackStatus && (
              <Badge 
                variant="outline"
                className={`gap-1 ${
                  project.feedbackStatus === 'COMPLETED' 
                    ? 'border-emerald-500 text-emerald-600' 
                    : 'border-amber-500 text-amber-600'
                }`}
              >
                <Mail className="w-3 h-3" />
                {t('feedback')}: {project.feedbackStatus}
              </Badge>
            )}
            <Badge 
              variant="secondary"
              className={project.status === 'ACTIVE' ? 'status-active' : 'status-completed'}
            >
              {project.status}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Building2 className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t('client')}</p>
              <p className="text-sm font-medium text-foreground">{project.client}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Calendar className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t('duration')}</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(project.startDate)} - {formatDate(project.endDate)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Clock className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{t('remaining')}</p>
              <p className="text-sm font-medium text-foreground">
                {remainingDays > 0 ? `${remainingDays} ${t('daysLeft')}` : t('overdueLabel')}
              </p>
            </div>
          </div>
        </div>

        {project.description && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">{t('description')}</p>
            <p className="text-sm text-foreground mt-2">{project.description}</p>
          </div>
        )}
      </Card>

      {/* Next Actions Section */}
      <NextActionsSection project={project} onNavigateToTab={handleNavigateToTab} />

      {/* Brain AI Insights (when enabled) */}
      <BrainInsightsPanel projectId={project.id} />

      {/* Team Load Snapshot (Admin Only) */}
      <TeamLoadSnapshot project={project} />

      {/* Complete Project Button */}
      {project.status === 'ACTIVE' && !project.isLocked && (
        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{t('readyToComplete')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('markProjectComplete')}
              </p>
            </div>
            <Button onClick={handleCompleteClick} variant="glass-accent" className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {t('projectComplete')}
            </Button>
          </div>
        </Card>
      )}

      {/* Project Complete Modal */}
      <ProjectCompleteModal
        open={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        project={project}
        onConfirm={handleConfirmComplete}
      />
    </div>
  );
}
