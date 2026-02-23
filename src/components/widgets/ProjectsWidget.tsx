/**
 * ProjectsWidget — Shows project list as icon grid with thumbnails (Dashboard only).
 * Clicking a project opens it as a tab.
 * Displays thumbnail image or keyColor+initial fallback.
 * Includes search functionality toggled by projectSearchOpen store state.
 */

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { FolderKanban, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { WidgetDataContext } from '@/types/widget';

type StatusFilter = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'ALL';

/** Get first 1-2 initials from project title */
function getInitials(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function ProjectsWidget({ context: _context }: { context: WidgetDataContext }) {
  const { projects } = useAppStore();
  const projectSearchOpen = useAppStore((s) => s.projectSearchOpen);
  const setProjectSearchOpen = useAppStore((s) => s.setProjectSearchOpen);
  const { openProjectTab } = useWidgetStore();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<StatusFilter>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

  // Clear searchQuery when projectSearchOpen closes
  useEffect(() => {
    if (!projectSearchOpen) {
      setSearchQuery('');
    }
  }, [projectSearchOpen]);

  const filtered = useMemo(() => {
    let result = filter === 'ALL' ? projects : projects.filter((p) => p.status === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q)
      );
    }
    return result;
  }, [projects, filter, searchQuery]);

  const statusCounts = useMemo(() => ({
    ACTIVE: projects.filter((p) => p.status === 'ACTIVE').length,
    COMPLETED: projects.filter((p) => p.status === 'COMPLETED').length,
    ARCHIVED: projects.filter((p) => p.status === 'ARCHIVED').length,
  }), [projects]);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar — shown when projectSearchOpen */}
      {projectSearchOpen && (
        <div className="flex items-center gap-1.5 mb-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchProject')}
              className="pl-8 h-7 text-xs"
              autoFocus
            />
          </div>
          <button
            onClick={() => setProjectSearchOpen(false)}
            className="p-1 rounded hover:bg-white/20 transition-colors shrink-0"
            title={t('close')}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

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
            {t(status === 'ACTIVE' ? 'active' : status === 'COMPLETED' ? 'completed' : 'archived')} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {/* Project icon grid */}
      <div className="flex-1 overflow-auto">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {filtered.map((project) => (
              <button
                key={project.id}
                onClick={() => openProjectTab(project.id, project.title, project.keyColor)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 transition-colors text-center"
                title={project.title}
              >
                {/* Thumbnail or keyColor initial */}
                {project.thumbnail ? (
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-muted">
                    <img
                      src={project.thumbnail}
                      alt={project.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: project.keyColor || '#6366f1' }}
                  >
                    <span className="text-white text-sm font-bold">{getInitials(project.title)}</span>
                  </div>
                )}
                <p className="text-[10px] font-medium text-foreground line-clamp-2 leading-tight w-full">
                  {project.title}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground/60 text-sm">
            <FolderKanban className="w-4 h-4 mr-2" /> {t('noProjects')}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectsWidget;
