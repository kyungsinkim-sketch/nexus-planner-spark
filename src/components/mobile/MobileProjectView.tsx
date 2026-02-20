/**
 * MobileProjectView — 프로젝트 탭 기반 모바일 뷰
 *
 * 상단: 프로젝트명 + 뒤로가기
 * 중간: 스와이프 가능 탭 (채팅 / 캘린더 / 할 일 / 기록 / 알림)
 * 하단: 선택된 탭 콘텐츠 (전체 화면)
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  ArrowLeft,
  MessageSquare,
  Calendar,
  CheckSquare,
  BookMarked,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetDataContext } from '@/types/widget';

// Lazy load the actual widget components
const ChatPanel = lazy(() => import('@/components/chat/ChatPanel').then(m => ({ default: m.ChatPanel })));
const CalendarWidget = lazy(() => import('@/components/widgets/CalendarWidget'));
const TodosWidget = lazy(() => import('@/components/widgets/TodosWidget'));
const ImportantNotesWidget = lazy(() => import('@/components/widgets/ImportantNotesWidget'));
const NotificationsWidget = lazy(() => import('@/components/widgets/NotificationsWidget'));

type MobileProjectTab = 'chat' | 'calendar' | 'todos' | 'notes' | 'notifications';

const TAB_CONFIG: Array<{ id: MobileProjectTab; icon: typeof MessageSquare; labelKo: string; labelEn: string }> = [
  { id: 'chat',          icon: MessageSquare, labelKo: '채팅',   labelEn: 'Chat' },
  { id: 'calendar',      icon: Calendar,      labelKo: '캘린더', labelEn: 'Calendar' },
  { id: 'todos',         icon: CheckSquare,   labelKo: '할 일',  labelEn: 'Todos' },
  { id: 'notes',         icon: BookMarked,    labelKo: '기록',   labelEn: 'Notes' },
  { id: 'notifications', icon: Bell,          labelKo: '알림',   labelEn: 'Alerts' },
];

interface MobileProjectViewProps {
  projectId: string;
}

export function MobileProjectView({ projectId }: MobileProjectViewProps) {
  const [activeTab, setActiveTab] = useState<MobileProjectTab>('chat');
  const { getProjectById } = useAppStore();
  const { setActiveTab: setWidgetActiveTab, closeProjectTab } = useWidgetStore();
  const { language } = useTranslation();

  const project = getProjectById(projectId);

  const context: WidgetDataContext = useMemo(() => ({
    type: 'project' as const,
    projectId,
  }), [projectId]);

  const handleBack = () => {
    setWidgetActiveTab('dashboard');
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {language === 'ko' ? '프로젝트를 찾을 수 없습니다' : 'Project not found'}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Project Header */}
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-3 border-b"
        style={{
          backgroundColor: project.keyColor ? `${project.keyColor}15` : undefined,
        }}
      >
        <button
          onClick={handleBack}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div
          className="w-2 h-8 rounded-full shrink-0"
          style={{ backgroundColor: project.keyColor || 'hsl(var(--primary))' }}
        />
        <h1 className="text-sm font-semibold truncate flex-1">{project.title}</h1>
      </div>

      {/* Tab Bar */}
      <div className="shrink-0 flex border-b overflow-x-auto scrollbar-hide">
        {TAB_CONFIG.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 shrink-0',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {language === 'ko' ? tab.labelKo : tab.labelEn}
            </button>
          );
        })}
      </div>

      {/* Tab Content — full screen */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {activeTab === 'chat' && (
            <div className="h-full">
              <ChatPanel defaultProjectId={projectId} />
            </div>
          )}
          {activeTab === 'calendar' && (
            <div className="h-full overflow-y-auto p-2">
              <CalendarWidget context={context} />
            </div>
          )}
          {activeTab === 'todos' && (
            <div className="h-full overflow-y-auto p-3">
              <TodosWidget context={context} />
            </div>
          )}
          {activeTab === 'notes' && (
            <div className="h-full overflow-y-auto p-3">
              <ImportantNotesWidget context={context} />
            </div>
          )}
          {activeTab === 'notifications' && (
            <div className="h-full overflow-y-auto p-3">
              <NotificationsWidget context={context} />
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default MobileProjectView;
