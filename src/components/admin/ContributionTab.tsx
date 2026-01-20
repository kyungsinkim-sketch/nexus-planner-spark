import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Download, Filter, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export function ContributionTab() {
  const { projects, users, projectContributions, getUserById, getProjectById } = useAppStore();
  const [selectedProject, setSelectedProject] = useState<string>('all');
  
  // Filter contributions by project
  const filteredContributions = selectedProject === 'all' 
    ? projectContributions 
    : projectContributions.filter(c => c.projectId === selectedProject);

  // Calculate user totals
  const userTotals = users.map(user => {
    const userContributions = filteredContributions.filter(c => c.userId === user.id);
    const totalValue = userContributions.reduce((sum, c) => sum + c.contributionValue, 0);
    const avgRate = userContributions.length > 0
      ? userContributions.reduce((sum, c) => sum + c.contributionRate, 0) / userContributions.length
      : 0;
    return {
      user,
      totalValue,
      avgRate,
      projectCount: userContributions.length,
    };
  }).filter(u => u.projectCount > 0).sort((a, b) => b.totalValue - a.totalValue);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleExport = () => {
    toast.success('Export started', {
      description: 'Your data will be downloaded shortly (mock)',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <Card className="p-4 shadow-card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              Filter by:
            </div>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 shadow-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm text-muted-foreground">Total Contribution Value</p>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(filteredContributions.reduce((sum, c) => sum + c.contributionValue, 0))}
          </p>
        </Card>
        <Card className="p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Contributors</p>
          <p className="text-3xl font-semibold text-foreground mt-1">{userTotals.length}</p>
        </Card>
        <Card className="p-5 shadow-card">
          <p className="text-sm text-muted-foreground">Project Records</p>
          <p className="text-3xl font-semibold text-foreground mt-1">{filteredContributions.length}</p>
        </Card>
      </div>

      {/* User Summary Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">Individual Contributions</h3>
          <p className="text-sm text-muted-foreground">Total contribution value per team member</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Member</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Avg. Contribution Rate</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userTotals.map(({ user, totalValue, avgRate, projectCount }) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{projectCount}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3 min-w-[150px]">
                    <Progress value={avgRate * 100} className="h-2 flex-1" />
                    <span className="text-sm text-muted-foreground w-12">
                      {(avgRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(totalValue)}
                </TableCell>
              </TableRow>
            ))}
            {userTotals.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No contribution data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detailed Contributions Table */}
      <Card className="shadow-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">Contribution Details</h3>
          <p className="text-sm text-muted-foreground">Project-level contribution breakdown</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Team Member</TableHead>
              <TableHead>Contribution Rate</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContributions.map((contribution) => {
              const project = getProjectById(contribution.projectId);
              const user = getUserById(contribution.userId);
              return (
                <TableRow key={contribution.id}>
                  <TableCell className="font-medium">{project?.title || '-'}</TableCell>
                  <TableCell>{user?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <Progress value={contribution.contributionRate * 100} className="h-2 flex-1" />
                      <span className="text-sm text-muted-foreground w-12">
                        {(contribution.contributionRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(contribution.contributionValue)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}