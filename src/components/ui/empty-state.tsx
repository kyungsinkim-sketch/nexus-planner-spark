import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { 
  FolderKanban, 
  Calendar, 
  MessageSquare, 
  FileText, 
  Users,
  Search,
  Inbox,
  LucideIcon
} from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-6 text-center',
      className
    )}>
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

// Preset Empty States
export function NoProjectsEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={FolderKanban}
      title="No projects yet"
      description="Create your first project to start managing your work"
      action={onAction ? { label: 'Create Project', onClick: onAction } : undefined}
    />
  );
}

export function NoEventsEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No events scheduled"
      description="Add events to your calendar to keep track of important dates"
      action={onAction ? { label: 'Add Event', onClick: onAction } : undefined}
    />
  );
}

export function NoMessagesEmpty() {
  return (
    <EmptyState
      icon={MessageSquare}
      title="No messages yet"
      description="Start a conversation with your team"
    />
  );
}

export function NoFilesEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No files uploaded"
      description="Upload files to share with your team"
      action={onAction ? { label: 'Upload File', onClick: onAction } : undefined}
    />
  );
}

export function NoTeamMembersEmpty({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No team members"
      description="Add team members to collaborate on this project"
      action={onAction ? { label: 'Add Member', onClick: onAction } : undefined}
    />
  );
}

export function NoSearchResultsEmpty({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={query ? `No results for "${query}"` : 'Try adjusting your search terms'}
    />
  );
}