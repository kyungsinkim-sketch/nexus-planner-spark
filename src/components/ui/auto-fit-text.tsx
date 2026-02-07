import { useRef, useEffect, useState, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface AutoFitTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** Maximum font size in px (default: inherits from CSS) */
  maxSize?: number;
  /** Minimum font size in px (default: 10) */
  minSize?: number;
}

/**
 * Renders text that automatically shrinks its font-size
 * so it never overflows the parent container.
 */
export function AutoFitText({
  children,
  className,
  maxSize,
  minSize = 10,
  ...props
}: AutoFitTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Reset to natural size first
    el.style.fontSize = '';
    const computedMax = maxSize ?? parseFloat(getComputedStyle(el).fontSize);

    let current = computedMax;
    el.style.fontSize = `${current}px`;

    // Shrink until it fits or we hit minimum
    while (el.scrollWidth > el.clientWidth && current > minSize) {
      current -= 0.5;
      el.style.fontSize = `${current}px`;
    }

    setFontSize(current);
  }, [children, maxSize, minSize]);

  return (
    <span
      ref={containerRef}
      className={cn('block whitespace-nowrap overflow-hidden', className)}
      style={fontSize !== undefined ? { fontSize: `${fontSize}px` } : undefined}
      {...props}
    >
      {children}
    </span>
  );
}
