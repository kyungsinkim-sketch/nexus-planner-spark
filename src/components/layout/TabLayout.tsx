/**
 * TabLayout — Full-screen widget layout with bottom TabBar.
 *
 * Structure (no sidebar):
 * ┌─────────────────────────────────────────┐
 * │                                         │
 * │     WidgetGrid (full-width main area)   │
 * │     (active tab's content)               │
 * │                                         │
 * ├─────────────────────────────────────────┤
 * │ TabBar (bottom — tabs + controls)        │
 * └─────────────────────────────────────────┘
 *
 * All open tabs are rendered but only the active one is visible (display: block/none).
 * This prevents expensive re-mounts (e.g., FullCalendar) when switching tabs.
 */

import { Outlet, useLocation } from 'react-router-dom';
import { TabBar } from './TabBar';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { useWidgetStore } from '@/stores/widgetStore';
import type { WidgetDataContext } from '@/types/widget';

export function TabLayout() {
  const { openTabs, activeTabId } = useWidgetStore();
  const location = useLocation();

  // If we're on a sub-route (admin, settings), show Outlet instead of widget grid
  const isSubRoute = location.pathname !== '/';

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {isSubRoute ? (
        /* Sub-routes (admin, settings) render via Outlet */
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      ) : (
        /* Widget grid area — constrained to viewport */
        <div className="flex-1 min-h-0 overflow-hidden widget-area-bg">
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
      )}

      {/* Bottom tab bar — always visible */}
      <TabBar />
    </div>
  );
}
