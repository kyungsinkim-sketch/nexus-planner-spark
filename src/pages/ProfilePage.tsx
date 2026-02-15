import { useRef, useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Camera } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { PerformanceSection, PortfolioSection } from '@/components/profile';
import { Trophy, Briefcase, Settings } from 'lucide-react';
import { PasswordChangeForm } from '@/components/profile/PasswordChangeForm';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import * as authService from '@/services/authService';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { currentUser, getPortfolioByUser, setCurrentUser } = useAppStore();
  const portfolioItems = currentUser ? getPortfolioByUser(currentUser.id) : [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      if (isSupabaseConfigured()) {
        const fileExt = file.name.split('.').pop();
        const fileName = `avatars/${currentUser.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('project-files')
          .getPublicUrl(fileName);

        await authService.updateUserProfile(currentUser.id, { avatar: publicUrl });
        setCurrentUser({ ...currentUser, avatar: publicUrl });
        toast.success('Profile photo updated');
      } else {
        // Mock mode: use object URL
        const objectUrl = URL.createObjectURL(file);
        setCurrentUser({ ...currentUser, avatar: objectUrl });
        toast.success('Profile photo updated (mock mode)');
      }
    } catch (error) {
      console.error('Avatar upload failed:', error);
      const errMsg = error instanceof Error ? error.message : '';
      if (errMsg.includes('row-level security')) {
        toast.error('Upload permission denied. Please sign out and sign back in.');
      } else {
        toast.error('Failed to upload photo');
      }
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!currentUser) {
    return (
      <div className="page-container animate-fade-in">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('myProfile')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('yourPerformanceAndPortfolio')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Profile Card */}
        <Card className="p-6 shadow-card h-fit">
          <div className="text-center">
            <div className="relative inline-block">
              <Avatar className="w-24 h-24 mx-auto">
                {currentUser.avatar && (
                  <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                )}
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <span className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>
            <h2 className="font-semibold text-lg text-foreground mt-4">
              {currentUser.name}
            </h2>
            <Badge variant="secondary" className="mt-2">
              {currentUser.role}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              hello@re-be.io
            </p>
          </div>

          <Separator className="my-6" />

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('memberSince')}</span>
              <span className="text-foreground">Jan 2024</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('completedProjects')}</span>
              <span className="text-foreground">{portfolioItems.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('currentScore')}</span>
              <span className="font-semibold text-primary">91</span>
            </div>
          </div>
        </Card>

        {/* Performance & Portfolio Tabs */}
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance" className="gap-2">
              <Trophy className="w-4 h-4" />
              {t('performance')}
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="gap-2">
              <Briefcase className="w-4 h-4" />
              {t('portfolio')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance">
            <PerformanceSection />
          </TabsContent>

          <TabsContent value="portfolio">
            <PortfolioSection />
          </TabsContent>

          <TabsContent value="settings">
            <PasswordChangeForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
