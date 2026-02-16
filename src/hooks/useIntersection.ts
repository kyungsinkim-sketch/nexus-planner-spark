/**
 * useIntersection — IntersectionObserver hook for lazy rendering widgets.
 * Returns true when the element is visible in the viewport.
 */

import { useEffect, useState, type RefObject } from 'react';

interface UseIntersectionOptions {
  threshold?: number;
  rootMargin?: string;
}

export function useIntersection(
  ref: RefObject<Element | null>,
  options: UseIntersectionOptions = {},
): boolean {
  const [isVisible, setIsVisible] = useState(false);
  const { threshold = 0.1, rootMargin = '100px' } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once visible, stop observing (widget stays rendered)
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin]);

  return isVisible;
}
