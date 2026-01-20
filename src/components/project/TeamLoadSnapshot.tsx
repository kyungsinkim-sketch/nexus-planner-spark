import { Project, User } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TeamLoadSnapshotProps {
  project: Project;
}

interface TeamMemberLoad {
  user: User;
  expectedRate: number; // Expected contribution rate from contributions
  actualLoad: number; // Mock actual load calculation
  isOverloaded: boolean;
}

export function TeamLoadSnapshot({ project }: TeamLoadSnapshotProps) {
  const { getUserById, getContributionsByProject, currentUser } = useAppStore();
  
  // Only show for admins
  if (currentUser.role !== 'ADMIN') return null;

  const contributions = getContributionsByProject(project.id);
  
  // Get team members with their load data
  const teamMembers: TeamMemberLoad[] = (project.teamMemberIds || [])
    .map((userId) => {
      const user = getUserById(userId);
      if (!user) return null;
      
      const contribution = contributions.find((c) => c.userId === userId);
      const expectedRate = contribution?.contributionRate || 0.25; // Default 25%
      
      // Mock actual load calculation (in real app, would come from actual hours/tasks)
      const actualLoad = Math.min(1, expectedRate + (Math.random() * 0.3 - 0.15));
      const isOverloaded = actualLoad > 0.85;
      
      return {
        user,
        expectedRate,
        actualLoad,
        isOverloaded,
      };
    })
    .filter(Boolean) as TeamMemberLoad[];

  if (teamMembers.length === 0) return null;

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Team Load Snapshot</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Admin Only</span>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TooltipProvider>
          {teamMembers.map((member) => (
            <div key={member.user.id} className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/50">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative mb-2">
                    <Avatar className="w-12 h-12 border-2 border-background">
                      <AvatarFallback className={`text-sm font-medium ${
                        member.isOverloaded 
                          ? 'bg-destructive/20 text-destructive' 
                          : 'bg-primary/20 text-primary'
                      }`}>
                        {member.user.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    {/* Status dot */}
                    <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background ${
                      member.isOverloaded 
                        ? 'bg-destructive' 
                        : 'bg-emerald-500'
                    }`} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{member.isOverloaded ? 'Overloaded' : 'Normal workload'}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(member.actualLoad * 100)}% capacity
                  </p>
                </TooltipContent>
              </Tooltip>
              
              <p className="text-sm font-medium text-foreground mb-1 truncate w-full">
                {member.user.name.split(' ')[0]}
              </p>
              
              {/* Workload Progress */}
              <div className="w-full">
                <Progress 
                  value={member.actualLoad * 100} 
                  className={`h-2 ${member.isOverloaded ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(member.expectedRate * 100)}% expected
                </p>
              </div>
            </div>
          ))}
        </TooltipProvider>
      </div>
    </Card>
  );
}
