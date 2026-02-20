/**
 * MobileProjectView — 모바일 프로젝트 메인 뷰
 *
 * 이중 상태 관리:
 * - State A (프로젝트 미선택): 프로젝트 카드 리스트 표시
 * - State B (프로젝트 선택): 프로젝트 전환 칩 + 할 일/기록/파일 서브탭
 */

import { useState, useMemo, lazy, Suspense } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import {
  ArrowLeft,
  CheckSquare,
  BookMarked,
  FileIcon,
  FolderKanban,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetDataContext } from '@/types/widget';

// Lazy load widget components
const TodosWidget = lazy(() => import('@/components/widgets/TodosWidget'));
const ImportantNotesWidget = lazy(() => import('@/components/widgets/ImportantNotesWidget'));
const FilesWidget = lazy(() => import('@/components/widgets/FilesWidget'));

type MobileProjectTab = 'todos' | 'notes' | 'files';

const TAB_CONFIG: Array<{ id: MobileProjectTab; icon: typeof CheckSquare; labelKo: string; labelEn: string }> = [
  { id: 'todos', icon: CheckSquare, labelKo: '할 일', labelEn: 'Todos' },
  { id: 'notes', icon: BookMarked, labelKo: '중요 기록', labelEn: 'Notes' },
  { id: 'files', icon: FileIcon, labelKo: '파일', labelEn: 'Files' },
];

export function MobileProjectView() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MobileProjectTab>('todos');
  const { projects } = useAppStore();
  const { language } = useTranslation();

  // Filter active projects (same as desktop ProjectsWidget)
  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status === 'ACTIVE');
  }, [projects]);

  const selectedProject = selectedProjectId
    ? projects.find(p => p.id === selectedProjectId)
    : null;

  const context: WidgetDataContext = useMemo(() => ({
    type: 'project' as const,
    projectId: selectedProjectId || undefined,
  }), [selectedProjectId]);

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveTab('todos');
  };

  const handleBack = () => {
    setSelectedProjectId(null);
  };

  // ─── State A: Project List ───
  if (!selectedProjectId || !selectedProject) {
    return (
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="p-4 space-y-3 pb-6">
          {/* Header */}
          <div className="flex items-center gap-2 px-1 pt-1 pb-2">
            <FolderKanban className="w-4 h-4 text-primary" />
            <h1 className="text-base font-bold flex-1">
              {language === 'ko' ? '프로젝트' : 'Projects'}
            </h1>
            <span className="text-xs text-muted-foreground">
              {activeProjects.length}{language === 'ko' ? '개 진행 중' : ' active'}
            </span>
          </div>

          {/* Project Cards */}
          {activeProjects.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground/60">
              {language === 'ko' ? '참여 중인 프로젝트가 없습니다' : 'No active projects'}
            </div>
          ) : (
            <div className="space-y-2">
              {activeProjects.map(project => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project.id)}
                  className="w-full bg-card rounded-2xl border shadow-sm p-4 flex items-center gap-3 active:scale-[0.98] transition-transform text-left"
                >
                  {/* Thumbnail or color */}
                  {project.thumbnail ? (
                    <div
                      className="w-10 h-10 rounded-xl shrink-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${project.thumbnail})` }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: project.keyColor || 'hsl(var(--primary))' }}
                    >
                      {project.title.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600">
                        {language === 'ko' ? '진행 중' : 'Active'}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── State B: Project Detail (Todos / Notes / Files) ───
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Project Header */}
      <div
        className="shrink-0 px-4 py-3 flex items-center gap-3 border-b"
        style={{
          backgroundColor: selectedProject.keyColor ? `${selectedProject.keyColor}15` : undefined,
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
          style={{ backgroundColor: selectedProject.keyColor || 'hsl(var(--primary))' }}
        />
        <h1 className="text-sm font-semibold truncate flex-1">{selectedProject.title}</h1>
      </div>

      {/* Project Switcher Chips */}
      {activeProjects.length > 1 && (
        <div className="shrink-0 flex gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide border-b bg-background">
          {activeProjects.map(p => {
            const isSelected = p.id === selectedProjectId;
            return (
              <button
                key={p.id}
                onClick={() => handleSelectProject(p.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium shrink-0 transition-colors border',
                  isSelected
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground'
                )}
              >
                {p.thumbnail ? (
                  <div
                    className="w-4 h-4 rounded-full bg-cover bg-center shrink-0"
                    style={{ backgroundImage: `url(${p.thumbnail})` }}
                  />
                ) : (
                  <div
                    className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white text-[8px] font-bold"
                    style={{ backgroundColor: p.keyColor || 'hsl(var(--primary))' }}
                  >
                    {p.title.charAt(0)}
                  </div>
                )}
                <span className="truncate max-w-[80px]">{p.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-Tab Bar */}
      <div className="shrink-0 flex border-b">
        {TAB_CONFIG.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center justify-center gap-1.5 flex-1 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2',
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

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        }>
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
          {activeTab === 'files' && (
            <div className="h-full overflow-y-auto p-3">
              <FilesWidget context={context} />
            </div>
          )}
        </Suspense>
      </div>
    </div>
  );
}

export default MobileProjectView;
