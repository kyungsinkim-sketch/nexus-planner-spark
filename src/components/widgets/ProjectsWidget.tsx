/**
 * ProjectsWidget — Shows project list with status filter (Dashboard only).
 * Clicking a project opens it as a tab.
 */

import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { FolderKanban } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

type StatusFilter = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'ALL';

function ProjectsWidget({ context: _context }: { context: WidgetDataContext }) {
  const { projects } = useAppStore();
  const { openProjectTab } = useWidgetStore();
  const [filter, setFilter] = useState<StatusFilter>('ACTIVE');

  const filtered = useMemo(() => {
    if (filter === 'ALL') return projects;
    return projects.filter((p) => p.status === filter);
  }, [projects, filter]);

  const statusCounts = useMemo(() => ({
    ACTIVE: projects.filter((p) => p.status === 'ACTIVE').length,
    COMPLETED: projects.filter((p) => p.status === 'COMPLETED').length,
    ARCHIVED: projects.filter((p) => p.status === 'ARCHIVED').length,
  }), [projects]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter buttons */}
      <div className="flex gap-1 mb-2 shrink-0">
        {(['ACTIVE', 'COMPLETED', 'ARCHIVED'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(filter === status ? 'ALL' : status)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              filter === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-white/10 text-muted-foreground hover:bg-white/20'
            }`}
          >
            {status} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-auto space-y-1.5">
        {filtered.map((project) => (
          <button
            key={project.id}
            onClick={() => openProjectTab(project.id, project.title, project.keyColor)}
            className="w-full text-left p-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: project.keyColor || 'hsl(234 89% 60%)' }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{project.title}</p>
              <p className="text-[10px] text-muted-foreground">{project.client}</p>
            </div>
            {project.progress !== undefined && (
              <span className="text-xs text-muted-foreground shrink-0">{project.progress}%</span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground/60 text-sm">
            <FolderKanban className="w-4 h-4 mr-2" /> No projects
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectsWidget;
