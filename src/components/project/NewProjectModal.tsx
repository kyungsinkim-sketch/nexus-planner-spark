import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectModal({ open, onOpenChange }: NewProjectModalProps) {
  const { users, addProject } = useAppStore();
  const [formData, setFormData] = useState({
    title: '',
    client: '',
    description: '',
    type: 'EXECUTION' as 'BIDDING' | 'EXECUTION',
    priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
    startDate: '',
    endDate: '',
    budget: '',
    pmId: '',
    teamMemberIds: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newProject = {
      id: `p${Date.now()}`,
      title: formData.title,
      client: formData.client,
      description: formData.description,
      type: formData.type,
      priority: formData.priority,
      status: 'ACTIVE' as const,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      budget: parseInt(formData.budget) || 0,
      pmId: formData.pmId,
      teamMemberIds: formData.teamMemberIds,
      progress: 0,
      lastActivityAt: new Date().toISOString(),
      health: { schedule: 'ON_TRACK' as const, workload: 'BALANCED' as const, budget: 'HEALTHY' as const },
      milestones: [],
      tasksCompleted: 0,
      tasksTotal: 0,
    };

    addProject(newProject);
    onOpenChange(false);
    setFormData({
      title: '',
      client: '',
      description: '',
      type: 'EXECUTION',
      priority: 'MEDIUM',
      startDate: '',
      endDate: '',
      budget: '',
      pmId: '',
      teamMemberIds: [],
    });
  };

  const toggleTeamMember = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.includes(userId)
        ? prev.teamMemberIds.filter(id => id !== userId)
        : [...prev.teamMemberIds, userId],
    }));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new project
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input
                id="title"
                placeholder="Enter project title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Client *</Label>
              <Input
                id="client"
                placeholder="Enter client name"
                value={formData.client}
                onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief project description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Type & Priority */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Project Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'BIDDING' | 'EXECUTION') => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIDDING">Bidding</SelectItem>
                  <SelectItem value="EXECUTION">Execution</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'HIGH' | 'MEDIUM' | 'LOW') => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates & Budget */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget (KRW)</Label>
              <Input
                id="budget"
                type="number"
                placeholder="500000000"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
              />
            </div>
          </div>

          {/* PM Selection */}
          <div className="space-y-2">
            <Label>Project Manager</Label>
            <Select
              value={formData.pmId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, pmId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select PM" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      {user.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team Members */}
          <div className="space-y-3">
            <Label>Team Members</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleTeamMember(user.id)}
                >
                  <Checkbox
                    checked={formData.teamMemberIds.includes(user.id)}
                    onCheckedChange={() => toggleTeamMember(user.id)}
                  />
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate">{user.name}</span>
                </div>
              ))}
            </div>
            {formData.teamMemberIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.teamMemberIds.map((id) => {
                  const user = users.find(u => u.id === id);
                  if (!user) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                    >
                      {user.name}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTeamMember(id);
                        }}
                        className="hover:bg-primary/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
