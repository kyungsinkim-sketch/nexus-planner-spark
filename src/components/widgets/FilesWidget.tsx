/**
 * FilesWidget — Shows file groups.
 * Dashboard: all files. Project: project files.
 */

import { useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { FileText, Folder } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function FilesWidget({ context }: { context: WidgetDataContext }) {
  const { fileGroups, files } = useAppStore();

  const filteredGroups = useMemo(() => {
    if (context.type === 'project' && context.projectId) {
      return fileGroups.filter((g) => g.projectId === context.projectId);
    }
    return fileGroups.slice(0, 8);
  }, [fileGroups, context]);

  if (filteredGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        No files yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredGroups.map((group) => {
        const groupFiles = files.filter((f) => f.fileGroupId === group.id);
        return (
          <div key={group.id} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">{group.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{groupFiles.length} files</span>
            </div>
            {groupFiles.length > 0 && (
              <div className="mt-1 pl-6 space-y-0.5">
                {groupFiles.slice(0, 3).map((f) => (
                  <div key={f.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3" />
                    <span className="truncate">{f.name}</span>
                  </div>
                ))}
                {groupFiles.length > 3 && (
                  <p className="text-xs text-muted-foreground/50">+{groupFiles.length - 3} more</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default FilesWidget;
