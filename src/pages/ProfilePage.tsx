import { useAppStore } from '@/stores/appStore';
import { Camera } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PerformanceSection, PortfolioSection } from '@/components/profile';
import { Trophy, Briefcase } from 'lucide-react';

export default function ProfilePage() {
  const { currentUser, getPortfolioByUser } = useAppStore();
  const portfolioItems = getPortfolioByUser(currentUser.id);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your performance and portfolio
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Profile Card */}
        <Card className="p-6 shadow-card h-fit">
          <div className="text-center">
            <div className="relative inline-block">
              <Avatar className="w-24 h-24 mx-auto">
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors">
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <h2 className="font-semibold text-lg text-foreground mt-4">
              {currentUser.name}
            </h2>
            <Badge variant="secondary" className="mt-2">
              {currentUser.role}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              paul@paulus.ai
            </p>
          </div>
          
          <Separator className="my-6" />
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member since</span>
              <span className="text-foreground">Jan 2024</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed Projects</span>
              <span className="text-foreground">{portfolioItems.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Score</span>
              <span className="font-semibold text-primary">91</span>
            </div>
          </div>
        </Card>

        {/* Performance & Portfolio Tabs */}
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance" className="gap-2">
              <Trophy className="w-4 h-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="gap-2">
              <Briefcase className="w-4 h-4" />
              Portfolio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance">
            <PerformanceSection />
          </TabsContent>

          <TabsContent value="portfolio">
            <PortfolioSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}