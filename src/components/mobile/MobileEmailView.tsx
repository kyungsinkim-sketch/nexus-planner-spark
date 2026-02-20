/**
 * MobileEmailView -- full screen mobile email
 *
 * EmailWidget wrapped in dashboard context.
 * Gmail integration with Brain AI suggestions.
 */

import { lazy, Suspense, useMemo } from 'react';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ArrowLeft, Mail } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

const EmailWidget = lazy(() => import('@/components/widgets/EmailWidget'));

export function MobileEmailView() {
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
          onClick={() => setMobileView('projects')}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Mail className="w-4 h-4 text-primary" />
        <h1 className="text-sm font-semibold">
          {language === 'ko' ? '이메일' : 'Email'}
        </h1>
      </div>

      {/* EmailWidget — full screen */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <EmailWidget context={context} />
        </Suspense>
      </div>
    </div>
  );
}

export default MobileEmailView;
