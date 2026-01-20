import { useAppStore } from '@/stores/appStore';
import { 
  Users, 
  FolderKanban, 
  Calendar, 
  FileText, 
  TrendingUp,
  UserPlus,
  Settings,
  Shield,
  BarChart3
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminPage() {
  const { users, projects, events } = useAppStore();

  const stats = [
    { 
      label: 'Total Users', 
      value: users.length, 
      icon: Users,
      change: '+2 this month',
      color: 'text-primary'
    },
    { 
      label: 'Active Projects', 
      value: projects.filter(p => p.status === 'ACTIVE').length, 
      icon: FolderKanban,
      change: '3 starting soon',
      color: 'text-emerald-500'
    },
    { 
      label: 'Events This Week', 
      value: events.length, 
      icon: Calendar,
      change: '5 deadlines',
      color: 'text-violet-500'
    },
    { 
      label: 'Files Uploaded', 
      value: '127',
      icon: FileText,
      change: '+12 today',
      color: 'text-orange-500'
    },
  ];

  const roleColors = {
    ADMIN: 'bg-destructive/10 text-destructive',
    MANAGER: 'bg-primary/10 text-primary',
    MEMBER: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage users, settings, and system configuration
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-semibold text-foreground mt-1">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Shield className="w-4 h-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="shadow-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-foreground">Team Members</h3>
              <p className="text-sm text-muted-foreground">{users.length} users total</p>
            </div>
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-sm text-muted-foreground">user@paulus.ai</p>
                  </div>
                  <Badge variant="secondary" className={roleColors[user.role]}>
                    {user.role}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <Card className="p-6 shadow-card">
            <div className="text-center py-8">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium text-foreground mb-1">Role Management</h3>
              <p className="text-sm text-muted-foreground">
                Configure user permissions and access levels
              </p>
              <p className="text-xs text-muted-foreground mt-4 italic">
                (Placeholder - Backend integration required)
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card className="p-6 shadow-card">
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium text-foreground mb-1">Usage Analytics</h3>
              <p className="text-sm text-muted-foreground">
                View detailed usage statistics and reports
              </p>
              <p className="text-xs text-muted-foreground mt-4 italic">
                (Placeholder - Backend integration required)
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="p-6 shadow-card">
            <div className="text-center py-8">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium text-foreground mb-1">System Settings</h3>
              <p className="text-sm text-muted-foreground">
                Configure application settings and preferences
              </p>
              <p className="text-xs text-muted-foreground mt-4 italic">
                (Placeholder - Backend integration required)
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
