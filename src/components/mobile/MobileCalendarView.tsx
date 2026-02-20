/**
 * MobileCalendarView — 전체화면 모바일 캘린더
 *
 * CalendarWidget을 dashboard context로 래핑.
 * 모바일에서는 CalendarWidget 내부에서 useIsMobile() → listWeek 뷰로 전환됨.
 */

import { lazy, Suspense, useMemo } from 'react';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ArrowLeft, Calendar } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

const CalendarWidget = lazy(() => import('@/components/widgets/CalendarWidget'));

export function MobileCalendarView() {
  const { setMobileView } = useWidgetStore();
  const { language } = useTranslation();

  const context: WidgetDataContext = useMemo(() => ({
    type: 'dashboard' as const,
  }), []);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-3 border-b bg-background">
        <button
          onClick={() => setMobileView('dashboard')}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Calendar className="w-4 h-4 text-primary" />
        <h1 className="text-sm font-semibold">
          {language === 'ko' ? '캘린더' : 'Calendar'}
        </h1>
      </div>

      {/* CalendarWidget — full screen */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <CalendarWidget context={context} />
        </Suspense>
      </div>
    </div>
  );
}

export default MobileCalendarView;
