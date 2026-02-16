/**
 * WidgetGrid — react-grid-layout v2 based draggable/resizable widget grid.
 *
 * Renders all widgets for a given context (dashboard or project).
 * Layout changes are persisted to widgetStore only on user interaction
 * (drag/resize stop), NOT on automatic compaction during mount.
 */

import { useMemo, useCallback, useState } from 'react';
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useWidgetStore } from '@/stores/widgetStore';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { WidgetContainer } from './WidgetContainer';
import { WIDGET_COMPONENTS, WIDGET_DEFINITIONS } from './widgetRegistry';
import type { WidgetDataContext, WidgetLayoutItem, WidgetType } from '@/types/widget';
import { GRID_BREAKPOINTS, GRID_COLS, GRID_ROW_HEIGHT, GRID_MARGIN } from '@/types/widget';

interface WidgetGridProps {
  context: WidgetDataContext;
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

export function WidgetGrid({ context }: WidgetGridProps) {
  const { t } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);
  const isAdmin = currentUser?.role === 'ADMIN';

  // Track which widget is actively being interacted with (for opacity)
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

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

  // Chat widget uses a special frameless container
  const isChatWidget = (widgetType: string) => widgetType === 'chat';

  return (
    <div ref={containerRef} className="h-full w-full">
      {mounted && (
        <ResponsiveGridLayout
          className="widget-grid"
          width={width}
          layouts={gridLayouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={GRID_ROW_HEIGHT}
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
            setActiveWidgetId(null);
            saveLayout(finalLayout);
          }}
          onResizeStart={(_layout, _oldItem, newItem) => {
            if (newItem) setActiveWidgetId(newItem.i);
          }}
          onResizeStop={(finalLayout) => {
            setActiveWidgetId(null);
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

            return (
              <div
                key={item.i}
                className={isActive ? 'widget-item-active' : 'widget-item-idle'}
              >
                {isChatWidget(widgetType) ? (
                  // Chat: frameless — no WidgetContainer, direct embed
                  <div className="glass-widget flex flex-col h-full" data-widget-id={item.i}>
                    {/* Minimal drag handle + close button overlay */}
                    <div className="widget-drag-handle chat-widget-handle">
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
