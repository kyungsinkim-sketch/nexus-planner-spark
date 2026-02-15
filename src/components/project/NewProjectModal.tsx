import { useState, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Currency, User } from '@/types/core';
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
import { CurrencyInput } from '@/components/ui/currency-input';
import { UserSearchInput } from '@/components/ui/user-search-input';
import { Upload, X, Image, Loader2 } from 'lucide-react';

import { toast } from 'sonner';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectModal({ open, onOpenChange }: NewProjectModalProps) {
  const { users, addProject, currentUser } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    client: '',
    description: '',
    type: 'EXECUTION' as 'BIDDING' | 'EXECUTION',
    priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
    startDate: '',
    endDate: '',
    budget: '',
    currency: 'KRW' as Currency,
    pmId: '',
    teamMemberIds: [] as string[],
    thumbnail: '' as string,
  });

  const selectedPM = users.find(u => u.id === formData.pmId);
  const selectedTeamMembers = users.filter(u => formData.teamMemberIds.includes(u.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Ensure creator is included in team members
      let finalTeamMemberIds = [...formData.teamMemberIds];
      if (currentUser && !finalTeamMemberIds.includes(currentUser.id)) {
        finalTeamMemberIds = [currentUser.id, ...finalTeamMemberIds];
      }
      // Also include PM if set
      if (formData.pmId && !finalTeamMemberIds.includes(formData.pmId)) {
        finalTeamMemberIds = [formData.pmId, ...finalTeamMemberIds];
      }

      const newProject = {
        title: formData.title,
        client: formData.client,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        status: 'ACTIVE' as const,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        budget: parseInt(formData.budget) || 0,
        currency: formData.currency,
        pmId: formData.pmId || (currentUser?.id ?? ''),
        teamMemberIds: finalTeamMemberIds,
        progress: 0,
        lastActivityAt: new Date().toISOString(),
        health: { schedule: 'ON_TRACK' as const, workload: 'BALANCED' as const, budget: 'HEALTHY' as const },
        tasksCompleted: 0,
        tasksTotal: 0,
        thumbnail: formData.thumbnail,
      };

      await addProject(newProject);
      toast.success('프로젝트가 생성되었습니다');
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
        currency: 'KRW',
        pmId: '',
        teamMemberIds: [],
        thumbnail: '',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '프로젝트 생성 실패';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPM = (user: User) => {
    setFormData(prev => ({ ...prev, pmId: user.id }));
  };

  const handleRemovePM = () => {
    setFormData(prev => ({ ...prev, pmId: '' }));
  };

  const handleSelectTeamMember = (user: User) => {
    setFormData(prev => ({
      ...prev,
      teamMemberIds: [...prev.teamMemberIds, user.id],
    }));
  };

  const handleRemoveTeamMember = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.filter(id => id !== userId),
    }));
  };

  const [isUploadingThumb, setIsUploadingThumb] = useState(false);

  const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isSupabaseConfigured()) {
      setIsUploadingThumb(true);
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const filePath = `thumbnails/new_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('project-files')
          .getPublicUrl(filePath);

        setFormData(prev => ({ ...prev, thumbnail: urlData.publicUrl }));
      } catch (err) {
        console.error('Thumbnail upload failed:', err);
        toast.error('이미지 업로드에 실패했습니다');
      } finally {
        setIsUploadingThumb(false);
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, thumbnail: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeThumbnail = () => {
    setFormData(prev => ({ ...prev, thumbnail: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          {/* Thumbnail Upload */}
          <div className="space-y-2">
            <Label>Project Thumbnail</Label>
            <div className="flex items-start gap-4">
              {formData.thumbnail ? (
                <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-border">
                  <img
                    src={formData.thumbnail}
                    alt="Project thumbnail"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeThumbnail}
                    className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingThumb}
                  className="w-32 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {isUploadingThumb ? (
                    <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                  ) : (
                    <Image className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {isUploadingThumb ? 'Uploading...' : 'Upload'}
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailChange}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground flex-1">
                Recommended: 16:9 aspect ratio, max 2MB. This will be displayed on the Projects page.
              </p>
            </div>
          </div>

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="space-y-2 lg:col-span-1 sm:col-span-2">
              <Label>Budget</Label>
              <CurrencyInput
                value={formData.budget}
                currency={formData.currency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, budget: value }))}
                onCurrencyChange={(currency) => setFormData(prev => ({ ...prev, currency }))}
              />
            </div>
          </div>

          {/* PM Selection */}
          <div className="space-y-2">
            <Label>Project Manager</Label>
            <UserSearchInput
              users={users}
              selectedUser={selectedPM}
              onSelect={handleSelectPM}
              onRemove={handleRemovePM}
              placeholder="Type a name to search..."
            />
          </div>

          {/* Team Members */}
          <div className="space-y-2">
            <Label>Team Members</Label>
            <UserSearchInput
              users={users}
              selectedUsers={selectedTeamMembers}
              onSelect={handleSelectTeamMember}
              onRemove={handleRemoveTeamMember}
              placeholder="Type a name to add team member..."
              multiple
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '생성 중...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
