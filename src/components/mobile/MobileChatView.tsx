/**
 * MobileChatView — 전체화면 모바일 채팅
 *
 * ChatPanel을 전체화면으로 래핑.
 * defaultProjectId 없이 호출 → ChatPanel 내부에서 프로젝트/DM 채팅 목록 표시.
 */

import { lazy, Suspense } from 'react';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ArrowLeft, MessageSquare } from 'lucide-react';

const ChatPanel = lazy(() =>
  import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel }))
);

export function MobileChatView() {
  const { setMobileView } = useWidgetStore();
  const { language } = useTranslation();

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
        <MessageSquare className="w-4 h-4 text-primary" />
        <h1 className="text-sm font-semibold">
          {language === 'ko' ? '채팅' : 'Chat'}
        </h1>
      </div>

      {/* ChatPanel — full screen */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <ChatPanel />
        </Suspense>
      </div>
    </div>
  );
}

export default MobileChatView;
