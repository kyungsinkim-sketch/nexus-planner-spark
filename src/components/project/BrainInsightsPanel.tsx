/**
 * BrainInsightsPanel — Passive Intelligence UI component
 *
 * Displays AI-analyzed conversation insights:
 * - Recent Decisions
 * - Open Action Items
 * - Identified Risks
 * - Conversation Summary
 *
 * Only renders when brainIntelligenceEnabled is true in appStore.
 * Fetches data from brainDigestService.getProjectContext().
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Lightbulb,
  ListChecks,
  AlertTriangle,
  RefreshCw,
  MessageSquareText,
  Clock,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { getProjectContext } from '@/services/brainDigestService';
import type { ProjectInsightsData, DigestItem } from '@/types/core';

interface BrainInsightsPanelProps {
  projectId: string;
}

export function BrainInsightsPanel({ projectId }: BrainInsightsPanelProps) {
  const { t } = useTranslation();
  const brainIntelligenceEnabled = useAppStore((s) => s.brainIntelligenceEnabled);
  const [insights, setInsights] = useState<ProjectInsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(
    async (forceRefresh?: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProjectContext(projectId, forceRefresh);
        setInsights(data);
      } catch (err) {
        console.error('Failed to fetch brain insights:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (brainIntelligenceEnabled) {
      fetchInsights();
    }
  }, [brainIntelligenceEnabled, fetchInsights]);

  // Don't render if disabled
  if (!brainIntelligenceEnabled) return null;

  const formatLastAnalyzed = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPriorityColor = (priority?: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30';
      case 'medium':
        return 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30';
      case 'low':
        return 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const renderDigestItems = (items: DigestItem[], icon: React.ReactNode, emptyText: string) => {
    if (!items || items.length === 0) {
      return (
        <p className="text-xs text-muted-foreground italic py-3 text-center">{emptyText}</p>
      );
    }

    return (
      <ul className="space-y-2">
        {items.slice(0, 5).map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 shrink-0 opacity-60">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-foreground leading-relaxed">{item.text}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {item.priority && (
                  <Badge
                    variant="secondary"
                    className={`text-[9px] px-1.5 py-0 h-4 ${getPriorityColor(item.priority)}`}
                  >
                    {item.priority}
                  </Badge>
                )}
                {item.category && (
                  <span className="text-[9px] text-muted-foreground">{item.category}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  // Loading state — skeleton UI for perceived performance
  if (loading && !insights) {
    return (
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-violet-500" />
          <h3 className="text-lg font-semibold text-foreground">{t('brainInsights')}</h3>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            분석 중...
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2.5 py-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-4/5 bg-muted rounded animate-pulse" />
                <div className="h-3 w-3/5 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Error state
  if (error && !insights) {
    return (
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-violet-500" />
          <h3 className="text-lg font-semibold text-foreground">{t('brainInsights')}</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-xs text-muted-foreground mb-3">{t('brainNoData')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInsights(true)}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  // No data yet
  if (!insights) {
    return (
      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-violet-500" />
          <h3 className="text-lg font-semibold text-foreground">{t('brainInsights')}</h3>
        </div>
        <p className="text-xs text-muted-foreground text-center py-6">{t('brainNoData')}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-500" />
          <h3 className="text-lg font-semibold text-foreground">{t('brainInsights')}</h3>
          <Badge variant="outline" className="text-[9px] gap-1 text-violet-500 border-violet-200 dark:border-violet-800">
            <Brain className="w-2.5 h-2.5" />
            {t('brainAiActive')}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {insights.lastAnalyzedAt && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {t('brainLastAnalyzed')}: {formatLastAnalyzed(insights.lastAnalyzedAt)}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={() => fetchInsights(true)}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* 3-column grid: Decisions / Action Items / Risks */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-5">
        {/* Decisions */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Lightbulb className="w-4 h-4 text-blue-500" />
            <h4 className="text-sm font-medium text-foreground">{t('brainDecisions')}</h4>
            {insights.recentDecisions.length > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 h-4 ml-auto">
                {insights.recentDecisions.length}
              </Badge>
            )}
          </div>
          {renderDigestItems(
            insights.recentDecisions,
            <Lightbulb className="w-3 h-3 text-blue-400" />,
            'No decisions detected yet',
          )}
        </div>

        {/* Action Items */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <ListChecks className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm font-medium text-foreground">{t('brainActionItems')}</h4>
            {insights.openActionItems.length > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 h-4 ml-auto">
                {insights.openActionItems.length}
              </Badge>
            )}
          </div>
          {renderDigestItems(
            insights.openActionItems,
            <ListChecks className="w-3 h-3 text-emerald-400" />,
            'No action items detected yet',
          )}
        </div>

        {/* Risks */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-medium text-foreground">{t('brainRisks')}</h4>
            {insights.identifiedRisks.length > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 h-4 ml-auto">
                {insights.identifiedRisks.length}
              </Badge>
            )}
          </div>
          {renderDigestItems(
            insights.identifiedRisks,
            <AlertTriangle className="w-3 h-3 text-amber-400" />,
            'No risks identified',
          )}
        </div>
      </div>

      {/* Conversation Summary */}
      {insights.conversationSummary && (
        <div className="rounded-lg border border-border p-4 bg-muted/30">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquareText className="w-4 h-4 text-violet-500" />
            <h4 className="text-sm font-medium text-foreground">{t('brainConversationSummary')}</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {insights.conversationSummary}
          </p>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>{insights.messageCount} messages analyzed</span>
            <span>
              Activity:{' '}
              <Badge
                variant="secondary"
                className={`text-[9px] px-1.5 h-4 ${
                  insights.activityLevel === 'high'
                    ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30'
                    : insights.activityLevel === 'medium'
                      ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30'
                      : 'text-muted-foreground bg-muted'
                }`}
              >
                {insights.activityLevel}
              </Badge>
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
