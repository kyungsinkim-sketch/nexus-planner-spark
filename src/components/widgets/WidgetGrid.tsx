/**
 * WidgetGrid — react-grid-layout v2 based draggable/resizable widget grid.
 *
 * Renders all widgets for a given context (dashboard or project).
 * Layout changes are persisted to widgetStore only on user interaction
 * (drag/resize stop), NOT on automatic compaction during mount.
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout';
// CSS imports moved to index.css for correct cascade order
// import 'react-grid-layout/css/styles.css';
// import 'react-resizable/css/styles.css';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { WidgetContainer } from './WidgetContainer';
import { WIDGET_COMPONENTS, WIDGET_DEFINITIONS } from './widgetRegistry';
import { Plus, Settings, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EditProjectModal } from '@/components/project/EditProjectModal';
import type { WidgetDataContext, WidgetLayoutItem, WidgetType } from '@/types/widget';
import { GRID_BREAKPOINTS, GRID_COLS, GRID_MARGIN } from '@/types/widget';

interface WidgetGridProps {
  context: WidgetDataContext;
  projectKeyColor?: string;
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export function WidgetGrid({ context, projectKeyColor }: WidgetGridProps) {
  const { t } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);
  const setTodoCreateDialogOpen = useAppStore((s) => s.setTodoCreateDialogOpen);
  const setWorldClockSettingsOpen = useAppStore((s) => s.setWorldClockSettingsOpen);
  const setWeatherSettingsOpen = useAppStore((s) => s.setWeatherSettingsOpen);
  const isAdmin = currentUser?.role === 'ADMIN';
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);

  // Header actions per widget type (e.g. + button in Todos titlebar, gear in clock/weather)
  const getHeaderActions = useCallback((widgetType: string): Array<{ icon: LucideIcon; onClick: () => void; title: string }> | undefined => {
    if (widgetType === 'todos') {
      return [{ icon: Plus, onClick: () => setTodoCreateDialogOpen(true), title: t('newTodo') }];
    }
    if (widgetType === 'worldClock') {
      return [{ icon: Settings, onClick: () => setWorldClockSettingsOpen(true), title: t('settings') }];
    }
    if (widgetType === 'weather') {
      return [{ icon: Settings, onClick: () => setWeatherSettingsOpen(true), title: t('settings') }];
    }
    return undefined;
  }, [setTodoCreateDialogOpen, setWorldClockSettingsOpen, setWeatherSettingsOpen, t]);

  // Get current project for settings dialog
  const projects = useAppStore((s) => s.projects);
  const currentProject = context.type === 'project' && context.projectId
    ? projects.find(p => p.id === context.projectId) || null
    : null;

  // Track which widget is actively being interacted with (for opacity).
  // Active = clicked, dragged, or resized. Clicking outside deactivates.
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

  // Click outside any widget → deactivate
  const handleGridClick = useCallback((e: React.MouseEvent) => {
    // Only deactivate if clicking on the grid background, not on a widget
    if (e.target === e.currentTarget) {
      setActiveWidgetId(null);
    }
  }, []);

  const {
    dashboardWidgetLayout,
    projectWidgetLayout,
    updateDashboardLayout,
    updateProjectLayout,
    addWidget,
    removeWidget,
    toggleWidgetCollapsed,
  } = useWidgetStore();

  const layout = context.type === 'dashboard' ? dashboardWidgetLayout : projectWidgetLayout;
  const updateLayout = context.type === 'dashboard' ? updateDashboardLayout : updateProjectLayout;

  // Use the v2 useContainerWidth hook for responsive width detection
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: false,
    initialWidth: 1280,
  });

  // Dynamically compute rowHeight so grid fills the container vertically
  const [containerHeight, setContainerHeight] = useState(0);
  const heightObserverRef = useRef<ResizeObserver | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerHeight(el.clientHeight);
    measure();
    heightObserverRef.current = new ResizeObserver(measure);
    heightObserverRef.current.observe(el);
    return () => heightObserverRef.current?.disconnect();
  }, [containerRef]);

  // Calculate row height: target 10 rows to fill viewport
  // Formula: (containerHeight - padding*2 - margin*(rows-1)) / rows
  const TARGET_ROWS = 10;
  const computedRowHeight = useMemo(() => {
    if (!containerHeight) return 60;
    const pad = 16 * 2; // containerPadding top+bottom
    const gaps = 12 * (TARGET_ROWS - 1); // margin between rows
    return Math.max(30, Math.floor((containerHeight - pad - gaps) / TARGET_ROWS));
  }, [containerHeight]);

  /**
   * Save layout on user interaction ONLY (drag/resize stop).
   * We do NOT save on onLayoutChange because it fires on every mount
   * due to compaction, which overwrites stored positions.
   */
  const saveLayout = useCallback(
    (newLayout: LayoutItem[]) => {
      const updated: WidgetLayoutItem[] = newLayout.map((item) => {
        const existing = layout.find((l) => l.i === item.i);
        return {
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: item.minW,
          minH: item.minH,
          collapsed: existing?.collapsed,
        };
      });
      updateLayout(updated);
    },
    [layout, updateLayout],
  );

  // Convert our layout items to react-grid-layout format
  const gridLayouts = useMemo(() => {
    const lgLayout = layout
      .filter((item) => {
        const def = WIDGET_DEFINITIONS[item.i as WidgetType];
        if (!def) return false;
        if (def.adminOnly && !isAdmin) return false;
        return true;
      })
      .map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.collapsed ? 1 : item.h,
        minW: item.minW ?? 2,
        minH: item.collapsed ? 1 : item.minH ?? 2,
      }));
    return { lg: lgLayout, md: lgLayout, sm: lgLayout, xs: lgLayout, xxs: lgLayout };
  }, [layout, isAdmin]);

  // Visible widget items
  const visibleWidgets = useMemo(
    () =>
      layout.filter((item) => {
        const def = WIDGET_DEFINITIONS[item.i as WidgetType];
        if (!def) return false;
        if (def.adminOnly && !isAdmin) return false;
        return true;
      }),
    [layout, isAdmin],
  );

  // Frameless widgets: rendered without WidgetContainer, just glass-widget + minimal drag handle
  const isFramelessWidget = (widgetType: string) => widgetType === 'chat' || widgetType === 'calendar' || widgetType === 'brainChat';

  // Barless widgets: no title bar at all, hover-reveal settings/remove buttons in top-right corner
  const isBarlessWidget = (widgetType: string) => widgetType === 'worldClock' || widgetType === 'weather';

  // Inline style to kill transitions — applied to every grid item to guarantee
  // no slide-in animation regardless of CSS load order
  const noTransitionStyle: React.CSSProperties = { transition: 'none' };

  // Check dark mode for active widget bg color
  const theme = useAppStore((s) => s.theme);
  const isDark = theme === 'dark';

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{
        ...(projectKeyColor ? { '--project-accent': projectKeyColor } as React.CSSProperties : {}),
      }}
      onClick={handleGridClick}
    >
      {mounted && (
        <ResponsiveGridLayout
          className="widget-grid"
          style={noTransitionStyle}
          width={width}
          layouts={gridLayouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={computedRowHeight}
          margin={GRID_MARGIN}
          containerPadding={[16, 16]}
          compactor={verticalCompactor}
          dragConfig={{
            enabled: true,
            handle: '.widget-drag-handle',
            threshold: 3,
            bounded: false,
          }}
          resizeConfig={{
            enabled: true,
            handles: ['s', 'w', 'e', 'n', 'se', 'sw', 'ne', 'nw'],
          }}
          onDragStart={(_layout, _oldItem, newItem) => {
            if (newItem) setActiveWidgetId(newItem.i);
          }}
          onDragStop={(finalLayout) => {
            // Keep widget active after drag (don't reset to null)
            saveLayout(finalLayout);
          }}
          onResizeStart={(_layout, _oldItem, newItem) => {
            if (newItem) setActiveWidgetId(newItem.i);
          }}
          onResizeStop={(finalLayout) => {
            // Keep widget active after resize (don't reset to null)
            saveLayout(finalLayout);
          }}
        >
          {visibleWidgets.map((item) => {
            const widgetType = item.i as WidgetType;
            const def = WIDGET_DEFINITIONS[widgetType];
            const WidgetComponent = WIDGET_COMPONENTS[widgetType];

            if (!def || !WidgetComponent) return null;

            const title = t(def.titleKey as Parameters<typeof t>[0]) || def.titleKey;
            const isActive = activeWidgetId === item.i;

            // When active: apply solid opaque background via inline style
            // This guarantees no transparency regardless of CSS specificity
            const activeGlassStyle: React.CSSProperties | undefined = isActive
              ? {
                  background: isDark ? '#0e1629' : '#ffffff',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                }
              : undefined;

            return (
              <div
                key={item.i}
                className={isActive ? 'widget-item-active' : 'widget-item-idle'}
                style={noTransitionStyle}
              >
                {widgetType === 'brainChat' ? (
                  // Brain AI: completely borderless — just the search bar, entire widget is drag handle
                  <div
                    className="widget-drag-handle h-full"
                    data-widget-id={item.i}
                    onMouseDown={() => setActiveWidgetId(item.i)}
                  >
                    <WidgetComponent context={context} />
                  </div>
                ) : isBarlessWidget(widgetType) ? (
                  // Barless: no title bar, hover-reveal settings/remove buttons at top-right
                  <div
                    className="glass-widget h-full widget-drag-handle group/barless relative"
                    data-widget-id={item.i}
                    style={activeGlassStyle}
                    onMouseDown={() => setActiveWidgetId(item.i)}
                  >
                    {/* Hover-reveal action buttons */}
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 z-20
                                    opacity-0 group-hover/barless:opacity-100 transition-opacity duration-200">
                      {getHeaderActions(widgetType)?.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                          className="p-1 rounded-md bg-background/80 backdrop-blur-sm border border-border/50
                                     hover:bg-background shadow-sm transition-colors"
                          title={action.title}
                        >
                          <action.icon className="w-3 h-3 text-foreground/70" />
                        </button>
                      ))}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeWidget(context.type, widgetType); }}
                        className="p-1 rounded-md bg-background/80 backdrop-blur-sm border border-border/50
                                   hover:bg-destructive/20 shadow-sm transition-colors"
                        title="Remove widget"
                      >
                        <X className="w-3 h-3 text-foreground/70" />
                      </button>
                    </div>
                    <div className="h-full overflow-hidden">
                      <WidgetComponent context={context} />
                    </div>
                  </div>
                ) : isFramelessWidget(widgetType) ? (
                  // Frameless: no WidgetContainer, direct embed with minimal drag handle
                  <div className="glass-widget flex flex-col h-full" data-widget-id={item.i} style={activeGlassStyle}>
                    <div
                      className="widget-drag-handle chat-widget-handle"
                      onMouseDown={() => setActiveWidgetId(item.i)}
                    >
                      <span className="text-xs font-medium text-foreground/70 truncate flex items-center gap-1.5">
                        <def.icon className="w-3.5 h-3.5" />
                        {title}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeWidget(context.type, widgetType); }}
                        className="p-0.5 rounded hover:bg-destructive/20 transition-colors"
                        title="Remove widget"
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center text-foreground/70">✕</span>
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <WidgetComponent context={context} />
                    </div>
                  </div>
                ) : (
                  // Normal widgets: standard WidgetContainer frame
                  <WidgetContainer
                    widgetId={item.i}
                    title={title}
                    icon={def.icon}
                    collapsed={item.collapsed}
                    headerActions={getHeaderActions(widgetType)}
                    onCollapse={() => toggleWidgetCollapsed(context.type, widgetType)}
                    onRemove={() => removeWidget(context.type, widgetType)}
                    style={activeGlassStyle}
                    onTitleBarClick={() => setActiveWidgetId(item.i)}
                  >
                    <WidgetComponent context={context} />
                  </WidgetContainer>
                )}
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}

      {/* Floating Action Buttons — above bottom navbar */}
      <div className="fixed bottom-20 right-6 flex items-center gap-2 z-30">
        {/* Settings button (project context only) — opens project settings dialog */}
        {context.type === 'project' && context.projectId && (
          <button
            onClick={() => setShowProjectSettings(true)}
            className="w-10 h-10 rounded-full glass-widget flex items-center justify-center
                       shadow-lg hover:shadow-xl transition-all
                       text-muted-foreground hover:text-foreground"
            title={t('projectSettings')}
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Add widget button */}
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className={`w-10 h-10 rounded-full flex items-center justify-center
                       shadow-lg hover:shadow-xl transition-all ${
                         showAddMenu
                           ? 'bg-destructive text-destructive-foreground rotate-45'
                           : 'bg-primary text-primary-foreground hover:bg-primary/90'
                       }`}
            title={showAddMenu ? t('close') : t('addWidget')}
          >
            {showAddMenu ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>

          {/* Add widget menu popup */}
          {showAddMenu && (
            <div className="absolute bottom-12 right-0 w-56 p-2 rounded-xl glass-widget shadow-xl border border-border/50
                            animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">
                {t('addWidget')}
              </p>
              {(() => {
                const currentWidgetIds = layout.map((item) => item.i);
                const availableWidgets = Object.values(WIDGET_DEFINITIONS).filter((def) => {
                  if (currentWidgetIds.includes(def.type)) return false;
                  if (!def.contexts.includes(context.type)) return false;
                  if (def.adminOnly && !isAdmin) return false;
                  return true;
                });

                if (availableWidgets.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground/60 px-2 py-2 text-center">
                      {t('allWidgetsAdded')}
                    </p>
                  );
                }

                return availableWidgets.map((def) => {
                  const Icon = def.icon;
                  const label = t(def.titleKey as Parameters<typeof t>[0]) || def.titleKey;
                  return (
                    <button
                      key={def.type}
                      onClick={() => {
                        addWidget(context.type, def.type);
                        setShowAddMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg
                                 text-sm text-foreground hover:bg-primary/10 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span>{label}</span>
                    </button>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Project Settings Dialog */}
      {currentProject && (
        <EditProjectModal
          open={showProjectSettings}
          onOpenChange={setShowProjectSettings}
          project={currentProject}
        />
      )}
    </div>
  );
}
