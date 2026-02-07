import { useState } from 'react';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  FileText, 
  Calendar,
  AlertCircle,
  MoreHorizontal,
  Check,
  Trash2,
  FolderKanban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';

type NotificationType = 'task' | 'message' | 'file' | 'deadline' | 'mention' | 'feedback';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  projectId?: string;
  projectName?: string;
  fromUser?: {
    name: string;
    avatar?: string;
  };
  createdAt: string;
  isRead: boolean;
}

// Mock notifications data
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'task',
    title: 'Task assigned to you',
    description: 'Create wireframes for landing page',
    projectId: 'proj-1',
    projectName: 'Brand Campaign 2024',
    fromUser: { name: 'Sarah Kim' },
    createdAt: '2024-01-15T10:30:00Z',
    isRead: false,
  },
  {
    id: '2',
    type: 'deadline',
    title: 'Deadline approaching',
    description: 'Deck Submission is due tomorrow',
    projectId: 'proj-2',
    projectName: 'Tech Corp Pitch',
    createdAt: '2024-01-15T09:00:00Z',
    isRead: false,
  },
  {
    id: '3',
    type: 'message',
    title: 'New message in project chat',
    description: 'Mike: "Can we schedule a review meeting?"',
    projectId: 'proj-1',
    projectName: 'Brand Campaign 2024',
    fromUser: { name: 'Mike Johnson' },
    createdAt: '2024-01-15T08:45:00Z',
    isRead: false,
  },
  {
    id: '4',
    type: 'feedback',
    title: 'Peer feedback requested',
    description: 'Please provide feedback for completed project',
    projectId: 'proj-3',
    projectName: 'Annual Report Design',
    createdAt: '2024-01-14T16:00:00Z',
    isRead: true,
  },
  {
    id: '5',
    type: 'file',
    title: 'New file uploaded',
    description: 'final_presentation_v2.pdf was added to Files',
    projectId: 'proj-1',
    projectName: 'Brand Campaign 2024',
    fromUser: { name: 'Emily Chen' },
    createdAt: '2024-01-14T14:30:00Z',
    isRead: true,
  },
  {
    id: '6',
    type: 'mention',
    title: 'You were mentioned',
    description: '@you Please review the latest mockups',
    projectId: 'proj-2',
    projectName: 'Tech Corp Pitch',
    fromUser: { name: 'Alex Park' },
    createdAt: '2024-01-14T11:00:00Z',
    isRead: true,
  },
];

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'task':
      return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    case 'message':
      return <MessageSquare className="w-4 h-4 text-green-500" />;
    case 'file':
      return <FileText className="w-4 h-4 text-purple-500" />;
    case 'deadline':
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case 'mention':
      return <Bell className="w-4 h-4 text-pink-500" />;
    case 'feedback':
      return <FolderKanban className="w-4 h-4 text-cyan-500" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function InboxPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [activeTab, setActiveTab] = useState('all');

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return !n.isRead;
    return n.type === activeTab;
  });

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{t('inbox')}</h1>
          {unreadCount > 0 && (
            <Badge variant="default" className="bg-primary text-primary-foreground">
              {unreadCount} {t('new')}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={markAllAsRead}>
          <Check className="w-4 h-4 mr-2" />
          {t('markAllAsRead')}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">{t('all')}</TabsTrigger>
          <TabsTrigger value="unread">
            {t('unread')}
            {unreadCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                {unreadCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="task">{t('tasks')}</TabsTrigger>
          <TabsTrigger value="message">{t('messages')}</TabsTrigger>
          <TabsTrigger value="deadline">{t('deadlines')}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">
                  {t('noNotifications')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'unread'
                    ? t('allCaughtUpNotifications')
                    : t('notificationsWillAppearHere')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map(notification => (
                <Card
                  key={notification.id}
                  className={cn(
                    'transition-all hover:shadow-sm cursor-pointer',
                    !notification.isRead && 'bg-primary/5 border-primary/20'
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className={cn(
                              'text-sm',
                              !notification.isRead ? 'font-medium text-foreground' : 'text-muted-foreground'
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {notification.description}
                            </p>
                            {notification.projectName && (
                              <Link
                                to={`/projects/${notification.projectId}`}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                <FolderKanban className="w-3 h-3" />
                                {notification.projectName}
                              </Link>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatRelativeTime(notification.createdAt)}
                            </div>

                            {/* Unread indicator */}
                            {!notification.isRead && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}

                            {/* Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => markAsRead(notification.id)}>
                                  <Check className="w-4 h-4 mr-2" />
                                  {t('markAsRead')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => deleteNotification(notification.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {t('delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* From user */}
                        {notification.fromUser && (
                          <div className="flex items-center gap-2 mt-2">
                            <Avatar className="w-5 h-5">
                              <AvatarFallback className="text-[10px] bg-muted">
                                {notification.fromUser.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {notification.fromUser.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
