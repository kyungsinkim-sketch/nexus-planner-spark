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
  const isAdmin = currentUser?.role === 'ADMIN';

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
  const isFramelessWidget = (widgetType: string) => widgetType === 'chat' || widgetType === 'calendar';

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
                {isFramelessWidget(widgetType) ? (
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
    </div>
  );
}
