import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar,
  FolderKanban,
  User,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Crown,
  Inbox,
  MessageSquare,
  Building2,
  Coffee,
  Dumbbell,
  LogOut,
  Check,
  Languages,
  Moon,
  Sun,
  Home as HomeIcon,
  Plane,
  Film,
  MapPinned,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
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
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';

const workStatusConfig: Record<UserWorkStatus, { label: string; icon: typeof Building2; colorClass: string }> = {
  AT_WORK: { label: '사무실', icon: Building2, colorClass: 'text-emerald-500' },
  REMOTE: { label: '재택', icon: HomeIcon, colorClass: 'text-blue-500' },
  OVERSEAS: { label: '출장', icon: Plane, colorClass: 'text-violet-500' },
  FILMING: { label: '촬영중', icon: Film, colorClass: 'text-orange-500' },
  FIELD: { label: '현장', icon: MapPinned, colorClass: 'text-teal-500' },
  LUNCH: { label: '식사중', icon: Coffee, colorClass: 'text-amber-500' },
  TRAINING: { label: '운동중', icon: Dumbbell, colorClass: 'text-pink-500' },
  NOT_AT_WORK: { label: '오프라인', icon: LogOut, colorClass: 'text-muted-foreground' },
};

export function Sidebar() {
  const { currentUser, sidebarCollapsed, toggleSidebar, userWorkStatus, setUserWorkStatus, signOut, theme, toggleTheme } = useAppStore();
  const location = useLocation();
  const { t, language, toggleLanguage } = useTranslation();

  // Menu items - Admin only visible to ADMIN role
  const navItems = [
    { path: '/', icon: Home, labelKey: 'dashboard' as const, visible: true, pro: false },
    { path: '/projects', icon: FolderKanban, labelKey: 'projects' as const, visible: true, pro: false },
    { path: '/chat', icon: MessageSquare, labelKey: 'chat' as const, visible: true, pro: false },
    { path: '/calendar', icon: Calendar, labelKey: 'calendar' as const, visible: true, pro: false },
    { path: '/inbox', icon: Inbox, labelKey: 'inbox' as const, visible: true, pro: false },
    { path: '/profile', icon: User, labelKey: 'myProfile' as const, visible: true, pro: false },
    { path: '/admin', icon: Crown, labelKey: 'admin' as const, visible: currentUser?.role === 'ADMIN', pro: true },
  ].filter(item => item.visible);

  const currentStatus = workStatusConfig[userWorkStatus];
  const StatusIcon = currentStatus.icon;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sidebar-primary to-primary flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <span className="text-lg font-semibold text-sidebar-foreground animate-fade-in">
            Re-Be.io
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'nav-link',
                isActive && 'active',
                sidebarCollapsed && 'justify-center px-2'
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && (
                <span className="animate-fade-in flex-1">{t(item.labelKey)}</span>
              )}
              {!sidebarCollapsed && item.pro && (
                <span className="text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full animate-fade-in">
                  Pro
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="px-3 pb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleTheme}
              className={cn(
                'w-full rounded-lg p-2 transition-all hover:bg-sidebar-accent',
                sidebarCollapsed && 'flex justify-center'
              )}
            >
              {sidebarCollapsed ? (
                theme === 'dark' ? <Moon className="w-4 h-4 text-sidebar-muted" /> : <Sun className="w-4 h-4 text-sidebar-muted" />
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="w-4 h-4 text-sidebar-muted" /> : <Sun className="w-4 h-4 text-sidebar-muted" />}
                    <span className="text-xs font-medium text-sidebar-muted">
                      {theme === 'dark' ? 'Dark' : 'Light'}
                    </span>
                  </div>
                  <div className="relative inline-flex h-6 w-12 items-center rounded-full bg-sidebar-accent border border-sidebar-border">
                    <div
                      className={cn(
                        'absolute h-5 w-5 rounded-full bg-sidebar-primary transition-transform duration-200 ease-in-out flex items-center justify-center',
                        theme === 'dark' ? 'translate-x-[26px]' : 'translate-x-0.5'
                      )}
                    >
                      {theme === 'dark' ? <Moon className="w-2.5 h-2.5 text-white" /> : <Sun className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </div>
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Language Toggle */}
      <div className="px-3 pb-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleLanguage}
              className={cn(
                'w-full rounded-lg p-2 transition-all hover:bg-sidebar-accent',
                sidebarCollapsed && 'flex justify-center'
              )}
            >
              {sidebarCollapsed ? (
                <Languages className="w-4 h-4 text-sidebar-muted" />
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-sidebar-muted" />
                    <span className="text-xs font-medium text-sidebar-muted">
                      {language === 'ko' ? '언어' : 'Language'}
                    </span>
                  </div>
                  {/* Toggle Switch */}
                  <div className="relative inline-flex h-6 w-12 items-center rounded-full bg-sidebar-accent border border-sidebar-border">
                    <div
                      className={cn(
                        'absolute h-5 w-5 rounded-full bg-sidebar-primary transition-transform duration-200 ease-in-out flex items-center justify-center',
                        language === 'en' ? 'translate-x-[26px]' : 'translate-x-0.5'
                      )}
                    >
                      <span className="text-[8px] font-bold text-white">
                        {language === 'ko' ? 'KO' : 'EN'}
                      </span>
                    </div>
                    <div className="flex w-full justify-between px-1.5 text-[8px] font-medium text-sidebar-muted">
                      <span className={language === 'ko' ? 'opacity-0' : 'opacity-50'}>KO</span>
                      <span className={language === 'en' ? 'opacity-0' : 'opacity-50'}>EN</span>
                    </div>
                  </div>
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {language === 'ko' ? 'Switch to English' : '한국어로 변경'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* User Profile with Status Menu */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              'w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer',
              sidebarCollapsed && 'justify-center px-0'
            )}>
              <div className="relative">
                <Avatar className="w-8 h-8 shrink-0">
                  {currentUser?.avatar && (
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                  )}
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                    {currentUser?.name.split(' ').map(n => n[0]).join('') || '?'}
                  </AvatarFallback>
                </Avatar>
                {/* Status indicator dot */}
                <div className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sidebar',
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
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 animate-fade-in text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {currentUser?.name || ''}
                  </p>
                  <p className={cn('text-xs truncate', currentStatus.colorClass)}>
                    {currentStatus.label}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>{t('setStatus')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(workStatusConfig) as UserWorkStatus[]).map((status) => {
              const config = workStatusConfig[status];
              const Icon = config.icon;
              const isSelected = userWorkStatus === status;

              return (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setUserWorkStatus(status)}
                  className="gap-3"
                >
                  <Icon className={cn('w-4 h-4', config.colorClass)} />
                  <span className="flex-1">{config.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                try {
                  await signOut();
                  toast.success('로그아웃 되었습니다');
                } catch (error: unknown) {
                  toast.error(error instanceof Error ? error.message : 'Failed to log out');
                }
              }}
              className="gap-3 text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-muted hover:text-sidebar-foreground transition-colors"
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </aside>
  );
}
