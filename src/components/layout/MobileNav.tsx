import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar,
  FolderKanban,
  User,
  MessageSquare,
  Settings,
  Inbox,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTranslation } from '@/hooks/useTranslation';

export function MobileNav() {
  const { currentUser } = useAppStore();
  const location = useLocation();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const navItems = [
    { path: '/', icon: Home, labelKey: 'dashboard' as const, visible: true },
    { path: '/calendar', icon: Calendar, labelKey: 'calendar' as const, visible: true },
    { path: '/projects', icon: FolderKanban, labelKey: 'projects' as const, visible: true },
    { path: '/chat', icon: MessageSquare, labelKey: 'chat' as const, visible: true },
    { path: '/inbox', icon: Inbox, labelKey: 'inbox' as const, visible: true },
    { path: '/profile', icon: User, labelKey: 'myProfile' as const, visible: true },
    { path: '/admin', icon: Settings, labelKey: 'admin' as const, visible: currentUser.role === 'ADMIN' },
  ].filter(item => item.visible);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold">Paulus.ai</span>
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="p-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(currentUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <SheetTitle className="text-base">{currentUser.name}</SheetTitle>
                    <p className="text-xs text-muted-foreground">{currentUser.role}</p>
                  </div>
                </div>
              </SheetHeader>

              <nav className="p-4 space-y-1">
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
                      <span className="font-medium">{t(item.labelKey)}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 px-1 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium truncate w-full text-center">
                  {t(item.labelKey)}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Spacers for fixed headers */}
      <div className="lg:hidden h-14" /> {/* Top spacer */}
    </>
  );
}
