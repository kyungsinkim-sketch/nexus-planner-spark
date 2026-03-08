import { useState, useMemo, lazy, Suspense } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Bell, FolderOpen, CheckSquare, StickyNote, MessageCircle, LayoutGrid, Pencil } from 'lucide-react';

const TodosWidget = lazy(() => import('@/components/widgets/TodosWidget'));
const FilesWidget = lazy(() => import('@/components/widgets/FilesWidget'));
const ChatWidget = lazy(() => import('@/components/widgets/ChatWidget'));
const ImportantNotesWidget = lazy(() => import('@/components/widgets/ImportantNotesWidget'));
const NotificationsWidget = lazy(() => import('@/components/widgets/NotificationsWidget'));
const ProjectBoardWidget = lazy(() => import('@/components/widgets/ProjectBoardWidget'));

type ProjectViewStep = 'list' | 'detail' | 'widget';

interface WidgetDef {
  key: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const WIDGETS: WidgetDef[] = [
  { key: 'notifications', label: 'Notifications', icon: Bell, badge: 3 },
  { key: 'files', label: 'Files', icon: FolderOpen },
  { key: 'todos', label: 'ToDos', icon: CheckSquare, badge: 5 },
  { key: 'notes', label: 'Notes', icon: StickyNote },
  { key: 'chat', label: 'Chat', icon: MessageCircle, badge: 2 },
  { key: 'board', label: 'Board', icon: LayoutGrid },
];

const WIDGET_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  notifications: NotificationsWidget,
  files: FilesWidget,
  todos: TodosWidget,
  notes: ImportantNotesWidget,
  chat: ChatWidget,
  board: ProjectBoardWidget,
};

const GLASS = 'bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl';

export function MobileProjectsView() {
  const { t } = useTranslation();
  const projects = useAppStore((s) => s.projects);
  const users = useAppStore((s) => s.users);

  const [step, setStep] = useState<ProjectViewStep>('list');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const teamMembers = useMemo(() => {
    if (!selectedProject?.teamMemberIds) return [];
    return selectedProject.teamMemberIds
      .map((uid) => users.find((u) => u.id === uid))
      .filter(Boolean);
  }, [selectedProject, users]);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setStep('detail');
  };

  const handleSelectWidget = (key: string) => {
    setSelectedWidget(key);
    setStep('widget');
  };

  const handleBack = () => {
    if (step === 'widget') {
      setSelectedWidget(null);
      setStep('detail');
    } else if (step === 'detail') {
      setSelectedProjectId(null);
      setStep('list');
    }
  };

  // --- Render helpers ---

  const renderProjectCard = (
    project: typeof projects[number],
    height: string,
    onClick?: () => void,
  ) => (
    <div
      key={project.id}
      className={cn(
        'relative overflow-hidden rounded-2xl transition-transform active:scale-[0.98]',
        height,
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
      style={
        !project.thumbnail
          ? { background: `linear-gradient(135deg, ${project.keyColor || '#6366f1'}, ${project.keyColor || '#6366f1'}88)` }
          : undefined
      }
    >
      {project.thumbnail && (
        <img
          src={project.thumbnail}
          alt={project.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <span className="absolute bottom-3 left-4 text-white font-bold text-lg drop-shadow-md">
        {project.title}
      </span>
    </div>
  );

  // --- Step 1: Project List ---
  if (step === 'list') {
    return (
      <div className="flex flex-col gap-3 px-4 pt-4 pb-24 overflow-y-auto h-full">
        {projects.map((p) => renderProjectCard(p, 'h-[180px]', () => handleSelectProject(p.id)))}
      </div>
    );
  }

  // --- Step 2: Project Detail ---
  if (step === 'detail' && selectedProject) {
    return (
      <div className="flex flex-col h-full overflow-y-auto pb-24">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="absolute top-3 left-3 z-20 p-2 rounded-full bg-black/30 backdrop-blur-md text-white"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Cover */}
        <div className="px-4 pt-4">
          {renderProjectCard(selectedProject, 'h-[120px]')}
        </div>

        {/* Avatars */}
        {teamMembers.length > 0 && (
          <div className="flex -space-x-2 px-4 mt-3">
            {teamMembers.map((u: any) => (
              <Avatar key={u.id} className="h-8 w-8 border-2 border-white dark:border-gray-900">
                <AvatarImage src={u.avatar} alt={u.name} />
                <AvatarFallback className="text-xs">{u.name?.[0] ?? '?'}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        )}

        {/* Widget Grid */}
        <div className="grid grid-cols-2 gap-3 px-4 mt-4">
          {WIDGETS.map((w) => {
            const Icon = w.icon;
            return (
              <button
                key={w.key}
                onClick={() => handleSelectWidget(w.key)}
                className={cn(
                  GLASS,
                  'relative flex flex-col items-center justify-center gap-2 py-6 transition-transform active:scale-[0.98]',
                )}
              >
                {w.badge != null && w.badge > 0 && (
                  <span className="absolute top-2 right-2 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold px-1">
                    {w.badge}
                  </span>
                )}
                <Icon size={26} className="text-foreground/70" />
                <span className="text-xs font-medium text-foreground/80">{w.label}</span>
              </button>
            );
          })}
        </div>

        {/* AI Input Bar */}
        <div className="px-4 mt-4">
          <div className={cn(GLASS, 'flex items-center gap-3 px-4 py-3')}>
            <Pencil size={18} className="text-foreground/50" />
            <span className="text-sm text-foreground/40">Ask AI about this project…</span>
          </div>
        </div>
      </div>
    );
  }

  // --- Step 3: Widget Fullscreen ---
  if (step === 'widget' && selectedProject && selectedWidget) {
    const WidgetComponent = WIDGET_COMPONENTS[selectedWidget];
    const widgetDef = WIDGETS.find((w) => w.key === selectedWidget);

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2">
          <button
            onClick={handleBack}
            className="p-2 rounded-full bg-black/10 dark:bg-white/10 text-foreground"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="font-semibold text-base flex-1">{widgetDef?.label}</span>
        </div>

        {/* Compressed project strip */}
        <div className="px-4 mb-2">
          {renderProjectCard(selectedProject, 'h-[60px]')}
        </div>

        {/* Widget content */}
        <div className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-32 text-foreground/40 text-sm">
                Loading…
              </div>
            }
          >
            {WidgetComponent && (
              <WidgetComponent context={{ type: 'project', projectId: selectedProject.id }} />
            )}
          </Suspense>
        </div>
      </div>
    );
  }

  return null;
}

export default MobileProjectsView;
