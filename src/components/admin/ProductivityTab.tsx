import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Filter, TrendingUp, Users, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  calculateProjectProductivity,
  formatAmount,
  type ProjectProductivityResult,
} from '@/utils/productivityCalculation';

interface ProjectFinancialData {
  projectId: string;
  title: string;
  client: string;
  totalRevenue: number;
  productionCost: number;
  teamMemberIds: string[];
  participants: { userId: string; userName: string; annualSalary: number }[];
}

export function ProductivityTab() {
  const { projects, users, peerFeedback, getUserById, getProjectById } = useAppStore();
  const { t } = useTranslation();
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'contribution' | 'feedback'>('contribution');
  const [financialData, setFinancialData] = useState<ProjectFinancialData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real financial data from DB
  useEffect(() => {
    async function fetchFinancials() {
      try {
        // Get project financials
        const { data: pf } = await supabase
          .from('project_financials')
          .select('project_id, contract_amount, expenses, net_revenue')
          .gt('contract_amount', 0);

        if (!pf) { setLoading(false); return; }

        // Get salary grades for default wage
        const { data: salaryGrades } = await supabase
          .from('nexus_salary_grades')
          .select('category, annual_salary');

        const defaultSalary = 48000000; // fallback
        const categoryMap = new Map<string, number>();
        if (salaryGrades) {
          for (const sg of salaryGrades) {
            if (!categoryMap.has(sg.category)) {
              categoryMap.set(sg.category, Number(sg.annual_salary));
            }
          }
        }

        const results: ProjectFinancialData[] = [];
        for (const fin of pf) {
          const project = projects.find(p => p.id === fin.project_id);
          if (!project) continue;

          const memberIds = (project as any).teamMemberIds || [];
          const participants = memberIds.map((uid: string) => {
            const user = users.find(u => u.id === uid);
            return {
              userId: uid,
              userName: user?.name || 'Unknown',
              annualSalary: defaultSalary,
            };
          });

          // If no members assigned, skip
          if (participants.length === 0) continue;

          results.push({
            projectId: fin.project_id,
            title: project.title,
            client: project.client,
            totalRevenue: Number(fin.contract_amount),
            productionCost: Number(fin.expenses) || 0,
            teamMemberIds: memberIds,
            participants,
          });
        }

        setFinancialData(results);
      } catch (e) {
        console.error('Failed to fetch financials:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchFinancials();
  }, [projects, users]);

  const completedProjects = projects.filter(p => p.status === 'COMPLETED');

  // Calculate productivity results from real data
  const productivityResults = useMemo(() => {
    return financialData.map(pf =>
      calculateProjectProductivity(
        pf.title,
        pf.projectId,
        pf.client,
        pf.totalRevenue,
        pf.productionCost,
        pf.participants,
      ),
    );
  }, [financialData]);

  // Filter by selected project
  const filteredResults = selectedProject === 'all'
    ? productivityResults
    : productivityResults.filter(r => r.project.projectId === selectedProject);

  // Aggregate user contributions across projects
  const userContributionSummary = useMemo(() => {
    const summary = new Map<string, { userName: string; totalAmount: number; projectCount: number; avgRate: number }>();

    for (const result of filteredResults) {
      for (const c of result.contributions) {
        const existing = summary.get(c.userId) || { userName: c.userName, totalAmount: 0, projectCount: 0, avgRate: 0 };
        existing.totalAmount += c.contributionAmount;
        existing.projectCount += 1;
        summary.set(c.userId, existing);
      }
    }

    // Calculate average contribution rate
    for (const [userId, data] of summary) {
      const userContributions = filteredResults
        .flatMap(r => r.contributions)
        .filter(c => c.userId === userId);
      data.avgRate = userContributions.length > 0
        ? userContributions.reduce((sum, c) => sum + c.contributionRate, 0) / userContributions.length
        : 0;
    }

    return Array.from(summary.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredResults]);

  // Total distributable amount
  const totalDistributable = filteredResults.reduce((sum, r) => sum + r.project.distributableAmount, 0);
  const totalNetRevenue = filteredResults.reduce((sum, r) => sum + r.project.netRevenue, 0);

  // Peer feedback section
  const filteredFeedback = selectedProject === 'all'
    ? peerFeedback
    : peerFeedback.filter(f => f.projectId === selectedProject);

  const userAverages = users.map(user => {
    const userFeedback = filteredFeedback.filter(f => f.toUserId === user.id);
    const avgRating = userFeedback.length > 0
      ? userFeedback.reduce((sum, f) => sum + f.rating, 0) / userFeedback.length
      : 0;
    return { user, avgRating, feedbackCount: userFeedback.length };
  }).filter(u => u.feedbackCount > 0).sort((a, b) => b.avgRating - a.avgRating);

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${star <= rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4 shadow-card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="w-4 h-4" />
            {t('filter')}:
          </div>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder={t('selectProject')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allProjects')}</SelectItem>
              {completedProjects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Badge
              variant={viewMode === 'contribution' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setViewMode('contribution')}
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              {t('contributionAnalysis')}
            </Badge>
            <Badge
              variant={viewMode === 'feedback' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setViewMode('feedback')}
            >
              <Star className="w-3 h-3 mr-1" />
              {t('peerFeedback')}
            </Badge>
          </div>
        </div>
      </Card>

      {viewMode === 'contribution' ? (
        <>
          {/* Contribution Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="p-5 shadow-card">
              <p className="text-sm text-muted-foreground">{t('totalNetRevenue')}</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{formatAmount(totalNetRevenue)}</p>
            </Card>
            <Card className="p-5 shadow-card">
              <p className="text-sm text-muted-foreground">{t('overheadCostPercent')}</p>
              <p className="text-2xl font-semibold text-orange-600 mt-1">
                {formatAmount(Math.round(totalNetRevenue * 0.25))}
              </p>
            </Card>
            <Card className="p-5 shadow-card">
              <p className="text-sm text-muted-foreground">{t('netProfitPercent')}</p>
              <p className="text-2xl font-semibold text-green-600 mt-1">
                {formatAmount(Math.round(totalNetRevenue * 0.15))}
              </p>
            </Card>
            <Card className="p-5 shadow-card">
              <p className="text-sm text-muted-foreground">{t('distributablePercent')}</p>
              <p className="text-2xl font-semibold text-primary mt-1">{formatAmount(totalDistributable)}</p>
            </Card>
          </div>

          {/* User Contribution Summary */}
          <Card className="shadow-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                {t('contributionSummaryByMember')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('contributionCalcDescription')}
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('teamMember')}</TableHead>
                  <TableHead className="text-center">{t('participatingProjects')}</TableHead>
                  <TableHead className="text-center">{t('avgContributionRate')}</TableHead>
                  <TableHead className="text-center">{t('contribution')}</TableHead>
                  <TableHead className="text-right">{t('contributionAmount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userContributionSummary.map(({ userId, userName, totalAmount, projectCount, avgRate }) => (
                  <TableRow key={userId}>
                    <TableCell className="font-medium">{userName}</TableCell>
                    <TableCell className="text-center">{projectCount}{t('projectCountSuffix')}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{(avgRate * 100).toFixed(1)}%</Badge>
                    </TableCell>
                    <TableCell className="text-center w-[140px]">
                      <div className="flex items-center gap-2">
                        <Progress value={avgRate * 100} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {(avgRate * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {formatAmount(totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
                {userContributionSummary.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t('noData')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Per-Project Breakdown */}
          {filteredResults.map((result) => (
            <Card key={result.project.projectId} className="shadow-card overflow-hidden">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{result.project.projectTitle}</h3>
                    <p className="text-sm text-muted-foreground">{result.project.client}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{t('distributable')}</p>
                    <p className="font-semibold text-primary">{formatAmount(result.project.distributableAmount)}</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{t('netRevenueLabel')}: {formatAmount(result.project.netRevenue)}</span>
                  <span>{t('overheadLabel')}: {formatAmount(Math.round(result.project.netRevenue * 0.25))}</span>
                  <span>{t('netProfitLabel')}: {formatAmount(Math.round(result.project.netRevenue * 0.15))}</span>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('teamMember')}</TableHead>
                    <TableHead className="text-center">{t('annualSalary')}</TableHead>
                    <TableHead className="text-center">{t('contributionRate')}</TableHead>
                    <TableHead className="text-right">{t('contributionAmount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.contributions.map((c) => (
                    <TableRow key={c.userId}>
                      <TableCell className="font-medium">{c.userName}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {formatAmount(c.annualSalary)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{(c.contributionRate * 100).toFixed(1)}%</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatAmount(c.contributionAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </>
      ) : (
        <>
          {/* Feedback Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5 shadow-card">
              <p className="text-sm text-muted-foreground">{t('totalFeedback')}</p>
              <p className="text-3xl font-semibold text-foreground mt-1">{filteredFeedback.length}</p>
            </Card>
            <Card className="p-5 shadow-card">
              <p className="text-sm text-muted-foreground">{t('averageScore')}</p>
              <p className="text-3xl font-semibold text-foreground mt-1">
                {filteredFeedback.length > 0
                  ? (filteredFeedback.reduce((sum, f) => sum + f.rating, 0) / filteredFeedback.length).toFixed(1)
                  : '-'
                }
              </p>
            </Card>
            <Card className="p-5 shadow-card">
              <p className="text-sm text-muted-foreground">{t('evaluatedProjects')}</p>
              <p className="text-3xl font-semibold text-foreground mt-1">
                {new Set(filteredFeedback.map(f => f.projectId)).size}
              </p>
            </Card>
          </div>

          {/* User Averages Table */}
          <Card className="shadow-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-foreground">{t('individualPerformance')}</h3>
              <p className="text-sm text-muted-foreground">{t('peerFeedbackAvgScore')}</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('teamMember')}</TableHead>
                  <TableHead>{t('feedbackCount')}</TableHead>
                  <TableHead>{t('averageScore')}</TableHead>
                  <TableHead>{t('score')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userAverages.map(({ user, avgRating, feedbackCount }) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{feedbackCount}</TableCell>
                    <TableCell>{renderStars(Math.round(avgRating))}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{avgRating.toFixed(1)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {userAverages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {t('noFeedbackData')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Detailed Feedback Table */}
          <Card className="shadow-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-foreground">{t('feedbackDetails')}</h3>
              <p className="text-sm text-muted-foreground">{t('allPeerReviewRecords')}</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('project')}</TableHead>
                  <TableHead>{t('reviewer')}</TableHead>
                  <TableHead>{t('reviewTarget')}</TableHead>
                  <TableHead>{t('score')}</TableHead>
                  <TableHead>{t('comment')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.map((feedback) => {
                  const project = getProjectById(feedback.projectId);
                  const fromUser = getUserById(feedback.fromUserId);
                  const toUser = getUserById(feedback.toUserId);
                  return (
                    <TableRow key={feedback.id}>
                      <TableCell className="font-medium">{project?.title || '-'}</TableCell>
                      <TableCell>{fromUser?.name || '-'}</TableCell>
                      <TableCell>{toUser?.name || '-'}</TableCell>
                      <TableCell>{renderStars(feedback.rating)}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {feedback.comment || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
