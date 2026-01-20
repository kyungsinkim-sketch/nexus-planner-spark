import { useAppStore } from '@/stores/appStore';
import { 
  Users, 
  FolderKanban, 
  Calendar, 
  FileText, 
  TrendingUp,
  Sliders,
  BarChart3
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductivityTab, ContributionTab, SettingsTab } from '@/components/admin';

export default function AdminPage() {
  const { users, projects, events, peerFeedback, projectContributions } = useAppStore();

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
      label: 'Feedback Records', 
      value: peerFeedback.length, 
      icon: TrendingUp,
      change: 'This period',
      color: 'text-violet-500'
    },
    { 
      label: 'Contribution Records', 
      value: projectContributions.length,
      icon: FileText,
      change: 'Tracked',
      color: 'text-orange-500'
    },
  ];

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Productivity evaluation, contributions, and settings
          </p>
        </div>
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
      <Tabs defaultValue="productivity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="productivity" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Productivity
          </TabsTrigger>
          <TabsTrigger value="contribution" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Contribution
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Sliders className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="productivity">
          <ProductivityTab />
        </TabsContent>

        <TabsContent value="contribution">
          <ContributionTab />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}