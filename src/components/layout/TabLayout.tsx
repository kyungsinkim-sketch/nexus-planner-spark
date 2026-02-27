/**
 * TabLayout — Full-screen widget layout with bottom TabBar.
 *
 * DESKTOP (≥768px):
 * ┌─────────────────────────────────────────┐
 * │                                         │
 * │     WidgetGrid (full-width main area)   │
 * │     (active tab's content)               │
 * │                                         │
 * ├─────────────────────────────────────────┤
 * │ TabBar (bottom — tabs + controls)        │
 * └─────────────────────────────────────────┘
 *
 * MOBILE (<768px):
 * ┌─────────────────────────────────────────┐
 * │  MobileProjectView (프로젝트 리스트/상세) │
 * │  or MobileChatView (전체화면 채팅)        │
 * │  or MobileCalendarView (전체화면 캘린더)   │
 * │  or MobileEmailView (전체화면 이메일)      │
 * └─────────────────────────────────────────┘
 * (No drag-and-drop, no WidgetGrid)
 * mobileView state in widgetStore routes between views.
 *
 * All open tabs are rendered but only the active one is visible (display: block/none).
 * This prevents expensive re-mounts (e.g., FullCalendar) when switching tabs.
 *
 * Project tabs apply the project's keyColor as widget accent and
 * the project's thumbnail as a full background image.
 */

import { useMemo, lazy, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TabBar } from './TabBar';
import { WidgetGrid } from '@/components/widgets/WidgetGrid';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { NewProjectModal } from '@/components/project/NewProjectModal';
import { useIsMobile } from '@/hooks/use-mobile';
import type { WidgetDataContext } from '@/types/widget';

// Lazy load mobile components — only loaded on mobile
const CosmosHome = lazy(() => import('@/components/mobile/CosmosHome'));
const ConstellationMap = lazy(() => import('@/components/mobile/ConstellationMap'));
const CosmosCalendar = lazy(() => import('@/components/mobile/CosmosCalendar'));
const CosmosEmail = lazy(() => import('@/components/mobile/CosmosEmail'));
const MobileProjectView = lazy(() => import('@/components/mobile/MobileProjectView'));
const MobileChatView = lazy(() => import('@/components/mobile/MobileChatView'));
const MobileBottomNav = lazy(() => import('@/components/mobile/MobileBottomNav'));

export function TabLayout() {
  const { openTabs, activeTabId, mobileView } = useWidgetStore();
  const { projects, projectCreateDialogOpen, setProjectCreateDialogOpen } = useAppStore();
  const location = useLocation();
  const isMobile = useIsMobile();

  // If we're on a sub-route (admin, settings), show Outlet instead of widget grid
  const isSubRoute = location.pathname !== '/';

  // Resolve project data for each open project tab
  const tabProjectData = useMemo(() => {
    const map: Record<string, { keyColor?: string; thumbnail?: string }> = {};
    openTabs.forEach((tab) => {
      if (tab.type === 'project' && tab.projectId) {
        const project = projects.find(p => p.id === tab.projectId);
        if (project) {
          map[tab.id] = { keyColor: project.keyColor, thumbnail: project.thumbnail };
        }
      }
    });
    return map;
  }, [openTabs, projects]);

  // Determine active tab info for mobile
  const activeTab = openTabs.find(t => t.id === activeTabId);
  const isProjectTab = activeTab?.type === 'project' && activeTab?.projectId;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {isSubRoute ? (
        /* Sub-routes (admin, settings) render via Outlet */
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      ) : isMobile ? (
        /* ====== MOBILE LAYOUT ====== */
        /* pb-14 accounts for fixed bottom nav bar height */
        <div className="flex-1 min-h-0 overflow-hidden pb-14">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            {mobileView === 'home' ? (
              <CosmosHome />
            ) : mobileView === 'constellation' ? (
              <ConstellationMap />
            ) : mobileView === 'chat' ? (
              <MobileChatView />
            ) : mobileView === 'calendar' ? (
              <CosmosCalendar />
            ) : mobileView === 'email' ? (
              <CosmosEmail />
            ) : (
              <MobileProjectView />
            )}
          </Suspense>
        </div>
      ) : (
        /* ====== DESKTOP LAYOUT ====== */
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
                areaStyle.backgroundImage = `url(${bgImage})`;
                areaStyle.backgroundSize = 'cover';
                areaStyle.backgroundPosition = 'center';
                bgClass = 'project-bg-area';
              } else if (keyColor) {
                areaStyle.background = `linear-gradient(145deg, ${keyColor} 0%, ${keyColor}cc 40%, ${keyColor}88 100%)`;
                bgClass = '';
              }
            }

            if (keyColor) {
              areaStyle['--project-color' as string] = keyColor;
            }

            return (
              <div
                key={tab.id}
                style={{
                  ...areaStyle,
                  position: 'absolute' as const,
                  inset: 0,
                  opacity: isActive ? 1 : 0,
                  visibility: isActive ? ('visible' as const) : ('hidden' as const),
                  transition: 'opacity 0.15s ease-out',
                  zIndex: isActive ? 1 : 0,
                  pointerEvents: isActive ? ('auto' as const) : ('none' as const),
                }}
                className={bgClass}
              >
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
                <div className="relative h-full z-10 overflow-y-auto overflow-x-hidden">
                  <WidgetGrid context={context} projectKeyColor={keyColor} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom navigation */}
      {isMobile ? (
        <Suspense fallback={null}>
          <MobileBottomNav />
        </Suspense>
      ) : (
        <TabBar />
      )}

      {/* Global New Project Modal */}
      <NewProjectModal open={projectCreateDialogOpen} onOpenChange={setProjectCreateDialogOpen} />
    </div>
  );
}
