/**
 * WidgetContainer — Liquid Glass card wrapper for each widget.
 *
 * - Title bar acts as drag handle (className "widget-drag-handle")
 * - Collapse/expand toggle
 * - Remove button
 * - Lazy rendering via IntersectionObserver
 */

import { useRef, Suspense, type ReactNode } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useIntersection } from '@/hooks/useIntersection';
import { cn } from '@/lib/utils';

interface HeaderAction {
  icon: LucideIcon;
  onClick: () => void;
  title: string;
}

interface WidgetContainerProps {
  widgetId: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  collapsed?: boolean;
  headerActions?: HeaderAction[];
  onCollapse?: () => void;
  onRemove?: () => void;
  onTitleBarClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

function WidgetSkeleton() {
  return (
    <div className="flex items-center justify-center h-full min-h-[80px] text-muted-foreground/50">
      <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function WidgetContainer({
  widgetId,
  title,
  icon: Icon,
  children,
  collapsed = false,
  headerActions,
  onCollapse,
  onRemove,
  onTitleBarClick,
  className,
  style,
}: WidgetContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersection(containerRef);

  return (
    <div
      ref={containerRef}
      className={cn('glass-widget flex flex-col h-full', className)}
      data-widget-id={widgetId}
      style={style}
    >
      {/* Title bar = drag handle + activation trigger */}
      <div className="widget-titlebar widget-drag-handle" onMouseDown={onTitleBarClick}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-foreground/70 shrink-0" />
          <span className="text-sm font-medium text-foreground/90 truncate">{title}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {headerActions?.map((action, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); action.onClick(); }}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title={action.title}
            >
              <action.icon className="w-3.5 h-3.5" />
            </button>
          ))}
          {onCollapse && (
            <button
              onClick={(e) => { e.stopPropagation(); onCollapse(); }}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded hover:bg-destructive/20 transition-colors"
              title="Remove widget"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="widget-content flex-1 min-h-0">
          <Suspense fallback={<WidgetSkeleton />}>
            {isVisible ? children : <WidgetSkeleton />}
          </Suspense>
        </div>
      )}
    </div>
  );
}
