import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { 
  ArrowLeft, 
  LayoutGrid, 
  Calendar, 
  MessageSquare, 
  FolderOpen, 
  DollarSign,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  OverviewTab,
  ProjectCalendarTab,
  ProjectChatTab,
  FilesTab,
  BudgetTab,
} from '@/components/project';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { getProjectById, updateProject, currentUser } = useAppStore();

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

  const handleCompleteProject = () => {
    updateProject(project.id, { status: 'COMPLETED', progress: 100 });
  };

  const isAdmin = currentUser.role === 'ADMIN';

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/projects">
          <Button variant="ghost" size="icon" className="shrink-0 mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title truncate">{project.title}</h1>
            <Badge 
              variant="secondary"
              className={project.status === 'ACTIVE' ? 'status-active' : 'status-completed'}
            >
              {project.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {project.client} · {formatDate(project.startDate)} - {formatDate(project.endDate)}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 shrink-0">
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutGrid className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            Files
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="budget" className="gap-2">
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

        {isAdmin && (
          <TabsContent value="budget">
            <BudgetTab projectId={project.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
