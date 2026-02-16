import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Project } from '@/types/core';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, ChevronDown, Calendar, MoreHorizontal, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NewProjectModal } from '@/components/project';
import { formatCurrency } from '@/lib/format';
import { useTranslation } from '@/hooks/useTranslation';

export default function ProjectsPage() {
  const { projects } = useAppStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'>('ALL');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.client.toLowerCase().includes(searchQuery.toLowerCase());
    // For now, treat ARCHIVED as a special filter - projects don't have ARCHIVED status yet
    if (statusFilter === 'ARCHIVED') return false;
    const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE');
  const completedProjects = projects.filter((p) => p.status === 'COMPLETED');
  const archivedProjects = 0; // Placeholder - would need to add ARCHIVED status to Project type

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('projects')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeProjects.length} {t('active')} · {completedProjects.length} {t('completed')} · {archivedProjects} {t('archived')}
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowNewProjectModal(true)}>
          <Plus className="w-4 h-4" />
          {t('newProject')}
        </Button>
      </div>

      <NewProjectModal open={showNewProjectModal} onOpenChange={setShowNewProjectModal} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('searchProjects')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="gap-2">
              <Filter className="w-4 h-4" />
              {statusFilter === 'ALL' ? t('allStatus') : statusFilter}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setStatusFilter('ALL')}>
              {t('allStatus')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('ACTIVE')}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
              {t('active')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('COMPLETED')}>
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
              {t('completed')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('ARCHIVED')}>
              <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
              {t('archived')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Projects Grid */}
      <div className="card-grid">
        {filteredProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('noProjectsFound')}</p>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const { t } = useTranslation();
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate days remaining
  const today = new Date();
  const endDate = new Date(project.endDate);
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Link to={`/projects/${project.id}`}>
      <Card className="shadow-card hover:shadow-md transition-all duration-200 cursor-pointer group h-full flex flex-col overflow-hidden">
        {/* Thumbnail */}
        {project.thumbnail ? (
          <div className="w-full h-28 overflow-hidden">
            <img 
              src={project.thumbnail} 
              alt={project.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        ) : (
          <div className="w-full h-28 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <Image className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}

        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {project.title}
              </h3>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {project.client}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>{t('editProject')}</DropdownMenuItem>
                <DropdownMenuItem>{t('archiveProject')}</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">{t('delete')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
              {project.description}
            </p>
          )}

          {/* Budget */}
          {project.budget && project.budget > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground">{t('budget')}</p>
              <p className="text-sm font-medium text-foreground">
                {formatCurrency(project.budget, project.currency || 'KRW')}
              </p>
            </div>
          )}

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">{t('progress')}</span>
              <span className="font-medium text-foreground">{project.progress || 0}%</span>
            </div>
            <Progress value={project.progress || 0} className="h-1.5" />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(project.startDate)} - {formatDate(project.endDate)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {project.status === 'ACTIVE' && daysRemaining > 0 && (
                <span className="text-xs text-muted-foreground">{daysRemaining}{t('daysLeftShort')}</span>
              )}
              <Badge 
                variant="secondary"
                className={
                  project.status === 'ACTIVE' 
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-100 text-amber-700 border-amber-200'
                }
              >
                {project.status}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
