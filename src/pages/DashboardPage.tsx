import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import {
    Search,
    ArrowRight,
    Sparkles,
    CheckCircle2,
    Circle,
    Calendar as CalendarIcon,
    TrendingUp,
    FolderKanban,
    ListTodo,
    Clock,
    FileUp,
    MessageSquare,
    Flag,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslationKey } from '@/lib/i18n';
import { Project } from '@/types/core';
import { ProjectProgressChart } from '@/components/dashboard/ProjectProgressChart';
import { ActivityChart } from '@/components/dashboard/ActivityChart';

// Time-based greeting
function getGreeting(t: (key: TranslationKey) => string): string {
    const hour = new Date().getHours();
    if (hour < 6) return t('greetingNight');
    if (hour < 12) return t('greetingMorning');
    if (hour < 18) return t('greetingAfternoon');
    return t('greetingEvening');
}

export default function DashboardPage() {
    const navigate = useNavigate();
    const { currentUser, projects, personalTodos, completeTodo, getProjectById, events } = useAppStore();
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');

    // Handle todo completion
    const handleCompleteTodo = async (todoId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await completeTodo(todoId);
        } catch (error) {
            console.error('Failed to complete todo:', error);
        }
    };

    // Filter active projects
    const activeProjects = projects.filter(p => p.status === 'ACTIVE');

    // Filter projects based on search
    const filteredProjects = activeProjects.filter(project => {
        return project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.client.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Get user's pending todos
    const myTodos = currentUser ? personalTodos.filter(
        todo => todo.assigneeIds.includes(currentUser.id) && todo.status === 'PENDING'
    ).slice(0, 5) : [];

    // Upcoming events (next 7 days)
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingEvents = events.filter(e => {
        const eventDate = new Date(e.startAt);
        return eventDate >= now && eventDate <= weekLater;
    }).length;

    // Calculate project progress
    const calculateProgress = (project: Project) => {
        if (project.progress !== undefined) return project.progress;
        const start = new Date(project.startDate).getTime();
        const end = new Date(project.endDate).getTime();
        const current = Date.now();
        if (current < start) return 0;
        if (current > end) return 100;
        return Math.round(((current - start) / (end - start)) * 100);
    };

    // Get phase label based on progress
    const getPhaseLabel = (progress: number) => {
        if (progress < 30) return { label: t('strategy'), color: 'bg-purple-500' };
        if (progress < 70) return { label: t('production'), color: 'bg-green-500' };
        return { label: t('deliveryPhase'), color: 'bg-blue-500' };
    };

    // Calculate days remaining
    const getDaysRemaining = (endDate: string) => {
        const end = new Date(endDate).getTime();
        const days = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
        return days;
    };

    // Recent activity (mock from project data)
    const recentActivity = [
        ...projects.slice(0, 2).map(p => ({
            id: `file-${p.id}`,
            icon: FileUp,
            text: `${p.title} - ${t('newFileUpload')}`,
            time: t('justNow'),
            color: 'text-blue-500',
        })),
        ...projects.slice(0, 1).map(p => ({
            id: `msg-${p.id}`,
            icon: MessageSquare,
            text: `${p.title} - ${t('newChatMessage')}`,
            time: `10${t('minutesAgo')}`,
            color: 'text-emerald-500',
        })),
        ...projects.slice(1, 2).map(p => ({
            id: `flag-${p.id}`,
            icon: Flag,
            text: `${p.title} - ${t('milestoneComplete')}`,
            time: `1${t('hoursAgo')}`,
            color: 'text-amber-500',
        })),
    ].slice(0, 5);

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Greeting Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                        {getGreeting(t)}, {currentUser?.name || ''} 👋
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {t('whatsHappeningToday')}
                    </p>
                </div>

                {/* Summary Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="border-border/50 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/projects')}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{t('activeProjects')}</p>
                                    <p className="text-3xl font-bold text-foreground mt-1">{activeProjects.length}</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <FolderKanban className="w-5 h-5 text-primary" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{t('pendingTasks')}</p>
                                    <p className="text-3xl font-bold text-foreground mt-1">{myTodos.length}</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <ListTodo className="w-5 h-5 text-amber-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/calendar')}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">{t('weeklySchedule')}</p>
                                    <p className="text-3xl font-bold text-foreground mt-1">{upcomingEvents}</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                    <CalendarIcon className="w-5 h-5 text-violet-500" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-2xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder={t('searchProjects')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 bg-card border-border/50 focus-visible:ring-primary"
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: Projects */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* My Projects */}
                        <Card className="border-border/50">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <FolderKanban className="w-4 h-4" />
                                        {t('yourProjects')}
                                    </CardTitle>
                                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate('/projects')}>
                                        {t('viewAll')} <ArrowRight className="w-3 h-3" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {filteredProjects.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p>{t('noProjectsFound')}</p>
                                    </div>
                                ) : (
                                    filteredProjects.map((project) => {
                                        const progress = calculateProgress(project);
                                        const phase = getPhaseLabel(progress);
                                        const daysLeft = getDaysRemaining(project.endDate);
                                        const daysTotal = Math.ceil(
                                            (new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) /
                                            (1000 * 60 * 60 * 24)
                                        );

                                        return (
                                            <div
                                                key={project.id}
                                                onClick={() => navigate(`/projects/${project.id}`)}
                                                className="group flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:bg-accent/50 hover:border-primary/30 transition-all cursor-pointer"
                                            >
                                                {/* Thumbnail */}
                                                <div
                                                    className="w-14 h-14 rounded-lg flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden"
                                                    style={project.thumbnail ? { backgroundImage: `url(${project.thumbnail})`, backgroundSize: 'cover' } : {}}
                                                >
                                                    {!project.thumbnail && (
                                                        <Sparkles className="w-6 h-6 text-primary/50" />
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                                                {project.title}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground">{project.client}</p>
                                                        </div>
                                                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", phase.color, "text-white border-0")}>
                                                                    {phase.label}
                                                                </Badge>
                                                                {daysLeft > 0 ? (
                                                                    <span>D-{daysLeft}</span>
                                                                ) : (
                                                                    <span className="text-destructive">{t('deadline')}</span>
                                                                )}
                                                            </div>
                                                            <span>{progress}%</span>
                                                        </div>
                                                        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className={cn("absolute inset-y-0 left-0 rounded-full transition-all", phase.color)}
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>

                        {/* Charts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ProjectProgressChart projects={projects} />
                            <ActivityChart events={events} />
                        </div>
                    </div>

                    {/* Right Sidebar: Todos + Activity */}
                    <div className="space-y-4">

                        {/* My Todo List */}
                        <Card className="border-border/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <ListTodo className="w-4 h-4" />
                                    {t('myTodoList')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {myTodos.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                        <p className="text-sm">{t('allCaughtUp')}</p>
                                    </div>
                                ) : (
                                    myTodos.map((todo) => {
                                        const project = todo.projectId ? getProjectById(todo.projectId) : null;
                                        const projectColor = project?.keyColor;

                                        return (
                                            <div
                                                key={todo.id}
                                                onClick={(e) => handleCompleteTodo(todo.id, e)}
                                                className="relative flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors cursor-pointer group overflow-hidden"
                                            >
                                                {projectColor && (
                                                    <div
                                                        className="absolute left-0 top-0 bottom-0 w-1"
                                                        style={{ backgroundColor: projectColor }}
                                                    />
                                                )}
                                                <Circle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0 group-hover:text-primary transition-colors" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-foreground">{todo.title}</p>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        {project && (
                                                            <span
                                                                className="text-xs font-medium px-1.5 py-0.5 rounded"
                                                                style={{
                                                                    backgroundColor: projectColor ? `${projectColor}20` : 'transparent',
                                                                    color: projectColor || 'inherit'
                                                                }}
                                                            >
                                                                {project.title}
                                                            </span>
                                                        )}
                                                        {todo.dueDate && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {t('due')}: {new Date(todo.dueDate).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {todo.priority === 'HIGH' && (
                                                            <Badge variant="destructive" className="text-[10px] h-4">{t('high')}</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Activity */}
                        <Card className="border-border/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    {t('recentActivity')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {recentActivity.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">{t('noActivity')}</p>
                                ) : (
                                    recentActivity.map((activity) => {
                                        const ActivityIcon = activity.icon;
                                        return (
                                            <div key={activity.id} className="flex items-start gap-3">
                                                <div className={cn("w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5")}>
                                                    <ActivityIcon className={cn("w-3.5 h-3.5", activity.color)} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-foreground leading-tight">{activity.text}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
