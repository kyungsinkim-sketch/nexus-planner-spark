import { useState } from 'react';
import { Project } from '@/types/core';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Building2, Clock, CheckCircle2 } from 'lucide-react';

interface OverviewTabProps {
  project: Project;
  onCompleteProject?: () => void;
}

export function OverviewTab({ project, onCompleteProject }: OverviewTabProps) {
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate total duration and elapsed days
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const today = new Date();
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const timeProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  const handleCompleteClick = () => {
    setShowCompleteModal(true);
  };

  const handleConfirmComplete = () => {
    onCompleteProject?.();
    setShowCompleteModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Project Info Card */}
      <Card className="p-6 shadow-card">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Project Information</h3>
            <p className="text-sm text-muted-foreground mt-1">Overview and key details</p>
          </div>
          <Badge 
            variant="secondary"
            className={project.status === 'ACTIVE' ? 'status-active' : 'status-completed'}
          >
            {project.status}
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Building2 className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Client</p>
              <p className="text-sm font-medium text-foreground">{project.client}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Calendar className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(project.startDate)} - {formatDate(project.endDate)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Clock className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-sm font-medium text-foreground">
                {remainingDays > 0 ? `${remainingDays} days left` : 'Overdue'}
              </p>
            </div>
          </div>
        </div>

        {project.description && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">Description</p>
            <p className="text-sm text-foreground mt-2">{project.description}</p>
          </div>
        )}
      </Card>

      {/* Progress Card */}
      <Card className="p-6 shadow-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Project Progress</h3>
            <p className="text-sm text-muted-foreground mt-1">Track completion status</p>
          </div>
          <span className="text-3xl font-bold text-primary">{project.progress || 0}%</span>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Completion Progress</span>
              <span className="font-medium text-foreground">{project.progress || 0}%</span>
            </div>
            <Progress value={project.progress || 0} className="h-2.5" />
          </div>

          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Timeline Progress</span>
              <span className="font-medium text-foreground">{Math.round(timeProgress)}%</span>
            </div>
            <Progress value={timeProgress} className="h-2.5 [&>div]:bg-emerald-500" />
          </div>
        </div>
      </Card>

      {/* Complete Project Button */}
      {project.status === 'ACTIVE' && (
        <Card className="p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Ready to Complete?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Mark this project as complete and request feedback
              </p>
            </div>
            <Button onClick={handleCompleteClick} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Project Complete
            </Button>
          </div>
        </Card>
      )}

      {/* Complete Project Modal */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Project</DialogTitle>
            <DialogDescription>
              This will mark the project as complete and request feedback from all participants.
              Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-foreground font-medium">{project.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{project.client}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmComplete}>
              Confirm Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
