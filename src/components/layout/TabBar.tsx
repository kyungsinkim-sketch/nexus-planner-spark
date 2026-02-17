/**
 * TabBar — Bottom navigation bar with Chrome-style project tabs.
 *
 * Left side: project tabs (Dashboard pinned + active projects)
 * Right side: Admin, Settings, Theme toggle, Language toggle, User status
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import {
  X,
  LayoutDashboard,
  Crown,
  Settings,
  Moon,
  Sun,
  Languages,
  Building2,
  Coffee,
  Dumbbell,
  LogOut,
  Check,
  Home as HomeIcon,
  Plane,
  Film,
  MapPinned,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { UserWorkStatus } from '@/types/core';
import { TranslationKey } from '@/lib/i18n';
import { toast } from 'sonner';

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

export function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, toggleLanguage } = useTranslation();
  const { openTabs, activeTabId, setActiveTab, closeProjectTab } = useWidgetStore();
  const {
    currentUser,
    userWorkStatus,
    setUserWorkStatus,
    signOut,
    theme,
    toggleTheme,
  } = useAppStore();
  const isAdmin = currentUser?.role === 'ADMIN';
  const currentStatus = workStatusConfig[userWorkStatus];
  const isDark = theme === 'dark';
  // Whether we're on a sub-route (admin, settings, budget, deposits)
  const isOnSubRoute = location.pathname !== '/';

  return (
    <div className="glass-tabbar flex items-stretch h-12 px-2 gap-1 shrink-0 z-30">
      {/* === Left: Project Tabs === */}
      <div className="flex items-stretch gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
        {openTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isDashboard = tab.type === 'dashboard';

          return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Navigate to root when: clicking dashboard, or when on a sub-route (admin/settings/budget)
                  if (isDashboard || isOnSubRoute) navigate('/');
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 text-xs font-medium transition-all min-w-0 max-w-[180px] shrink-0 relative',
                  isActive && !isDashboard
                    ? 'text-white rounded-b-[var(--widget-radius)] rounded-t-none'
                    : isActive && isDashboard
                      ? 'text-foreground rounded-b-[var(--widget-radius)] rounded-t-none'
                      : 'text-muted-foreground hover:bg-white/8 hover:text-foreground rounded-lg',
                )}
                style={
                  isActive && !isDashboard && tab.keyColor
                    ? { backgroundColor: `${tab.keyColor}e6` }
                    : isActive && isDashboard
                      ? { backgroundColor: isDark ? 'hsl(222 47% 12%)' : 'hsl(220 20% 91%)' }
                      : undefined
                }
              >
                {isDashboard ? (
                  <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <div
                    className={cn('w-2.5 h-2.5 rounded-full shrink-0', isActive && 'bg-white/40')}
                    style={!isActive ? { backgroundColor: tab.keyColor || 'hsl(234 89% 60%)' } : undefined}
                  />
                )}
                <span className="truncate">{isDashboard ? t('dashboard') : tab.label}</span>
                {!isDashboard && (
                  <button
                    onClick={(e) => { e.stopPropagation(); closeProjectTab(tab.id); }}
                    className={cn(
                      'p-0.5 rounded transition-colors ml-0.5 shrink-0',
                      isActive ? 'hover:bg-white/30' : 'hover:bg-white/20',
                    )}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </button>
            );
        })}
      </div>

      {/* === Right: Controls === */}
      <div className="flex items-center gap-1 shrink-0 ml-2 self-center">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          title={theme === 'dark' ? t('lightMode') : t('darkMode')}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Language toggle */}
        <button
          onClick={toggleLanguage}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors text-[10px] font-bold min-w-[28px]"
          title={language === 'ko' ? 'Switch to English' : '한국어로 전환'}
        >
          {language === 'ko' ? 'EN' : 'KO'}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Admin */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            title="Admin"
          >
            <Crown className="w-4 h-4" />
          </button>
        )}

        {/* Settings */}
        <button
          onClick={() => navigate('/settings')}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          title={t('settings')}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* User Profile + Status */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
              <div className="relative">
                <Avatar className="w-6 h-6">
                  {currentUser?.avatar && (
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                  )}
                  <AvatarFallback className="bg-primary text-primary-foreground text-[9px]">
                    {currentUser?.name.split(' ').map(n => n[0]).join('') || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background',
                  userWorkStatus === 'AT_WORK' && 'bg-emerald-500',
                  userWorkStatus === 'REMOTE' && 'bg-blue-500',
                  userWorkStatus === 'OVERSEAS' && 'bg-violet-500',
                  userWorkStatus === 'FILMING' && 'bg-orange-500',
                  userWorkStatus === 'FIELD' && 'bg-teal-500',
                  userWorkStatus === 'NOT_AT_WORK' && 'bg-muted-foreground',
                  userWorkStatus === 'LUNCH' && 'bg-amber-500',
                  userWorkStatus === 'TRAINING' && 'bg-pink-500',
                )} />
              </div>
              <div className="text-left hidden xl:block">
                <p className="text-[10px] font-medium text-foreground leading-tight truncate max-w-[80px]">
                  {currentUser?.name}
                </p>
                <p className={cn('text-[9px] leading-tight', currentStatus.colorClass)}>
                  {t(currentStatus.labelKey)}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-56">
            <DropdownMenuLabel>{t('setStatus')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(workStatusConfig) as UserWorkStatus[]).map((status) => {
              const config = workStatusConfig[status];
              const Icon = config.icon;
              const isSelected = userWorkStatus === status;
              return (
                <DropdownMenuItem key={status} onClick={() => setUserWorkStatus(status)} className="gap-3">
                  <Icon className={cn('w-4 h-4', config.colorClass)} />
                  <span className="flex-1">{t(config.labelKey)}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                try { await signOut(); toast.success(t('loggedOut')); }
                catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Failed to log out'); }
              }}
              className="gap-3 text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('logOut')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
