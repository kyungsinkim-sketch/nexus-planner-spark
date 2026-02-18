/**
 * EnhancedMobileNav
 * PWA 최적화된 모바일 네비게이션 - Safe Area, 설치 프롬프트 포함
 * 다크모드 토글, 8종 근무상태, 언어전환, 로그아웃 포함
 */

import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
import {
  Home,
  Calendar,
  FolderKanban,
  Crown,
  Menu,
  Sparkles,
  Download,
  Check,
  Moon,
  Sun,
  Languages,
  Building2,
  Home as HomeIcon,
  Plane,
  Film,
  MapPinned,
  Coffee,
  Dumbbell,
  LogOut,
  Plus,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/i18n';
import { AttendanceWidget } from '@/components/dashboard/AttendanceWidget';
import type { UserWorkStatus } from '@/types/core';
import { toast } from 'sonner';

// Work status config - matches Sidebar
const workStatusConfig: Record<UserWorkStatus, { labelKey: TranslationKey; icon: typeof Building2; colorClass: string }> = {
  AT_WORK: { labelKey: 'statusOffice', icon: Building2, colorClass: 'text-emerald-500' },
  REMOTE: { labelKey: 'statusRemote', icon: HomeIcon, colorClass: 'text-blue-500' },
  OVERSEAS: { labelKey: 'statusOverseas', icon: Plane, colorClass: 'text-violet-500' },
  FILMING: { labelKey: 'statusFilming', icon: Film, colorClass: 'text-orange-500' },
  FIELD: { labelKey: 'statusField', icon: MapPinned, colorClass: 'text-teal-500' },
  LUNCH: { labelKey: 'statusLunch', icon: Coffee, colorClass: 'text-amber-500' },
  TRAINING: { labelKey: 'statusTraining', icon: Dumbbell, colorClass: 'text-pink-500' },
  NOT_AT_WORK: { labelKey: 'statusOffline', icon: LogOut, colorClass: 'text-muted-foreground' },
};

// Check if running as installed PWA
const isPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
};

export function EnhancedMobileNav() {
  const { currentUser, userWorkStatus, setUserWorkStatus, theme, toggleTheme, signOut, setTodoCreateDialogOpen, setProjectCreateDialogOpen } = useAppStore();
  const location = useLocation();
  const { t, language, toggleLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isPWA());

  // Listen for PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!isInstalled) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  // Action for + button per tab
  const handlePlusAction = (path: string) => {
    if (path === '/projects') setProjectCreateDialogOpen(true);
    else if (path === '/' || path === '/calendar') setTodoCreateDialogOpen(true);
  };

  const navItems = [
    { path: '/', icon: Home, labelKey: 'dashboard' as const, visible: true, pro: false, hasPlus: true },
    { path: '/projects', icon: FolderKanban, labelKey: 'projects' as const, visible: true, pro: false, hasPlus: true },
    { path: '/calendar', icon: Calendar, labelKey: 'calendar' as const, visible: true, pro: false, hasPlus: true },
    { path: '/admin', icon: Crown, labelKey: 'admin' as const, visible: currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER', pro: true, hasPlus: false },
  ].filter(item => item.visible);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const currentStatus = workStatusConfig[userWorkStatus];
  const StatusIcon = currentStatus.icon;

  return (
    <>
      {/* Mobile Header with safe area */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold">Re-Be.io</span>
            {isInstalled && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                App
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* PWA Install Button */}
            {showInstallPrompt && !isInstalled && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleInstall}
              >
                <Download className="w-3.5 h-3.5" />
                {t('installApp')}
              </Button>
            )}

            {/* Quick Dark Mode Toggle in Header */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="w-9 h-9"
            >
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0 flex flex-col">
                <SheetHeader className="p-6 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                          {currentUser ? getInitials(currentUser.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      {/* Status indicator dot */}
                      <div className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background',
                        currentStatus.colorClass.replace('text-', 'bg-')
                      )} />
                    </div>
                    <div className="flex-1 text-left">
                      <SheetTitle className="text-base">{currentUser?.name || ''}</SheetTitle>
                      <p className={cn('text-xs', currentStatus.colorClass)}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {t(currentStatus.labelKey)}
                      </p>
                    </div>
                  </div>
                </SheetHeader>

                {/* Work Status Selection */}
                <div className="p-4 border-b">
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('workStatus')}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(workStatusConfig) as UserWorkStatus[]).map((status) => {
                      const config = workStatusConfig[status];
                      const Icon = config.icon;
                      const isSelected = userWorkStatus === status;

                      return (
                        <button
                          key={status}
                          onClick={() => setUserWorkStatus(status)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                            isSelected
                              ? 'bg-primary/10 ring-1 ring-primary/30'
                              : 'hover:bg-accent'
                          )}
                        >
                          <Icon className={cn('w-4 h-4 shrink-0', config.colorClass)} />
                          <span className={cn(
                            'text-xs truncate',
                            isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'
                          )}>
                            {t(config.labelKey)}
                          </span>
                          {isSelected && <Check className="w-3 h-3 text-primary ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Attendance in Drawer */}
                <div className="p-4 border-b">
                  <AttendanceWidget />
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2 px-4">{t('menu')}</p>
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path ||
                      (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent text-foreground'
                        )}
                      >
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium flex-1">{t(item.labelKey)}</span>
                        {item.pro && (
                          <span className={cn(
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                            isActive ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-600"
                          )}>
                            Pro
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </nav>

                {/* Bottom Section: Theme, Language, Sign Out */}
                <div className="border-t p-4 space-y-2">
                  {/* Dark Mode Toggle */}
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-sm text-foreground">{theme === 'dark' ? t('darkMode') : t('lightMode')}</span>
                    </div>
                    <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted border border-border">
                      <div
                        className={cn(
                          'absolute h-4 w-4 rounded-full bg-primary transition-transform duration-200 ease-in-out flex items-center justify-center',
                          theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-1'
                        )}
                      >
                        {theme === 'dark' ? <Moon className="w-2.5 h-2.5 text-white" /> : <Sun className="w-2.5 h-2.5 text-white" />}
                      </div>
                    </div>
                  </button>

                  {/* Language Toggle */}
                  <button
                    onClick={toggleLanguage}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Languages className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{language === 'ko' ? t('korean') : t('english')}</span>
                    </div>
                    <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted border border-border">
                      <div
                        className={cn(
                          'absolute h-4 w-4 rounded-full bg-primary transition-transform duration-200 ease-in-out flex items-center justify-center',
                          language === 'en' ? 'translate-x-[22px]' : 'translate-x-1'
                        )}
                      >
                        <span className="text-[7px] font-bold text-white">
                          {language === 'ko' ? 'KO' : 'EN'}
                        </span>
                      </div>
                    </div>
                  </button>

                  <Separator />

                  {/* Sign Out */}
                  <button
                    onClick={async () => {
                      try {
                        await signOut();
                        setOpen(false);
                        toast.success(t('loggedOut'));
                      } catch (error: unknown) {
                        toast.error(error instanceof Error ? error.message : t('logoutFailed'));
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-medium">{t('logOut')}</span>
                  </button>

                  {/* App Info */}
                  {isInstalled && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground px-4 pt-1">
                      <Check className="w-3 h-3 text-emerald-500" />
                      {t('installedAsApp')}
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation with safe area */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.slice(0, 4).map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <div key={item.path} className="flex items-center gap-0.5">
                <NavLink
                  to={item.path}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 px-2 rounded-lg transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
                  <span className="text-[10px] font-medium truncate text-center">
                    {t(item.labelKey)}
                  </span>
                </NavLink>
                {/* + button next to active tab */}
                {isActive && item.hasPlus && (
                  <button
                    onClick={() => handlePlusAction(item.path)}
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors -ml-0.5"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Spacers for fixed headers - with safe area consideration */}
      <div className="lg:hidden h-14" style={{ marginTop: 'env(safe-area-inset-top)' }} />
    </>
  );
}

export default EnhancedMobileNav;
