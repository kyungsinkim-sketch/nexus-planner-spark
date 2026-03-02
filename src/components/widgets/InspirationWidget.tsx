/**
 * InspirationWidget — Displays rotating inspiration quotes on dashboard.
 * Quotes are managed by admin in Settings > Inspiration Quotes.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 300, h: 200 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function InspirationWidget({ context: _context }: { context: WidgetDataContext }) {
  const { inspirationQuotes } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { h } = useContainerSize(containerRef);

  // Pick a random starting index on mount
  useEffect(() => {
    if (inspirationQuotes.length > 0) {
      setCurrentIndex(Math.floor(Math.random() * inspirationQuotes.length));
    }
  }, [inspirationQuotes.length]);

  // Auto-rotate every 20 seconds
  useEffect(() => {
    if (inspirationQuotes.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % inspirationQuotes.length);
    }, 20000);
    return () => clearInterval(timer);
  }, [inspirationQuotes.length]);

  const quote = useMemo(
    () => inspirationQuotes[currentIndex % Math.max(inspirationQuotes.length, 1)],
    [inspirationQuotes, currentIndex]
  );

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + inspirationQuotes.length) % inspirationQuotes.length);
  }, [inspirationQuotes.length]);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % inspirationQuotes.length);
  }, [inspirationQuotes.length]);

  if (!quote || inspirationQuotes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/40">
        <Quote className="w-6 h-6" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col items-center justify-center px-3 py-2 relative group widget-dark-card rounded-[var(--widget-radius)] overflow-hidden">
      {/* Quote icon */}
      {h > 80 && <Quote style={{ width: h < 140 ? 14 : 20, height: h < 140 ? 14 : 20 }} className="text-white/20 mb-1 shrink-0" />}

      {/* Quote text */}
      <p
        className="text-center text-white/85 italic max-w-[95%] overflow-hidden"
        style={{
          fontSize: h < 100 ? 10 : h < 140 ? 11 : 14,
          lineHeight: h < 100 ? '1.2' : '1.5',
          display: '-webkit-box',
          WebkitLineClamp: h < 100 ? 2 : h < 140 ? 3 : 6,
          WebkitBoxOrient: 'vertical',
        }}
      >
        &ldquo;{quote.text}&rdquo;
      </p>

      {/* Author */}
      <p
        className="text-white/50 shrink-0 truncate max-w-[90%]"
        style={{ fontSize: h < 120 ? 9 : 12, marginTop: h < 120 ? 2 : 8 }}
      >
        — {quote.author}
      </p>

      {/* Navigation arrows (hover reveal) */}
      {inspirationQuotes.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full
                       opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-white/60" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full
                       opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
          >
            <ChevronRight className="w-4 h-4 text-white/60" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {inspirationQuotes.length > 1 && inspirationQuotes.length <= 10 && (
        <div className="flex gap-1 mt-2 shrink-0">
          {inspirationQuotes.map((_, idx) => (
            <div
              key={idx}
              className={`w-1 h-1 rounded-full transition-colors ${
                idx === currentIndex % inspirationQuotes.length
                  ? 'bg-white/50'
                  : 'bg-white/15'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default InspirationWidget;
