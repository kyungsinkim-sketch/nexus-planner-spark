/**
 * WidgetGrid — react-grid-layout v2 based draggable/resizable widget grid.
 *
 * Renders all widgets for a given context (dashboard or project).
 * Layout changes are debounced and persisted to widgetStore.
 *
 * Key v2 changes:
 * - `width` is required — provided via `useContainerWidth` hook
 * - `resizeConfig` replaces `resizeHandles` prop
 * - `dragConfig` replaces `draggableHandle` prop
 * - `onLayoutChange` signature: (layout, layouts) => void
 */

import { useMemo, useCallback, useRef, useState } from 'react';
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

  // Track which widget is actively being interacted with
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

  // Debounce layout changes for auto-save
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLayoutChange = useCallback(
    (newLayout: LayoutItem[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
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
      }, 300);
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
          onLayoutChange={(currentLayout: LayoutItem[], _allLayouts: Record<string, LayoutItem[]>) => handleLayoutChange(currentLayout)}
          onDragStart={(_layout, _oldItem, newItem) => {
            if (newItem) setActiveWidgetId(newItem.i);
          }}
          onDragStop={() => setActiveWidgetId(null)}
          onResizeStart={(_layout, _oldItem, newItem) => {
            if (newItem) setActiveWidgetId(newItem.i);
          }}
          onResizeStop={() => setActiveWidgetId(null)}
        >
          {visibleWidgets.map((item) => {
            const widgetType = item.i as WidgetType;
            const def = WIDGET_DEFINITIONS[widgetType];
            const WidgetComponent = WIDGET_COMPONENTS[widgetType];

            if (!def || !WidgetComponent) return null;

            // Get translated title, fallback to titleKey
            const title = t(def.titleKey as Parameters<typeof t>[0]) || def.titleKey;
            const isActive = activeWidgetId === item.i;

            return (
              <div
                key={item.i}
                className={isActive ? 'widget-item-active' : 'widget-item-idle'}
              >
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
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
