/**
 * TabLayout — New main layout replacing AppLayout.
 *
 * Structure:
 * ┌──────────┬─────────────────────────────────┐
 * │ Sidebar  │                                 │
 * │ (glass)  │     WidgetGrid (main area)      │
 * │          │     (active tab's content)       │
 * │          │                                 │
 * │          ├─────────────────────────────────┤
 * │          │ TabBar (bottom)                  │
 * └──────────┴─────────────────────────────────┘
 *
 * All open tabs are rendered but only the active one is visible (display: block/none).
 * This prevents expensive re-mounts (e.g., FullCalendar) when switching tabs.
 */

import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, EnhancedMobileNav } from './';
import { TabBar } from './TabBar';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { cn } from '@/lib/utils';
import type { WidgetDataContext } from '@/types/widget';

export function TabLayout() {
  const { sidebarCollapsed } = useAppStore();
  const { openTabs, activeTabId } = useWidgetStore();
  const location = useLocation();
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  // Detect screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => setIsLargeScreen(window.innerWidth >= 1024);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // If we're on a sub-route (admin, settings), show Outlet instead of widget grid
  const isSubRoute = location.pathname !== '/';

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <main
        className={cn(
          'transition-all duration-300 h-screen flex flex-col',
          'pt-14 lg:pt-0',
          'pb-16 lg:pb-0',
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-60',
        )}
      >
        {isSubRoute ? (
          /* Sub-routes (admin, settings) render via Outlet */
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        ) : (
          /* Widget grid area */
          <>
            <div className="flex-1 min-h-0 overflow-auto widget-area-bg">
              {openTabs.map((tab) => {
                const context: WidgetDataContext = {
                  type: tab.type,
                  projectId: tab.projectId,
                };
                return (
                  <div
                    key={tab.id}
                    style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
                    className="h-full"
                  >
                    <WidgetGrid context={context} />
                  </div>
                );
              })}
            </div>

            {/* Bottom tab bar */}
            {isLargeScreen && <TabBar />}
          </>
        )}
      </main>

      {/* Mobile Navigation (Header + Bottom Nav) */}
      <EnhancedMobileNav />
    </div>
  );
}
