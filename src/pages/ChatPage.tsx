import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FolderKanban, 
  Users, 
  Search, 
  MessageSquare,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ChatPage() {
  const { projects, users, currentUser, messages } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'projects' | 'direct'>('projects');

  // Filter active projects
  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status === 'ACTIVE');
  }, [projects]);

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return activeProjects;
    const q = searchQuery.toLowerCase();
    return activeProjects.filter(p => 
      p.title.toLowerCase().includes(q) || 
      p.client.toLowerCase().includes(q)
    );
  }, [activeProjects, searchQuery]);

  // Filter users (excluding current user)
  const otherUsers = useMemo(() => {
    return users.filter(u => u.id !== currentUser.id);
  }, [users, currentUser.id]);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return otherUsers;
    const q = searchQuery.toLowerCase();
    return otherUsers.filter(u => u.name.toLowerCase().includes(q));
  }, [otherUsers, searchQuery]);

  // Get last message for a project
  const getLastMessage = (projectId: string) => {
    const projectMessages = messages.filter(m => m.projectId === projectId);
    return projectMessages[projectMessages.length - 1];
  };

  // Get message count for a project
  const getMessageCount = (projectId: string) => {
    return messages.filter(m => m.projectId === projectId).length;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Chat</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Project conversations and direct messages
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Chat List Sidebar */}
        <Card className="shadow-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'projects' | 'direct')}>
            <TabsList className="w-full rounded-none border-b border-border bg-transparent p-0">
              <TabsTrigger 
                value="projects" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
              >
                <FolderKanban className="w-4 h-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger 
                value="direct" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
              >
                <Users className="w-4 h-4" />
                Direct
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[500px]">
              <TabsContent value="projects" className="m-0">
                {filteredProjects.length === 0 ? (
                  <div className="p-6 text-center">
                    <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No projects found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredProjects.map((project) => {
                      const lastMessage = getLastMessage(project.id);
                      const messageCount = getMessageCount(project.id);
                      
                      return (
                        <Link
                          key={project.id}
                          to={`/projects/${project.id}?tab=chat`}
                          className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            {project.thumbnail ? (
                              <img 
                                src={project.thumbnail} 
                                alt={project.title}
                                className="w-full h-full rounded-lg object-cover"
                              />
                            ) : (
                              <FolderKanban className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-foreground truncate text-sm">
                                {project.title}
                              </p>
                              {lastMessage && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {formatTime(lastMessage.createdAt)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {project.client}
                            </p>
                            {lastMessage && (
                              <p className="text-xs text-muted-foreground truncate mt-1">
                                {lastMessage.content}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-3" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="direct" className="m-0">
                {filteredUsers.length === 0 ? (
                  <div className="p-6 text-center">
                    <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No users found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors group text-left"
                        onClick={() => {
                          // TODO: Open direct message
                        }}
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm">
                            {user.name}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {user.role.toLowerCase()}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Message
                        </Button>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </Card>

        {/* Placeholder for selected chat */}
        <Card className="shadow-card flex items-center justify-center min-h-[500px]">
          <div className="text-center p-8">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-foreground mb-2">Select a conversation</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a project chat from the list or start a direct message with a team member.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
