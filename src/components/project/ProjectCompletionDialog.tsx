import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import type { Project, CompletionReview } from '@/types/core';
import { toast } from 'sonner';

interface ProjectCompletionDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectCompletionDialog({ project, open, onOpenChange }: ProjectCompletionDialogProps) {
  const { currentUser, updateProject, getUserById, users, peerFeedback } = useAppStore();
  const { t } = useTranslation();
  const [step, setStep] = useState<'url' | 'review'>('url');
  const [videoUrl, setVideoUrl] = useState(project.finalVideoUrl || '');
  const [reviews, setReviews] = useState<Record<string, { rating: number; comment: string }>>({});

  const teamMembers = (project.teamMemberIds || [])
    .filter(id => id !== currentUser?.id)
    .map(id => getUserById(id))
    .filter(Boolean);

  const isPM = currentUser?.id === project.pmId;

  const handleSubmitUrl = () => {
    if (!videoUrl.trim()) {
      toast.error(t('enterFinalVideoUrl'));
      return;
    }
    updateProject(project.id, {
      finalVideoUrl: videoUrl.trim(),
      completionApprovedBy: currentUser?.id,
    });
    toast.success(t('finalVideoUrlRegistered'));
    setStep('review');
  };

  const setRating = (userId: string, rating: number) => {
    setReviews(prev => ({
      ...prev,
      [userId]: { ...prev[userId], rating, comment: prev[userId]?.comment || '' },
    }));
  };

  const setComment = (userId: string, comment: string) => {
    setReviews(prev => ({
      ...prev,
      [userId]: { ...prev[userId], comment, rating: prev[userId]?.rating || 0 },
    }));
  };

  const handleSubmitReviews = () => {
    const validReviews = Object.entries(reviews).filter(([_, r]) => r.rating > 0);
    if (validReviews.length === 0) {
      toast.error(t('rateAtLeastOne'));
      return;
    }

    // Add reviews as peer feedback
    const { peerFeedback: existing } = useAppStore.getState();
    const newFeedback = validReviews.map(([userId, review]) => ({
      id: `cf_${Date.now()}_${userId}`,
      projectId: project.id,
      fromUserId: currentUser!.id,
      toUserId: userId,
      rating: review.rating,
      comment: review.comment || undefined,
      createdAt: new Date().toISOString(),
    }));

    useAppStore.setState({
      peerFeedback: [...existing, ...newFeedback],
    });

    // Mark project as COMPLETED
    updateProject(project.id, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      progress: 100,
      feedbackStatus: 'COMPLETED',
    });

    toast.success(t('projectCompleted'));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            {t('projectCompletion')}
          </DialogTitle>
          <DialogDescription>{project.title}</DialogDescription>
        </DialogHeader>

        {step === 'url' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('finalVideoPublicUrl')}</Label>
              <Input
                placeholder={t('videoUrlPlaceholder')}
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('videoUrlHelp')}
              </p>
            </div>
            {project.finalVideoUrl && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <ExternalLink className="w-4 h-4" />
                <a href={project.finalVideoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {t('viewRegisteredUrl')}
                </a>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
              <Button onClick={handleSubmitUrl} disabled={!videoUrl.trim()}>
                {t('registerUrlAndReview')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              {t('rateTeamMembers')}
            </p>
            {teamMembers.map((member) => {
              if (!member) return null;
              const review = reviews[member.id] || { rating: 0, comment: '' };
              return (
                <div key={member.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{member.name}</span>
                    <Badge variant="secondary" className="text-xs">{member.department}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(member.id, star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= review.rating
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      </button>
                    ))}
                    {review.rating > 0 && (
                      <span className="text-sm text-muted-foreground ml-2">{review.rating}/5</span>
                    )}
                  </div>
                  <Textarea
                    placeholder={t('commentOptional')}
                    value={review.comment}
                    onChange={(e) => setComment(member.id, e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              );
            })}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('url')}>{t('previous')}</Button>
              <Button onClick={handleSubmitReviews}>
                {t('completeReviewAndClose')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
