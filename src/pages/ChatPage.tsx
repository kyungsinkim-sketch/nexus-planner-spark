import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  FolderKanban,
  Users,
  Search,
  MessageSquare,
  Send,
  Paperclip,
  ArrowLeft,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { ChatShareMenu } from '@/components/chat/ChatShareMenu';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import type { LocationShare, ScheduleShare, DecisionShare, ChatMessage } from '@/types/core';

type ChatType = 'project' | 'direct';

interface SelectedChat {
  type: ChatType;
  id: string;
}

export default function ChatPage() {
  const { t } = useTranslation();
  const { projects, users, currentUser, messages, sendProjectMessage, sendDirectMessage, getUserById } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'projects' | 'direct'>('projects');
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter active projects
  const activeProjects = useMemo(() => {
    return projects.filter(p => p.status === 'ACTIVE');
  }, [projects]);

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return activeProjects;
    const q = searchQuery.toLowerCase();
    return activeProjects.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q)
    );
  }, [activeProjects, searchQuery]);

  // Filter users (excluding current user)
  const otherUsers = useMemo(() => {
    if (!currentUser) return users;
    return users.filter(u => u.id !== currentUser.id);
  }, [users, currentUser]);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return otherUsers;
    const q = searchQuery.toLowerCase();
    return otherUsers.filter(u => u.name.toLowerCase().includes(q));
  }, [otherUsers, searchQuery]);

  // Get messages for selected chat
  const chatMessages = useMemo(() => {
    if (!selectedChat) return [];

    if (selectedChat.type === 'project') {
      return messages.filter(m => m.projectId === selectedChat.id);
    } else {
      // Direct messages - filter by both users
      if (!currentUser) return [];
      return messages.filter(m =>
        m.directChatUserId === selectedChat.id ||
        (m.userId === currentUser.id && m.directChatUserId === selectedChat.id) ||
        (m.userId === selectedChat.id && m.directChatUserId === currentUser.id)
      );
    }
  }, [messages, selectedChat, currentUser]);

  // Get last message for a project
  const getLastMessage = (projectId: string) => {
    const projectMessages = messages.filter(m => m.projectId === projectId);
    return projectMessages[projectMessages.length - 1];
  };

  // Get message count for a project
  const getMessageCount = (projectId: string) => {
    return messages.filter(m => m.projectId === projectId).length;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat || !currentUser) return;

    if (selectedChat.type === 'project') {
      sendProjectMessage(selectedChat.id, newMessage.trim());
    } else {
      sendDirectMessage(selectedChat.id, newMessage.trim());
    }

    setNewMessage('');
  };

  // Rich content sharing handlers
  const addRichMessage = (content: string, extra: Partial<ChatMessage>) => {
    if (!selectedChat || !currentUser) return;
    const msg: ChatMessage = {
      id: `msg_${Date.now()}`,
      projectId: selectedChat.type === 'project' ? selectedChat.id : '',
      userId: currentUser.id,
      content,
      createdAt: new Date().toISOString(),
      directChatUserId: selectedChat.type === 'direct' ? selectedChat.id : undefined,
      messageType: 'text',
      ...extra,
    };
    // Add to local store
    const { addMessage } = useAppStore.getState();
    addMessage(msg);
  };

  const handleShareLocation = (data: LocationShare) => {
    addRichMessage(`📍 ${data.title}`, { messageType: 'location', locationData: data });
  };

  const handleShareSchedule = (data: ScheduleShare) => {
    addRichMessage(`📅 ${data.title}`, { messageType: 'schedule', scheduleData: data });
  };

  const handleShareDecision = (data: DecisionShare) => {
    addRichMessage(`🗳️ ${data.title}`, { messageType: 'decision', decisionData: data });
  };

  const handleVoteDecision = (messageId: string, optionId: string, reason: string) => {
    if (!currentUser) return;
    const { messages: allMessages } = useAppStore.getState();
    const msgIndex = allMessages.findIndex(m => m.id === messageId);
    if (msgIndex === -1 || !allMessages[msgIndex].decisionData) return;

    const updatedMsg = { ...allMessages[msgIndex] };
    const updatedDecision = { ...updatedMsg.decisionData! };
    updatedDecision.votes = [
      ...updatedDecision.votes,
      { userId: currentUser.id, optionId, reason, votedAt: new Date().toISOString() },
    ];
    updatedMsg.decisionData = updatedDecision;

    const updatedMessages = [...allMessages];
    updatedMessages[msgIndex] = updatedMsg;
    useAppStore.setState({ messages: updatedMessages });
  };

  const handleAcceptSchedule = (messageId: string) => {
    if (!currentUser) return;
    const msg = messages.find(m => m.id === messageId);
    if (!msg?.scheduleData) return;

    const { addEvent } = useAppStore.getState();
    addEvent({
      title: msg.scheduleData.title,
      type: 'MEETING',
      startAt: msg.scheduleData.startAt,
      endAt: msg.scheduleData.endAt,
      ownerId: currentUser.id,
      source: 'PAULUS',
    });
  };

  const handleSelectProjectChat = (projectId: string) => {
    setSelectedChat({ type: 'project', id: projectId });
  };

  const handleSelectDirectChat = (userId: string) => {
    setSelectedChat({ type: 'direct', id: userId });
  };

  const handleBackToList = () => {
    setSelectedChat(null);
  };

  // Get selected chat info
  const selectedChatInfo = useMemo(() => {
    if (!selectedChat) return null;

    if (selectedChat.type === 'project') {
      const project = projects.find(p => p.id === selectedChat.id);
      return project ? { name: project.title, subtitle: project.client, thumbnail: project.thumbnail } : null;
    } else {
      const user = users.find(u => u.id === selectedChat.id);
      return user ? { name: user.name, subtitle: user.department } : null;
    }
  }, [selectedChat, projects, users]);

  // 채팅방 멤버 ID 목록 (프로젝트 채팅 = teamMemberIds, DM = 상대방+본인)
  const chatMemberIds = useMemo(() => {
    if (!selectedChat) return undefined;
    if (selectedChat.type === 'project') {
      const project = projects.find(p => p.id === selectedChat.id);
      return project?.teamMemberIds || undefined;
    } else {
      // DM: 상대방 + 본인
      return currentUser ? [selectedChat.id, currentUser.id] : [selectedChat.id];
    }
  }, [selectedChat, projects, currentUser]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    return chatMessages.reduce((groups, message) => {
      const date = formatDate(message.createdAt);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
      return groups;
    }, {} as Record<string, typeof chatMessages>);
  }, [chatMessages]);

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('chat')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('projectConversations')}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Chat List Sidebar */}
        <Card className={`shadow-card overflow-hidden ${selectedChat ? 'hidden lg:block' : ''}`}>
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('searchChats')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'projects' | 'direct')}>
            <TabsList className="w-full rounded-none border-b border-border bg-transparent p-0">
              <TabsTrigger
                value="projects"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
              >
                <FolderKanban className="w-4 h-4" />
                {t('projects')}
              </TabsTrigger>
              <TabsTrigger
                value="direct"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-2"
              >
                <Users className="w-4 h-4" />
                {t('direct')}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(100vh-320px)]">
              <TabsContent value="projects" className="m-0">
                {filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FolderKanban className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">{t('noProjectsFound')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredProjects.map((project) => {
                      const lastMessage = getLastMessage(project.id);
                      const messageCount = getMessageCount(project.id);
                      const isSelected = selectedChat?.type === 'project' && selectedChat?.id === project.id;

                      return (
                        <button
                          key={project.id}
                          onClick={() => handleSelectProjectChat(project.id)}
                          className={`w-full flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors group text-left ${isSelected ? 'bg-muted' : ''
                            }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                            {project.thumbnail ? (
                              <img src={project.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <FolderKanban className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-medium text-foreground text-sm line-clamp-2">
                                {project.title}
                              </h3>
                              {lastMessage && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatTime(lastMessage.createdAt)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {project.client}
                            </p>
                            {lastMessage ? (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {lastMessage.content}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground/50 italic mt-1">
                                {t('noMessagesYet')}
                              </p>
                            )}
                          </div>
                          {messageCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                              <MessageSquare className="w-3 h-3" />
                              {messageCount}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="direct" className="m-0">
                {filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">{t('noUsersFound')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredUsers.map((user) => {
                      const isSelected = selectedChat?.type === 'direct' && selectedChat?.id === user.id;

                      return (
                        <button
                          key={user.id}
                          onClick={() => handleSelectDirectChat(user.id)}
                          className={`w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors group text-left ${isSelected ? 'bg-muted' : ''
                            }`}
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground text-sm">
                              {user.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {user.department}
                            </p>
                          </div>
                          <MessageSquare className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </Card>

        {/* Chat Content Area */}
        <Card className={`shadow-card overflow-hidden flex flex-col h-[calc(100vh-200px)] ${!selectedChat ? 'hidden lg:flex' : ''}`}>
          {selectedChat && selectedChatInfo ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden shrink-0"
                  onClick={handleBackToList}
                  aria-label="Back to chat list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>

                {selectedChat.type === 'project' ? (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {selectedChatInfo.thumbnail ? (
                      <img src={selectedChatInfo.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FolderKanban className="w-5 h-5 text-primary" />
                    )}
                  </div>
                ) : (
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(selectedChatInfo.name)}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-foreground truncate">
                    {selectedChatInfo.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedChatInfo.subtitle}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Send className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-foreground mb-1">{t('noMessagesYet')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('startConversation')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                      <div key={date}>
                        <div className="flex items-center gap-3 mb-4">
                          <Separator className="flex-1" />
                          <span className="text-xs font-medium text-muted-foreground">{date}</span>
                          <Separator className="flex-1" />
                        </div>
                        <div className="space-y-4">
                          {dateMessages.map((message, index) => {
                            const user = getUserById(message.userId);
                            const isCurrentUser = message.userId === currentUser?.id;
                            const showAvatar = index === 0 || dateMessages[index - 1].userId !== message.userId;

                            return (
                              <div
                                key={message.id}
                                className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
                              >
                                {showAvatar ? (
                                  <Avatar className="w-8 h-8 shrink-0">
                                    <AvatarFallback className={`text-xs ${isCurrentUser
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                                      }`}>
                                      {user?.name.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <div className="w-8" />
                                )}
                                <div className={`flex-1 min-w-0 max-w-[75%] ${isCurrentUser ? 'text-right' : ''}`}>
                                  {showAvatar && (
                                    <div className={`flex items-center gap-2 mb-1 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                                      <span className="text-sm font-medium text-foreground">
                                        {isCurrentUser ? t('you') : user?.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {formatMessageTime(message.createdAt)}
                                      </span>
                                    </div>
                                  )}
                                  <ChatMessageBubble
                                    message={message}
                                    isCurrentUser={isCurrentUser}
                                    onVoteDecision={handleVoteDecision}
                                    onAcceptSchedule={handleAcceptSchedule}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              <Separator />

              {/* Message Input */}
              <div className="p-4 bg-background">
                <div className="flex items-center gap-2">
                  <ChatShareMenu
                    onShareLocation={handleShareLocation}
                    onShareSchedule={handleShareSchedule}
                    onShareDecision={handleShareDecision}
                    chatMemberIds={chatMemberIds}
                  />
                  <Button variant="ghost" size="icon" className="shrink-0" aria-label="Attach file">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <Input
                    placeholder={t('typeMessage')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-1">{t('selectChat')}</h3>
              <p className="text-sm text-muted-foreground max-w-[240px]">
                {t('chooseProjectOrDM')}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
