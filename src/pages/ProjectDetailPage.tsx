import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import { 
  ArrowLeft, 
  Calendar, 
  MessageSquare, 
  FolderOpen, 
  Settings,
  Send,
  FileText,
  Presentation,
  FileCheck,
  BookOpen,
  FileSignature,
  MoreHorizontal,
  Download,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileCategory } from '@/types/core';
import { useState } from 'react';

const categoryIcons: Record<FileCategory, typeof FileText> = {
  DECK: Presentation,
  FINAL: FileCheck,
  REFERENCE: BookOpen,
  CONTRACT: FileSignature,
  ETC: FileText,
};

const categoryLabels: Record<FileCategory, string> = {
  DECK: 'Presentations',
  FINAL: 'Final Deliverables',
  REFERENCE: 'References',
  CONTRACT: 'Contracts',
  ETC: 'Others',
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { 
    getProjectById, 
    getEventsByProject, 
    getMessagesByProject, 
    getFileGroupsByProject,
    getFilesByGroup,
    getUserById 
  } = useAppStore();

  const project = getProjectById(projectId || '');
  const events = getEventsByProject(projectId || '');
  const messages = getMessagesByProject(projectId || '');
  const fileGroups = getFileGroupsByProject(projectId || '');

  const [newMessage, setNewMessage] = useState('');

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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    // Placeholder for message send logic
    console.log('Sending message:', newMessage);
    setNewMessage('');
  };

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

      {/* Progress Card */}
      <Card className="p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-foreground">Project Progress</h3>
          <span className="text-2xl font-semibold text-primary">{project.progress || 0}%</span>
        </div>
        <Progress value={project.progress || 0} className="h-2" />
        {project.description && (
          <p className="text-sm text-muted-foreground mt-4">{project.description}</p>
        )}
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline" className="gap-2">
            <Calendar className="w-4 h-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            Files
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <Card className="p-5 shadow-card">
            <h3 className="font-medium text-foreground mb-4">Upcoming Events</h3>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events scheduled</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div 
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      event.type === 'DEADLINE' ? 'bg-destructive' :
                      event.type === 'MEETING' ? 'bg-emerald-500' :
                      event.type === 'PT' ? 'bg-violet-500' :
                      event.type === 'DELIVERY' ? 'bg-orange-500' :
                      'bg-primary'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(event.startAt)} · {event.type}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="shadow-card overflow-hidden">
            <ScrollArea className="h-[400px] p-4">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No messages yet. Start the conversation!
                </p>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const user = getUserById(message.userId);
                    return (
                      <div key={message.id} className="flex gap-3">
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {user?.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {user?.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(message.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/90 mt-1">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
            <Separator />
            <div className="p-4 flex gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <Button size="icon" onClick={handleSendMessage}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {fileGroups.length} file groups
            </p>
            <Button size="sm" className="gap-2">
              <Upload className="w-4 h-4" />
              Upload Files
            </Button>
          </div>

          {fileGroups.length === 0 ? (
            <Card className="p-8 shadow-card text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No files uploaded yet</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {fileGroups.map((group) => {
                const files = getFilesByGroup(group.id);
                const Icon = categoryIcons[group.category];
                
                return (
                  <Card key={group.id} className="p-4 shadow-card">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground truncate">
                          {group.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {categoryLabels[group.category]} · {files.length} files
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {files.slice(0, 3).map((file) => (
                        <div 
                          key={file.id}
                          className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
                        >
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground truncate flex-1">
                            {file.name}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {file.size}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                      {files.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center pt-1">
                          +{files.length - 3} more files
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
