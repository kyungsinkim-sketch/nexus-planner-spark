import { useState } from 'react';
import { ProjectTask } from '@/types/core';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserSearchInput } from '@/components/ui/user-search-input';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function NewTaskModal({ 
  open, 
  onClose, 
  projectId,
}: NewTaskModalProps) {
  const { currentUser, users } = useAppStore();
  
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    // For now, just show success (actual task creation would be in store)
    toast.success('Task created', {
      description: `"${title}" added to project`,
    });

    // Reset form
    setTitle('');
    setAssigneeId(undefined);
    setDueDate('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>
            Create a new task for this project.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              autoFocus
            />
          </div>

          {/* Assignee */}
          <div className="space-y-2">
            <Label>Assignee (Optional)</Label>
            <UserSearchInput
              users={users}
              selectedUserId={assigneeId}
              onSelectById={setAssigneeId}
              placeholder="Search for assignee..."
            />
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (Optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
