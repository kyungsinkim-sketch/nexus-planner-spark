/**
 * WidgetContainer — Liquid Glass card wrapper for each widget.
 *
 * - Title bar acts as drag handle (className "widget-drag-handle")
 * - Collapse/expand toggle
 * - Remove button
 * - Lazy rendering via IntersectionObserver
 */

import React, { useRef, useState, useEffect, useCallback, Suspense, type ReactNode } from 'react';
import { Minus, Plus, X, AlertTriangle, RotateCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useIntersection } from '@/hooks/useIntersection';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

// ─── Responsive font scale based on widget container size ───
function useWidgetScale(ref: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    if (!ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    // Scale down when widget is small; base size ~300px wide
    const ws = Math.min(1, Math.max(0.65, w / 300));
    const hs = Math.min(1, Math.max(0.65, h / 200));
    setScale(Math.min(ws, hs));
  }, [ref]);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(updateScale);
    ro.observe(ref.current);
    updateScale();
    return () => ro.disconnect();
  }, [ref, updateScale]);

  return scale;
}

// ─── Widget-level Error Boundary ─────────────────────
// Catches render errors in individual widgets so one broken
// widget doesn't crash the entire dashboard.

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WidgetErrorBoundary extends React.Component<
  { children: ReactNode; widgetId: string },
  WidgetErrorBoundaryState
> {
  constructor(props: { children: ReactNode; widgetId: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[Widget:${this.props.widgetId}] Crash:`, error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-muted-foreground/60">
          <AlertTriangle className="w-5 h-5 text-amber-500/70" />
          <p className="text-xs text-center">위젯 오류가 발생했습니다</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIntersection(containerRef);
  const scale = useWidgetScale(containerRef);

  return (
    <div
      ref={containerRef}
      className={cn('glass-widget flex flex-col h-full', className)}
      data-widget-id={widgetId}
      style={{
        ...style,
        '--widget-scale': scale,
      } as React.CSSProperties}
    >
      {/* Title bar = drag handle + activation trigger */}
      <div className="widget-titlebar widget-drag-handle" onMouseDown={onTitleBarClick}>
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className="w-4 h-4 text-primary/70 shrink-0" />
          <span className="text-sm font-semibold text-foreground/85 truncate tracking-tight">{title}</span>
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
              title={collapsed ? t('expand') : t('collapse')}
            >
              {collapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 rounded hover:bg-destructive/20 transition-colors"
              title={t('removeWidget')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content — wrapped in error boundary so one widget crash doesn't break dashboard */}
      {!collapsed && (
        <div
          className="widget-content flex-1 min-h-0 p-0 origin-top-left"
          style={scale < 0.95 ? {
            transform: `scale(${scale})`,
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
          } : undefined}
        >
          <WidgetErrorBoundary widgetId={widgetId}>
            <Suspense fallback={<WidgetSkeleton />}>
              {isVisible ? children : <WidgetSkeleton />}
            </Suspense>
          </WidgetErrorBoundary>
        </div>
      )}
    </div>
  );
}
