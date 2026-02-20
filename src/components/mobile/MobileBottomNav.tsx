/**
 * MobileBottomNav — 모바일 하단 네비게이션 바
 *
 * 4개 탭: 대시보드, 프로젝트, 캘린더, 더보기(설정)
 * widgetStore와 연동하여 프로젝트 탭 전환
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Home,
  FolderKanban,
  Calendar,
  MoreHorizontal,
  Settings,
  Crown,
  Moon,
  Sun,
  Languages,
  LogOut,
  Download,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveTab } = useWidgetStore();
  const {
    currentUser,
    theme,
    toggleTheme,
    signOut,
  } = useAppStore();
  const { t, language, toggleLanguage } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const isSubRoute = location.pathname !== '/';

  const handleDashboard = () => {
    setActiveTab('dashboard');
    if (isSubRoute) navigate('/');
  };

  const handleCalendar = () => {
    // Navigate to calendar — just switch to dashboard with calendar focus
    setActiveTab('dashboard');
    if (isSubRoute) navigate('/');
  };

  return (
    <>
      {/* Bottom Nav Bar */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-2 py-1.5">
          {/* Dashboard */}
          <button
            onClick={handleDashboard}
            className={cn(
              'flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors min-w-[56px]',
              !isSubRoute && location.pathname === '/'
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t('dashboard')}</span>
          </button>

          {/* Projects - placeholder, dashboard already shows projects */}
          <button
            onClick={() => {
              setActiveTab('dashboard');
              if (isSubRoute) navigate('/');
            }}
            className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors min-w-[56px] text-muted-foreground"
          >
            <FolderKanban className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t('projects')}</span>
          </button>

          {/* Calendar */}
          <button
            onClick={handleCalendar}
            className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors min-w-[56px] text-muted-foreground"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t('calendar')}</span>
          </button>

          {/* More (Sheet) */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-colors min-w-[56px] text-muted-foreground">
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-[10px] font-medium">
                  {language === 'ko' ? '더보기' : 'More'}
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {currentUser?.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-left text-sm">{currentUser?.name}</SheetTitle>
                    <p className="text-xs text-muted-foreground">{currentUser?.role}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-1 pb-6">
                {/* Admin */}
                {isAdmin && (
                  <button
                    onClick={() => { navigate('/admin'); setMoreOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <Crown className="w-5 h-5 text-amber-500" />
                    <span className="text-sm font-medium">{t('admin')}</span>
                  </button>
                )}

                {/* Settings */}
                <button
                  onClick={() => { navigate('/settings'); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('settings')}</span>
                </button>

                <Separator />

                {/* Theme */}
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
                    <span className="text-sm">{theme === 'dark' ? t('darkMode') : t('lightMode')}</span>
                  </div>
                </button>

                {/* Language */}
                <button
                  onClick={toggleLanguage}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Languages className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm">{language === 'ko' ? '한국어' : 'English'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-bold">
                    {language === 'ko' ? 'EN' : 'KO'}
                  </span>
                </button>

                <Separator />

                {/* Sign Out */}
                <button
                  onClick={async () => {
                    try {
                      await signOut();
                      setMoreOpen(false);
                      toast.success(t('loggedOut'));
                    } catch (error: unknown) {
                      toast.error(error instanceof Error ? error.message : 'Failed');
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 transition-colors text-destructive"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('logOut')}</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}

export default MobileBottomNav;
