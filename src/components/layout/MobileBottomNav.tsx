import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, FolderKanban, User, Settings } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';

export function MobileBottomNav() {
  const { currentUser } = useAppStore();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Calendar, label: 'Calendar', visible: true },
    { path: '/projects', icon: FolderKanban, label: 'Projects', visible: true },
    { path: '/profile', icon: User, label: 'Profile', visible: true },
    { path: '/admin', icon: Settings, label: 'Admin', visible: currentUser.role === 'ADMIN' },
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
              <item.icon className={cn(
                'w-5 h-5 transition-transform',
                isActive && 'scale-110'
              )} />
              <span className="text-[10px] font-medium">{item.label}</span>
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