import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';
import {
    Search,
    ArrowRight,
    Cloud,
    CloudRain,
    Sun,
    CloudSnow,
    Sparkles,
    Bell,
    CheckCircle2,
    Circle,
    Calendar as CalendarIcon,
    TrendingUp,
    Users,
    Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { Project, PersonalTodo } from '@/types/core';
import { ProjectProgressChart } from '@/components/dashboard/ProjectProgressChart';
import { ActivityChart } from '@/components/dashboard/ActivityChart';

// Mock weather data
const getWeatherData = () => {
    const weatherTypes = [
        { type: 'sunny', icon: Sun, temp: 24, description: 'Clear sky' },
        { type: 'cloudy', icon: Cloud, temp: 18, description: 'Partly cloudy' },
        { type: 'rainy', icon: CloudRain, temp: 15, description: 'Light rain' },
        { type: 'snowy', icon: CloudSnow, temp: -2, description: 'Snow' },
    ];
    return weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
};

// Inspirational quotes
const quotes = [
    { text: "Every line drawn is a step into a new possibility.", author: "Kai Anderson" },
    { text: "Design is not just what it looks like. Design is how it works.", author: "Steve Jobs" },
    { text: "Creativity is intelligence having fun.", author: "Albert Einstein" },
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
];

// Mock notifications
const initialNotifications = [
    { id: '1', title: 'Q1 All-Hands Meeting', message: 'Scheduled for Feb 15th at 2:00 PM', time: '2h ago', isRead: false },
    { id: '2', title: 'New Design Guidelines', message: 'Updated brand guidelines are now available', time: '5h ago', isRead: false },
    { id: '3', title: 'Team Building Event', message: 'Save the date: March 5th', time: '1d ago', isRead: true },
];

export default function DashboardPage() {
    const navigate = useNavigate();
    const { currentUser, projects, personalTodos, completeTodo, users, getProjectById, events } = useAppStore();
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [weather] = useState(getWeatherData());
    const [quote] = useState(quotes[Math.floor(Math.random() * quotes.length)]);
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('active');
    const [notifications, setNotifications] = useState(initialNotifications);

    const WeatherIcon = weather.icon;

    // Handle notification click - mark as read and remove
    const handleNotificationClick = (notificationId: string) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

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

    // Filter projects based on search and tab
    const filteredProjects = activeProjects.filter(project => {
        const matchesSearch = project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.client.toLowerCase().includes(searchQuery.toLowerCase());

        if (activeTab === 'all') return matchesSearch;
        if (activeTab === 'active') return matchesSearch && project.status === 'ACTIVE';
        if (activeTab === 'completed') return matchesSearch && project.status === 'COMPLETED';
        return matchesSearch;
    });

    // Get user's pending todos
    const myTodos = personalTodos.filter(
        todo => todo.assigneeIds.includes(currentUser.id) && todo.status === 'PENDING'
    ).slice(0, 5);

    // Calculate team members on vacation
    const totalMembers = users.length;
    const membersOnVacation = users.filter(u => u.workStatus === 'NOT_AT_WORK');
    const activeMembers = totalMembers - membersOnVacation.length;
    const vacationNames = membersOnVacation.map(u => u.name).join(', ');

    // Calculate project progress
    const calculateProgress = (project: Project) => {
        if (project.progress !== undefined) return project.progress;

        const start = new Date(project.startDate).getTime();
        const end = new Date(project.endDate).getTime();
        const now = Date.now();

        if (now < start) return 0;
        if (now > end) return 100;

        return Math.round(((now - start) / (end - start)) * 100);
    };

    // Get phase label based on progress
    const getPhaseLabel = (progress: number) => {
        if (progress < 30) return { label: 'Strategy', color: 'bg-purple-500' };
        if (progress < 70) return { label: 'Production', color: 'bg-green-500' };
        return { label: 'Delivery', color: 'bg-blue-500' };
    };

    // Calculate days remaining
    const getDaysRemaining = (endDate: string) => {
        const end = new Date(endDate).getTime();
        const now = Date.now();
        const days = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
        return days;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex flex-col gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                            {t('welcomeBack')}, {currentUser.name.split(' ')[0]} 👋
                        </h1>
                        <p className="text-muted-foreground">
                            {t('whatsHappeningToday')}
                        </p>
                    </div>

                    {/* Top Info Cards - Weather, Inspiration, Weekly Focus */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Weather Card */}
                        <Card className="border-border/50 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-muted-foreground">{t('todaysWeather')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-4xl font-bold text-foreground">{weather.temp}°</p>
                                        <p className="text-sm text-muted-foreground mt-1">{weather.description}</p>
                                    </div>
                                    <WeatherIcon className="w-16 h-16 text-blue-500" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Inspiration Card */}
                        <Card className="border-border/50 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    {t('inspiration')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <blockquote className="space-y-2">
                                    <p className="text-sm italic text-foreground leading-relaxed">
                                        "{quote.text}"
                                    </p>
                                    <footer className="text-xs text-muted-foreground text-right">
                                        — {quote.author}
                                    </footer>
                                </blockquote>
                            </CardContent>
                        </Card>

                        {/* Weekly Focus */}
                        <Card className="border-border/50 bg-gradient-to-br from-card to-card/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">{t('weeklyFocus')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="text-center p-4 bg-primary/5 rounded-lg">
                                        <p className="text-4xl font-bold text-primary mb-1">{activeProjects.length}</p>
                                        <p className="text-xs text-muted-foreground">{t('activeProjects')}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        You're in the <span className="font-semibold text-foreground">Production Phase</span> for 60% of your workload.
                                        Consider checking in with Strategy teams.
                                    </p>
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
                            className="pl-10 h-12 bg-card border-border/50 focus-visible:ring-primary"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2">
                        <Button
                            variant={activeTab === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveTab('all')}
                        >
                            {t('all')}
                        </Button>
                        <Button
                            variant={activeTab === 'active' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveTab('active')}
                        >
                            {t('active')}
                        </Button>
                        <Button
                            variant={activeTab === 'completed' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveTab('completed')}
                        >
                            {t('completed')}
                        </Button>
                    </div>
                </div>

                {/* Data Visualization Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <ProjectProgressChart projects={projects} />
                    <ActivityChart events={events} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content - Projects */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">{t('activeProjects')}</p>
                                            <p className="text-3xl font-bold text-foreground">{activeProjects.length}</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                            <TrendingUp className="w-6 h-6 text-primary" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="text-sm text-muted-foreground mb-1">{t('teamMembers')}</p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-3xl font-bold text-foreground">
                                                    {activeMembers}/{totalMembers}
                                                </p>
                                            </div>
                                            {membersOnVacation.length > 0 && (
                                                <p className="text-xs text-muted-foreground mt-1 truncate" title={vacationNames}>
                                                    휴가: {vacationNames}
                                                </p>
                                            )}
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                            <Users className="w-6 h-6 text-blue-500" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border/50 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">{t('pendingTasks')}</p>
                                            <p className="text-3xl font-bold text-foreground">{myTodos.length}</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                                            <Clock className="w-6 h-6 text-amber-500" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Projects List */}
                        <Card className="border-border/50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5" />
                                    {t('yourProjects')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {filteredProjects.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
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
                                                className="group flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:bg-accent/50 hover:border-primary/50 transition-all cursor-pointer"
                                            >
                                                {/* Project Thumbnail */}
                                                <div
                                                    className="w-16 h-16 rounded-lg flex-shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden"
                                                    style={project.thumbnail ? { backgroundImage: `url(${project.thumbnail})`, backgroundSize: 'cover' } : {}}
                                                >
                                                    {!project.thumbnail && (
                                                        <Sparkles className="w-8 h-8 text-primary/60" />
                                                    )}
                                                </div>

                                                {/* Project Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                                                {project.title}
                                                            </h3>
                                                            <p className="text-sm text-muted-foreground">{project.client}</p>
                                                        </div>
                                                        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                                                    </div>

                                                    {/* Progress Bar */}
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className={cn("text-xs", phase.color, "text-white border-0")}>
                                                                    {t(phase.label.toLowerCase() as any)}
                                                                </Badge>
                                                                <span>{daysLeft}{t('daysRemaining')}</span>
                                                            </div>
                                                            <span>{daysTotal - daysLeft}일 / {daysTotal}일</span>
                                                        </div>
                                                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
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
                    </div>

                    {/* Sidebar - Notifications, Todos */}
                    <div className="space-y-4">
                        {/* Notifications */}
                        <Card className="border-border/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Bell className="w-4 h-4" />
                                    {t('notificationsWidget')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {notifications.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                        <p className="text-sm">모든 알림을 확인했습니다</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification.id)}
                                            className={cn(
                                                "p-3 rounded-lg border transition-colors cursor-pointer",
                                                notification.isRead
                                                    ? "border-border/30 bg-card/50 hover:bg-accent/50"
                                                    : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                <div className={cn(
                                                    "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                                                    notification.isRead ? "bg-muted" : "bg-primary"
                                                )} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground/60 mt-1">
                                                        {notification.time}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Personal To-Do List */}
                        <Card className="border-border/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">{t('myTodoList')}</CardTitle>
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
                                                {/* Project Key Color Indicator */}
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
                                                                className="text-xs font-medium px-2 py-0.5 rounded"
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
                                                            <Badge variant="destructive" className="text-xs h-5">{t('high')}</Badge>
                                                        )}
                                                    </div>
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
