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
 *
 * Project tabs apply the project's keyColor as widget accent and
 * the project's thumbnail as a full background image.
 */

import { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TabBar } from './TabBar';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import type { WidgetDataContext } from '@/types/widget';

export function TabLayout() {
  const { openTabs, activeTabId } = useWidgetStore();
  const { getProjectById } = useAppStore();
  const location = useLocation();

  // If we're on a sub-route (admin, settings), show Outlet instead of widget grid
  const isSubRoute = location.pathname !== '/';

  // Resolve project data for each open project tab
  const tabProjectData = useMemo(() => {
    const map: Record<string, { keyColor?: string; thumbnail?: string }> = {};
    openTabs.forEach((tab) => {
      if (tab.type === 'project' && tab.projectId) {
        const project = getProjectById(tab.projectId);
        if (project) {
          map[tab.id] = { keyColor: project.keyColor, thumbnail: project.thumbnail };
        }
      }
    });
    return map;
  }, [openTabs, getProjectById]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {isSubRoute ? (
        /* Sub-routes (admin, settings) render via Outlet */
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      ) : (
        /* Widget grid area — constrained to viewport */
        <div className="flex-1 min-h-0 overflow-hidden relative">
          {openTabs.map((tab) => {
            const context: WidgetDataContext = {
              type: tab.type,
              projectId: tab.projectId,
            };
            const isActive = tab.id === activeTabId;
            const projectData = tabProjectData[tab.id];
            const keyColor = projectData?.keyColor;
            const bgImage = projectData?.thumbnail;

            // Build inline style for project backgrounds
            const areaStyle: React.CSSProperties = {};
            let bgClass = 'widget-area-bg'; // default gradient

            if (tab.type === 'project') {
              if (bgImage) {
                // Project has a thumbnail → use as background image
                areaStyle.backgroundImage = `url(${bgImage})`;
                areaStyle.backgroundSize = 'cover';
                areaStyle.backgroundPosition = 'center';
                bgClass = 'project-bg-area';
              } else if (keyColor) {
                // No thumbnail but has keyColor → gradient from keyColor
                areaStyle.background = `linear-gradient(145deg, ${keyColor} 0%, ${keyColor}cc 40%, ${keyColor}88 100%)`;
                bgClass = '';
              }
            }

            // Set project keyColor as CSS variable for widget accents
            if (keyColor) {
              areaStyle['--project-color' as string] = keyColor;
            }

            return (
              <div
                key={tab.id}
                style={{ display: isActive ? 'block' : 'none', ...areaStyle }}
                className={`h-full ${bgClass}`}
              >
                {/* Overlay for project background images */}
                {tab.type === 'project' && bgImage && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: keyColor
                        ? `linear-gradient(145deg, ${keyColor}cc 0%, ${keyColor}99 50%, ${keyColor}66 100%)`
                        : 'linear-gradient(145deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.3) 100%)',
                    }}
                  />
                )}
                {/* Widget grid with project accent color */}
                <div className="relative h-full z-10">
                  <WidgetGrid context={context} projectKeyColor={keyColor} />
                </div>
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
