import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Clock, Users, TrendingUp } from 'lucide-react';
import { Project } from '@/types/core';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
    project: Project;
    onClick: () => void;
}

export const ProjectCard = memo(function ProjectCard({ project, onClick }: ProjectCardProps) {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    const priorityColors = {
        HIGH: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400',
        MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400',
        LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400',
    };

    return (
        <Card
            className="cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 group bg-card/70 backdrop-blur-sm"
            onClick={onClick}
        >
            {/* Project Key Color Header */}
            {project.keyColor && (
                <div
                    className="h-2 rounded-t-lg"
                    style={{ backgroundColor: project.keyColor }}
                />
            )}

            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                            {project.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                            {project.client}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        {project.keyColor && (
                            <div
                                className="w-3 h-3 rounded-full border-2 border-background shadow-sm"
                                style={{ backgroundColor: project.keyColor }}
                            />
                        )}
                        {project.priority && (
                            <Badge variant="outline" className={cn('text-xs', priorityColors[project.priority])}>
                                {project.priority}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Progress */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{project.progress}%</span>
                    </div>
                    <Progress
                        value={project.progress}
                        className="h-2"
                        style={{
                            '--progress-color': project.keyColor || 'hsl(var(--primary))'
                        } as React.CSSProperties}
                    />
                </div>

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(project.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{project.teamMemberIds?.length || 0}</span>
                    </div>
                </div>

                {/* Tasks */}
                {project.tasksCompleted !== undefined && project.tasksTotal !== undefined && (
                    <div className="flex items-center gap-2 text-xs">
                        <TrendingUp className="w-3 h-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                            {project.tasksCompleted}/{project.tasksTotal} tasks
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
});
