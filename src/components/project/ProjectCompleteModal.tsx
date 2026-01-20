import { Project } from '@/types/core';
import { useAppStore } from '@/stores/appStore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle2, Lock, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectCompleteModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  onConfirm: () => void;
}

export function ProjectCompleteModal({ open, onClose, project, onConfirm }: ProjectCompleteModalProps) {
  const { getUserById } = useAppStore();
  
  const teamMembers = (project.teamMemberIds || [])
    .map((id) => getUserById(id))
    .filter(Boolean);

  const handleConfirm = () => {
    onConfirm();
    
    // Show success toast with actions taken
    toast.success('Project Completed', {
      description: 'Feedback requests sent to all team members.',
      duration: 5000,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Complete Project
          </DialogTitle>
          <DialogDescription>
            This action will finalize the project and trigger peer feedback requests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Info */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{project.title}</p>
                <p className="text-sm text-muted-foreground">{project.client}</p>
              </div>
              {project.priority && (
                <Badge variant="secondary" className="text-xs">
                  {project.priority}
                </Badge>
              )}
            </div>
          </div>

          {/* What will happen */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">This will:</p>
            
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Lock Tasks & Editing</p>
                  <p className="text-xs text-muted-foreground">
                    All tasks will be marked as read-only
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Mail className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Request Peer Feedback</p>
                  <p className="text-xs text-muted-foreground">
                    Feedback requests will be sent to {teamMembers.length} team members
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Team Members */}
          {teamMembers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Feedback Recipients
              </p>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((member) => (
                  <div
                    key={member!.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted"
                  >
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                        {member!.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">
                      {member!.name}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      Pending
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              This action cannot be undone. Make sure all tasks are completed before proceeding.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Complete Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
