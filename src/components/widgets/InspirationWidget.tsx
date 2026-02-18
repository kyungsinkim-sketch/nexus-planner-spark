/**
 * InspirationWidget — Displays rotating inspiration quotes on dashboard.
 * Quotes are managed by admin in Settings > Inspiration Quotes.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function InspirationWidget({ context: _context }: { context: WidgetDataContext }) {
  const { inspirationQuotes } = useAppStore();
  const [currentIndex, setCurrentIndex] = useState(0);

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
    <div className="h-full flex flex-col items-center justify-center px-6 py-3 relative group">
      {/* Quote icon */}
      <Quote className="w-5 h-5 text-muted-foreground/20 mb-2 shrink-0" />

      {/* Quote text */}
      <p className="text-sm text-center text-foreground/80 italic leading-relaxed max-w-[90%]">
        &ldquo;{quote.text}&rdquo;
      </p>

      {/* Author */}
      <p className="text-xs text-muted-foreground mt-2 shrink-0">
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
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full
                       opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
                  ? 'bg-foreground/40'
                  : 'bg-foreground/10'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default InspirationWidget;
