import { Outlet } from 'react-router-dom';
import { Sidebar, EnhancedMobileNav } from './';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { sidebarCollapsed } = useAppStore();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <main
        className={cn(
          'transition-all duration-300 pb-20 md:pb-0',
          'pt-14 md:pt-0', // Add top padding for mobile header
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-60'
        )}
      >
        <div className="p-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile Navigation (Header + Bottom Nav) */}
      <EnhancedMobileNav />
    </div>
  );
}
