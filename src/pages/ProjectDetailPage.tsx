import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import {
  ArrowLeft,
  LayoutGrid,
  Calendar,
  MessageSquare,
  FolderOpen,
  DollarSign,
  MoreHorizontal,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  OverviewTab,
  ProjectCalendarTab,
  ProjectChatTab,
  FilesTab,
  BudgetTab,
  TodosTab,
} from '@/components/project';
import { EditProjectModal } from '@/components/project/EditProjectModal';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { getProjectById, updateProject, currentUser, getUserById } = useAppStore();
  const [showEditModal, setShowEditModal] = useState(false);

  const project = getProjectById(projectId || '');

  if (!project) {
    return (
      <div className="page-container">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Project not found</p>
          <Link to="/projects">
            <Button variant="outline" className="mt-4">
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'No activity';
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Updated just now';
    if (diffHours < 24) return `Updated ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Updated ${diffDays}d ago`;
  };

  const handleCompleteProject = () => {
    updateProject(project.id, { status: 'COMPLETED', progress: 100 });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const priorityColors = {
    HIGH: 'bg-red-100 text-red-700 border-red-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  const typeColors = {
    BIDDING: 'bg-violet-100 text-violet-700 border-violet-200',
    EXECUTION: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const isAdmin = currentUser.role === 'ADMIN';
  const pm = project.pmId ? getUserById(project.pmId) : null;
  const teamCount = project.teamMemberIds?.length || 0;

  return (
    <div className="page-container animate-fade-in relative min-h-screen">
      {/* Project Key Color Header Background */}
      {project.keyColor && (
        <div className="absolute top-0 left-0 right-0 h-48 -z-10">
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundColor: project.keyColor }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}

      {/* Thumbnail Full-Height Background with Gradient */}
      {project.thumbnail && (
        <div className="absolute inset-0 -z-20 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${project.thumbnail})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/projects">
          <Button variant="ghost" size="icon" className="shrink-0 mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          {/* Title Row with Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="page-title truncate">{project.title}</h1>
            {/* Project Key Color Indicator */}
            {project.keyColor && (
              <div
                className="w-3 h-3 rounded-full border-2 border-background shadow-sm"
                style={{ backgroundColor: project.keyColor }}
                title="Project Color"
              />
            )}
            <Badge
              variant="secondary"
              className={project.status === 'ACTIVE' ? 'status-active' : 'status-completed'}
            >
              {project.status}
            </Badge>
            {project.priority && (
              <Badge variant="outline" className={priorityColors[project.priority]}>
                {project.priority}
              </Badge>
            )}
            {project.type && (
              <Badge variant="outline" className={typeColors[project.type]}>
                {project.type}
              </Badge>
            )}
          </div>

          {/* Client and Date */}
          <p className="text-sm text-muted-foreground mt-1">
            {project.client} · {formatDate(project.startDate)} - {formatDate(project.endDate)}
          </p>

          {/* Quick Meta Row */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {/* PM Avatar */}
            {pm && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6 border-2" style={{ borderColor: project.keyColor || 'hsl(var(--primary))' }}>
                        <AvatarFallback className="text-[10px]" style={{ backgroundColor: project.keyColor || 'hsl(var(--primary))', color: 'white' }}>
                          {getInitials(pm.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">PM</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{pm.name} (Project Manager)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Team Count */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="flex -space-x-1.5">
                {project.teamMemberIds?.slice(0, 3).map((memberId) => {
                  const member = getUserById(memberId);
                  if (!member) return null;
                  return (
                    <Avatar key={memberId} className="w-5 h-5 border border-background">
                      <AvatarFallback className="text-[8px]">{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>
              <span>{teamCount} members</span>
            </div>

            {/* Last Activity */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatRelativeTime(project.lastActivityAt)}</span>
            </div>
          </div>
        </div>

        {/* Action Group */}
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                Edit Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Archive Project</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList
          className="w-full justify-start"
          style={{
            '--project-color': project.keyColor || 'hsl(var(--primary))'
          } as React.CSSProperties}
        >
          <TabsTrigger
            value="overview"
            className="gap-2 data-[state=active]:text-[var(--project-color)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--project-color)]"
          >
            <LayoutGrid className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="calendar"
            className="gap-2 data-[state=active]:text-[var(--project-color)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--project-color)]"
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="gap-2 data-[state=active]:text-[var(--project-color)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--project-color)]"
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger
            value="files"
            className="gap-2 data-[state=active]:text-[var(--project-color)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--project-color)]"
          >
            <FolderOpen className="w-4 h-4" />
            Files
          </TabsTrigger>
          <TabsTrigger
            value="todos"
            className="gap-2 data-[state=active]:text-[var(--project-color)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--project-color)]"
          >
            <LayoutGrid className="w-4 h-4" />
            To-dos
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="budget"
              className="gap-2 data-[state=active]:text-[var(--project-color)] data-[state=active]:border-b-2 data-[state=active]:border-[var(--project-color)]"
            >
              <DollarSign className="w-4 h-4" />
              Budget
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            project={project}
            onCompleteProject={handleCompleteProject}
          />
        </TabsContent>

        <TabsContent value="calendar">
          <ProjectCalendarTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="chat">
          <ProjectChatTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="files">
          <FilesTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="todos">
          <TodosTab projectId={project.id} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="budget">
            <BudgetTab projectId={project.id} />
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Project Modal */}
      <EditProjectModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        project={project}
      />
    </div>
  );
}
