import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, CheckCircle2, AlertCircle, Info, Calendar, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Notification {
    id: string;
    type: 'project' | 'todo' | 'system' | 'calendar';
    priority: 'high' | 'normal' | 'low';
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    actionUrl?: string;
}

interface NotificationCenterProps {
    notifications: Notification[];
    onMarkAsRead: (id: string) => void;
    onDismiss: (id: string) => void;
    onClearAll: () => void;
}

const notificationIcons = {
    project: FileText,
    todo: CheckCircle2,
    system: AlertCircle,
    calendar: Calendar,
};

const priorityColors = {
    high: 'border-l-4 border-l-red-500 bg-red-500/5',
    normal: 'border-l-4 border-l-blue-500 bg-blue-500/5',
    low: 'border-l-4 border-l-gray-500 bg-gray-500/5',
};

export function NotificationCenter({
    notifications,
    onMarkAsRead,
    onDismiss,
    onClearAll,
}: NotificationCenterProps) {
    const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
    const [activeCategory, setActiveCategory] = useState<'all' | Notification['type']>('all');

    const filteredNotifications = notifications.filter(n => {
        const matchesReadFilter = activeFilter === 'all' || !n.read;
        const matchesCategory = activeCategory === 'all' || n.type === activeCategory;
        return matchesReadFilter && matchesCategory;
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5" />
                        <CardTitle className="text-lg">Notifications</CardTitle>
                        {unreadCount > 0 && (
                            <Badge variant="destructive" className="ml-2">
                                {unreadCount}
                            </Badge>
                        )}
                    </div>
                    {notifications.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClearAll}
                            className="text-xs"
                        >
                            Clear All
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant={activeFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveFilter('all')}
                    >
                        All
                    </Button>
                    <Button
                        variant={activeFilter === 'unread' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveFilter('unread')}
                    >
                        Unread ({unreadCount})
                    </Button>
                    <div className="h-4 w-px bg-border mx-2" />
                    <Button
                        variant={activeCategory === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveCategory('all')}
                    >
                        All Types
                    </Button>
                    <Button
                        variant={activeCategory === 'project' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveCategory('project')}
                    >
                        <FileText className="w-3 h-3 mr-1" />
                        Projects
                    </Button>
                    <Button
                        variant={activeCategory === 'todo' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveCategory('todo')}
                    >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        To-dos
                    </Button>
                    <Button
                        variant={activeCategory === 'calendar' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveCategory('calendar')}
                    >
                        <Calendar className="w-3 h-3 mr-1" />
                        Calendar
                    </Button>
                    <Button
                        variant={activeCategory === 'system' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveCategory('system')}
                    >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        System
                    </Button>
                </div>

                {/* Notifications List */}
                <div className="space-y-2">
                    {filteredNotifications.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No notifications</p>
                        </div>
                    ) : (
                        filteredNotifications.map((notification) => {
                            const Icon = notificationIcons[notification.type];
                            return (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        'p-4 rounded-lg transition-all',
                                        priorityColors[notification.priority],
                                        !notification.read && 'shadow-sm',
                                        notification.read && 'opacity-60'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            'p-2 rounded-lg shrink-0',
                                            notification.type === 'project' && 'bg-blue-500/10 text-blue-600',
                                            notification.type === 'todo' && 'bg-green-500/10 text-green-600',
                                            notification.type === 'calendar' && 'bg-purple-500/10 text-purple-600',
                                            notification.type === 'system' && 'bg-orange-500/10 text-orange-600'
                                        )}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-medium mb-1">
                                                        {notification.title}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {formatTimestamp(notification.timestamp)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {!notification.read && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => onMarkAsRead(notification.id)}
                                                        >
                                                            <CheckCircle2 className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => onDismiss(notification.id)}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
