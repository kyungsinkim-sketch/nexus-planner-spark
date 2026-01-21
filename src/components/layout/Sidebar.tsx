import { NavLink, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  FolderKanban, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Settings,
  Inbox,
  MessageSquare,
  Building2,
  Coffee,
  Dumbbell,
  LogOut,
  Check,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { UserWorkStatus } from '@/types/core';

const workStatusConfig: Record<UserWorkStatus, { label: string; labelKo: string; icon: typeof Building2; colorClass: string }> = {
  AT_WORK: { label: 'At Work', labelKo: '출근', icon: Building2, colorClass: 'text-emerald-500' },
  NOT_AT_WORK: { label: 'Not at Work', labelKo: '미출근', icon: LogOut, colorClass: 'text-muted-foreground' },
  LUNCH: { label: 'Lunch', labelKo: '점심식사', icon: Coffee, colorClass: 'text-amber-500' },
  TRAINING: { label: 'Training', labelKo: '운동', icon: Dumbbell, colorClass: 'text-pink-500' },
};

export function Sidebar() {
  const { currentUser, sidebarCollapsed, toggleSidebar, userWorkStatus, setUserWorkStatus } = useAppStore();
  const location = useLocation();

  // Menu items - Admin only visible to ADMIN role
  const navItems = [
    { path: '/', icon: Calendar, label: 'Calendar', visible: true },
    { path: '/projects', icon: FolderKanban, label: 'Projects', visible: true },
    { path: '/chat', icon: MessageSquare, label: 'Chat', visible: true },
    { path: '/inbox', icon: Inbox, label: 'Inbox', visible: true },
    { path: '/profile', icon: User, label: 'My Profile', visible: true },
    { path: '/admin', icon: Settings, label: 'Admin', visible: currentUser.role === 'ADMIN' },
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
            Paulus.ai
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
                <span className="animate-fade-in">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

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
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                    {currentUser.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                {/* Status indicator dot */}
                <div className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sidebar',
                  userWorkStatus === 'AT_WORK' && 'bg-emerald-500',
                  userWorkStatus === 'NOT_AT_WORK' && 'bg-muted-foreground',
                  userWorkStatus === 'LUNCH' && 'bg-amber-500',
                  userWorkStatus === 'TRAINING' && 'bg-pink-500',
                )} />
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0 animate-fade-in text-left">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {currentUser.name}
                  </p>
                  <p className={cn('text-xs truncate', currentStatus.colorClass)}>
                    {currentStatus.labelKo}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel>근무 상태</DropdownMenuLabel>
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
                  <span className="flex-1">{config.labelKo}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-muted hover:text-sidebar-foreground transition-colors"
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
