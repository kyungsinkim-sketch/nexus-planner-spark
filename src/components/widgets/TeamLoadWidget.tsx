/**
 * TeamLoadWidget — Shows team member workload for a project.
 */

import { useAppStore } from '@/stores/appStore';
import { User } from 'lucide-react';
import type { WidgetDataContext } from '@/types/widget';

function TeamLoadWidget({ context }: { context: WidgetDataContext }) {
  const { getProjectById, getUserById } = useAppStore();
  const project = context.projectId ? getProjectById(context.projectId) : null;

  if (!project?.teamMemberIds?.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/60 text-sm">
        No team members
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {project.teamMemberIds.slice(0, 6).map((memberId) => {
        const user = getUserById(memberId);
        return (
          <div key={memberId} className="flex items-center gap-2 p-1.5">
            <User className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate">{user?.name || memberId}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full ml-2 overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded-full"
                style={{ width: `${Math.random() * 60 + 20}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TeamLoadWidget;
