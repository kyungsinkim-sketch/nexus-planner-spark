import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, FolderKanban, User, Settings, Inbox, MessageSquare, Bell } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

export function MobileBottomNav() {
  const { currentUser, appNotifications } = useAppStore();
  const location = useLocation();
  const { t } = useTranslation();
  const unreadCount = appNotifications.filter(n => !n.read).length;

  const navItems = [
    { path: '/', icon: Calendar, labelKey: 'calendar' as const, visible: true, badge: 0 },
    { path: '/projects', icon: FolderKanban, labelKey: 'projects' as const, visible: true, badge: 0 },
    { path: '/chat', icon: MessageSquare, labelKey: 'chat' as const, visible: true, badge: 0 },
    { path: '/inbox', icon: Bell, labelKey: 'notifications' as const, visible: true, badge: unreadCount },
    { path: '/admin', icon: Settings, labelKey: 'admin' as const, visible: currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER', badge: 0 },
  ].filter(item => item.visible);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative">
                <item.icon className={cn(
                  'w-5 h-5 transition-transform',
                  isActive && 'scale-110'
                )} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}