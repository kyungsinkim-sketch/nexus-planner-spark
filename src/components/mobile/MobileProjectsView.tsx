/**
 * MobileProjectsView — Phase 3 Projects tab
 *
 * 3-step drill-down:
 * 1. Project card stack (vertical scroll)
 * 2. Project detail (cover + team + widget icon grid)
 * 3. Widget fullscreen
 */

import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, Bell, FolderOpen, CheckSquare,
  StickyNote, MessageCircle, LayoutGrid, Pencil, FileText,
} from 'lucide-react';

// Lazy-load widget components
const TodosWidget = lazy(() => import('@/components/widgets/TodosWidget'));
const FilesWidget = lazy(() => import('@/components/widgets/FilesWidget'));
const ChatWidget = lazy(() => import('@/components/widgets/ChatWidget'));
const LivingNotesWidget = lazy(() => import('@/components/widgets/LivingNotesWidget'));
const NotificationsWidget = lazy(() => import('@/components/widgets/NotificationsWidget'));
const ProjectBoardWidget = lazy(() => import('@/components/widgets/ProjectBoardWidget'));

type ViewStep = 'list' | 'detail' | 'widget';

const WIDGET_DEFS = [
  { key: 'notifications', labelKo: '알림', labelEn: 'Notifications', icon: Bell, badge: 0 },
  { key: 'files', labelKo: '파일', labelEn: 'Files', icon: FolderOpen, badge: 0 },
  { key: 'todos', labelKo: '할 일', labelEn: 'ToDos', icon: CheckSquare, badge: 0 },
  { key: 'chat', labelKo: '채팅', labelEn: 'Chat', icon: MessageCircle, badge: 0 },
  { key: 'notes', labelKo: '기록', labelEn: 'Notes', icon: FileText, badge: 0 },
  { key: 'board', labelKo: '보드', labelEn: 'Board', icon: LayoutGrid, badge: 0 },
] as const;

const WIDGET_MAP: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  notifications: NotificationsWidget,
  files: FilesWidget,
  todos: TodosWidget,
  notes: LivingNotesWidget,
  chat: ChatWidget,
  board: ProjectBoardWidget,
};

export function MobileProjectsView() {
  const { t, language } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const users = useAppStore((s) => s.users);

  const [step, setStep] = useState<ViewStep>('list');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');

  // Consume navigation intent from widgetStore (e.g. notification click → project chat)
  const mobileProjectNav = useWidgetStore((s) => s.mobileProjectNav);
  useEffect(() => {
    if (mobileProjectNav) {
      setProjectId(mobileProjectNav.projectId);
      if (mobileProjectNav.widget) {
        setWidgetKey(mobileProjectNav.widget);
        setStep('widget');
      } else {
        setStep('detail');
      }
      useWidgetStore.setState({ mobileProjectNav: null });
    }
  }, [mobileProjectNav]);

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.status === statusFilter),
    [projects, statusFilter],
  );

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);

  const teamMembers = useMemo(() => {
    if (!project?.teamMemberIds?.length) return [];
    return project.teamMemberIds
      .map((uid) => users.find((u) => u.id === uid))
      .filter(Boolean) as typeof users;
  }, [project, users]);

  // ── Project Cover Card ──
  function ProjectCover({
    proj,
    height,
    onClick,
  }: {
    proj: typeof projects[number];
    height: number;
    onClick?: () => void;
  }) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl flex-shrink-0',
          onClick && 'cursor-pointer active:scale-[0.98] transition-transform',
        )}
        style={{
          height,
          background: proj.thumbnail
            ? undefined
            : `linear-gradient(135deg, ${proj.keyColor || 'hsl(var(--primary))'}, ${proj.keyColor || 'hsl(var(--primary))'}88)`,
        }}
        onClick={onClick}
      >
        {proj.thumbnail && (
          <img
            src={proj.thumbnail}
            alt={proj.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Project name */}
        <span className="absolute bottom-4 left-4 typo-h3 text-white font-bold drop-shadow-lg">
          {proj.title}
        </span>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // Step 1: Project List
  // ═══════════════════════════════════════
  if (step === 'list') {
    return (
      <div className="h-full overflow-y-auto overscroll-none widget-area-bg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-6 pb-3">
          <h1 className="typo-h2 text-foreground font-bold">
            {language === 'ko' ? '프로젝트' : 'Projects'}
          </h1>
          {/* Active / Completed toggle */}
          <div className="flex rounded-full mobile-glass p-0.5">
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                statusFilter === 'ACTIVE'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {language === 'ko' ? '활성' : 'Active'}
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                statusFilter === 'COMPLETED'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {language === 'ko' ? '완료' : 'Done'}
            </button>
          </div>
        </div>

        {/* Project cards */}
        <div className="flex flex-col gap-3 px-4 pb-24">
          {filteredProjects.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <p className="typo-widget-sub text-muted-foreground">
                {statusFilter === 'ACTIVE'
                  ? (language === 'ko' ? '활성 프로젝트가 없습니다' : 'No active projects')
                  : (language === 'ko' ? '완료된 프로젝트가 없습니다' : 'No completed projects')}
              </p>
            </div>
          ) : (
            filteredProjects.map((p, idx) => (
              <div key={p.id} className="relative" style={{ marginBottom: idx < filteredProjects.length - 1 ? -8 : 0 }}>
                {/* Stacked card shadow layers behind */}
                {idx < filteredProjects.length - 1 && (
                  <>
                    <div
                      className="absolute left-2 right-2 rounded-2xl"
                      style={{
                        bottom: -4,
                        height: 12,
                        background: 'var(--stack-bg-1, rgba(128,128,128,0.15))',
                        filter: 'blur(1px)',
                        zIndex: 0,
                      }}
                    />
                    <div
                      className="absolute left-4 right-4 rounded-2xl"
                      style={{
                        bottom: -7,
                        height: 10,
                        background: 'var(--stack-bg-2, rgba(128,128,128,0.08))',
                        filter: 'blur(2px)',
                        zIndex: 0,
                      }}
                    />
                  </>
                )}
                <div className="relative z-10">
                  <ProjectCover
                    proj={p}
                    height={180}
                    onClick={() => {
                      setProjectId(p.id);
                      setStep('detail');
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // Step 2: Project Detail
  // ═══════════════════════════════════════
  if (step === 'detail' && project) {
    return (
      <div className="h-full overflow-y-auto overscroll-none widget-area-bg">
        {/* Back button */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => { setProjectId(null); setStep('list'); }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="typo-label">{language === 'ko' ? '뒤로' : 'Back'}</span>
          </button>
        </div>

        {/* Cover card (shrunk) */}
        <div className="px-4">
          <ProjectCover proj={project} height={140} />
        </div>

        {/* Team members */}
        {teamMembers.length > 0 && (
          <div className="flex items-center gap-1 px-4 mt-3">
            <div className="flex -space-x-2">
              {teamMembers.slice(0, 6).map((u) => (
                <Avatar key={u.id} className="w-8 h-8 border-2 border-background">
                  <AvatarImage src={u.avatar} alt={u.name} />
                  <AvatarFallback className="typo-micro bg-primary/10 text-primary font-medium">
                    {u.name?.slice(-2) || '?'}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            {teamMembers.length > 6 && (
              <span className="typo-caption text-muted-foreground ml-1">
                +{teamMembers.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Widget bento grid — mini widget preview cards */}
        <div className="grid grid-cols-2 gap-3 px-4 mt-5 pb-24">
          {WIDGET_DEFS.map((w) => {
            const Icon = w.icon;
            const WidgetComp = WIDGET_MAP[w.key];
            return (
              <button
                key={w.key}
                onClick={() => { setWidgetKey(w.key); setStep('widget'); }}
                className={cn(
                  'relative flex flex-col rounded-2xl overflow-hidden text-left',
                  'mobile-glass',
                  'active:scale-[0.97] transition-transform',
                )}
              >
                {/* Header with icon + label */}
                <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                  <Icon size={16} strokeWidth={1.5} className="text-primary/70 shrink-0" />
                  <span className="typo-caption font-semibold text-foreground/80 truncate">
                    {language === 'ko' ? w.labelKo : w.labelEn}
                  </span>
                  {w.badge > 0 && (
                    <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                      {w.badge}
                    </span>
                  )}
                </div>
                {/* Mini preview — render actual widget in compact mode */}
                <div className="px-3 pb-3 h-[100px] overflow-hidden opacity-60 pointer-events-none">
                  {WidgetComp ? (
                    <div className="transform scale-[0.65] origin-top-left w-[154%]">
                      <WidgetComp context={{ type: 'project', projectId: project.id }} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground/30">
                      <Icon size={40} strokeWidth={1} />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════
  // Step 3: Widget Fullscreen
  // ═══════════════════════════════════════
  if (step === 'widget' && project && widgetKey) {
    const WidgetComp = WIDGET_MAP[widgetKey];
    const wDef = WIDGET_DEFS.find((w) => w.key === widgetKey);

    return (
      <div className="flex flex-col h-full widget-area-bg">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 shrink-0">
          <button
            onClick={() => { setWidgetKey(null); setStep('detail'); }}
            className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <span className="typo-h4 text-foreground font-semibold flex-1">
            {wDef ? (language === 'ko' ? wDef.labelKo : wDef.labelEn) : ''}
          </span>
        </div>

        {/* Mini project strip */}
        <div className="px-4 py-2 shrink-0">
          <ProjectCover proj={project} height={56} />
        </div>

        {/* Widget content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            {WidgetComp && (
              <WidgetComp context={{ type: 'project', projectId: project.id }} />
            )}
          </Suspense>
        </div>
      </div>
    );
  }

  return null;
}

export default MobileProjectsView;
