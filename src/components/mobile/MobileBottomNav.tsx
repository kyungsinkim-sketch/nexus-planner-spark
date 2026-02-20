/**
 * MobileBottomNav — 모바일 하단 네비게이션 바
 *
 * 5개 탭: 대시보드, 채팅, 캘린더, 프로젝트, 더보기(설정)
 * widgetStore.mobileView와 연동
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Home,
  MessageSquare,
  Calendar,
  FolderKanban,
  MoreHorizontal,
  Settings,
  Crown,
  Moon,
  Sun,
  Languages,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mobileView, setMobileView, setActiveTab, activeTabId } = useWidgetStore();
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

  // Determine which tab is active
  const isDashboardActive = !isSubRoute && mobileView === 'dashboard' && activeTabId === 'dashboard';
  const isChatActive = !isSubRoute && mobileView === 'chat';
  const isCalendarActive = !isSubRoute && mobileView === 'calendar';

  const handleDashboard = () => {
    setActiveTab('dashboard');
    setMobileView('dashboard');
    if (isSubRoute) navigate('/');
  };

  const handleChat = () => {
    setMobileView('chat');
    setActiveTab('dashboard');
    if (isSubRoute) navigate('/');
  };

  const handleCalendar = () => {
    setMobileView('calendar');
    setActiveTab('dashboard');
    if (isSubRoute) navigate('/');
  };

  const handleProjects = () => {
    setActiveTab('dashboard');
    setMobileView('dashboard');
    if (isSubRoute) navigate('/');
  };

  return (
    <>
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-1 py-1">
          {/* Dashboard */}
          <button
            onClick={handleDashboard}
            className={cn(
              'flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors min-w-0 flex-1',
              isDashboardActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-[9px] font-medium truncate">{t('dashboard')}</span>
          </button>

          {/* Chat */}
          <button
            onClick={handleChat}
            className={cn(
              'flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors min-w-0 flex-1',
              isChatActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[9px] font-medium truncate">
              {language === 'ko' ? '채팅' : 'Chat'}
            </span>
          </button>

          {/* Calendar */}
          <button
            onClick={handleCalendar}
            className={cn(
              'flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors min-w-0 flex-1',
              isCalendarActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[9px] font-medium truncate">{t('calendar')}</span>
          </button>

          {/* Projects */}
          <button
            onClick={handleProjects}
            className="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors min-w-0 flex-1 text-muted-foreground"
          >
            <FolderKanban className="w-5 h-5" />
            <span className="text-[9px] font-medium truncate">{t('projects')}</span>
          </button>

          {/* More (Sheet) */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition-colors min-w-0 flex-1 text-muted-foreground">
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-[9px] font-medium truncate">
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
                {isAdmin && (
                  <button
                    onClick={() => { navigate('/admin'); setMoreOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <Crown className="w-5 h-5 text-amber-500" />
                    <span className="text-sm font-medium">{t('admin')}</span>
                  </button>
                )}

                <button
                  onClick={() => { navigate('/settings'); setMoreOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('settings')}</span>
                </button>

                <Separator />

                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
                    <span className="text-sm">{theme === 'dark' ? t('darkMode') : t('lightMode')}</span>
                  </div>
                </button>

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
