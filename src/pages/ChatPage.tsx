import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  FolderKanban,
  Users,
  Search,
  MessageSquare,
  Send,
  Paperclip,
  ArrowLeft,
  Plus,
  Hash,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { ChatShareMenu } from '@/components/chat/ChatShareMenu';
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { FileUploadModal } from '@/components/project/FileUploadModal';
import type { LocationShare, ScheduleShare, DecisionShare, ChatMessage, ChatRoom, FileCategory } from '@/types/core';
import * as chatService from '@/services/chatService';
import * as fileService from '@/services/fileService';
import { isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';

type ChatType = 'project' | 'direct';

interface SelectedChat {
  type: ChatType;
  id: string; // projectId or userId
  roomId?: string; // selected room within project
}

export default function ChatPage() {
  const { t } = useTranslation();
  const {
    projects, users, currentUser, messages, chatRooms,
    sendProjectMessage, sendDirectMessage, sendRoomMessage,
    loadChatRooms, createChatRoom, getChatRoomsByProject,
    getUserById, addMessage,
    addFileGroup, addFile, getFileGroupsByProject,
  } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'projects' | 'direct'>('projects');
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);

  // Filter all projects (not just active, to show completed ones too)
  const allProjects = useMemo(() => {
    return projects;
  }, [projects]);

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return allProjects;
    const q = searchQuery.toLowerCase();
    return allProjects.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q)
    );
  }, [allProjects, searchQuery]);

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

  // Get rooms for expanded project
  const projectRooms = useMemo(() => {
    if (!expandedProjectId) return [];
    return getChatRoomsByProject(expandedProjectId);
  }, [expandedProjectId, chatRooms, getChatRoomsByProject]);

  // Get messages for selected chat
  const chatMessages = useMemo(() => {
    if (!selectedChat) return [];

    if (selectedChat.type === 'project') {
      if (selectedChat.roomId) {
        // Room-based filtering
        return messages.filter(m => m.roomId === selectedChat.roomId);
      }
      // Fallback: all messages for the project (legacy or default room)
      return messages.filter(m => m.projectId === selectedChat.id);
    } else {
      // Direct messages
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

  // Subscribe to realtime messages when selecting a room
  useEffect(() => {
    if (!isSupabaseConfigured() || !selectedChat) return;

    let unsubscribe: (() => void) | null = null;

    if (selectedChat.type === 'project' && selectedChat.roomId) {
      unsubscribe = chatService.subscribeToRoomMessages(selectedChat.roomId, (message) => {
        const exists = useAppStore.getState().messages.some(m => m.id === message.id);
        if (!exists) addMessage(message);
      });
    } else if (selectedChat.type === 'project') {
      unsubscribe = chatService.subscribeToProjectMessages(selectedChat.id, (message) => {
        const exists = useAppStore.getState().messages.some(m => m.id === message.id);
        if (!exists) addMessage(message);
      });
    } else if (selectedChat.type === 'direct' && currentUser) {
      unsubscribe = chatService.subscribeToDirectMessages(currentUser.id, selectedChat.id, (message) => {
        const exists = useAppStore.getState().messages.some(m => m.id === message.id);
        if (!exists) addMessage(message);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedChat?.type, selectedChat?.id, selectedChat?.roomId, currentUser?.id, addMessage]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat || !currentUser) return;

    if (selectedChat.type === 'project') {
      if (selectedChat.roomId) {
        sendRoomMessage(selectedChat.roomId, selectedChat.id, newMessage.trim());
      } else {
        sendProjectMessage(selectedChat.id, newMessage.trim());
      }
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
      roomId: selectedChat.roomId,
      messageType: 'text',
      ...extra,
    };
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

  // File upload handler for chat
  const handleFileUploadConfirm = async (category: FileCategory, isImportant: boolean, comment: string, file?: File) => {
    if (!currentUser || !selectedChat || selectedChat.type !== 'project') return;

    const projectId = selectedChat.id;
    const categoryTitles: Record<FileCategory, string> = {
      DECK: 'Presentations',
      FINAL: 'Final Deliverables',
      REFERENCE: 'References',
      CONTRACT: 'Contracts',
      ETC: 'Others',
    };

    try {
      const fileGroups = getFileGroupsByProject(projectId);
      let fileGroup = fileGroups.find(fg => fg.category === category);
      const fileName = file?.name || `Document_${Date.now().toString().slice(-6)}.pdf`;

      if (isSupabaseConfigured() && file) {
        if (!fileGroup) {
          fileGroup = await fileService.createFileGroup({
            projectId,
            category,
            title: categoryTitles[category],
          });
          addFileGroup(fileGroup);
        }

        await fileService.uploadFile(file, projectId, currentUser.id);

        const fileExt = file.name.split('.').pop() || '';
        const fileSize = file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

        const fileItem = await fileService.createFileItem({
          fileGroupId: fileGroup.id,
          name: file.name,
          uploadedBy: currentUser.id,
          size: fileSize,
          type: fileExt,
          isImportant,
          source: 'CHAT',
          comment,
        });

        addFile(fileItem);

        // Send chat message about the file
        if (selectedChat.roomId) {
          await sendRoomMessage(selectedChat.roomId, projectId, `📎 Uploaded file: ${file.name}`, {
            messageType: 'file',
          });
        } else {
          await sendProjectMessage(projectId, `📎 Uploaded file: ${file.name}`);
        }
      } else {
        // Mock mode
        if (!fileGroup) {
          const newGroupId = `fg${Date.now()}`;
          addFileGroup({
            id: newGroupId,
            projectId,
            category,
            title: categoryTitles[category],
          });
          fileGroup = { id: newGroupId, projectId, category, title: categoryTitles[category] };
        }

        const newFileId = `f${Date.now()}`;
        addFile({
          id: newFileId,
          fileGroupId: fileGroup.id,
          name: fileName,
          uploadedBy: currentUser.id,
          createdAt: new Date().toISOString(),
          size: file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : '2.3 MB',
          type: file?.name.split('.').pop() || 'pdf',
          isImportant,
          source: 'CHAT',
          comment,
        });

        addMessage({
          id: `m${Date.now()}`,
          projectId,
          userId: currentUser.id,
          content: `📎 Uploaded file: ${fileName}`,
          createdAt: new Date().toISOString(),
          attachmentId: newFileId,
          messageType: 'file',
        });
      }

      toast.success(`${fileName} 업로드 완료`);
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('파일 업로드에 실패했습니다');
    }
  };

  // Project click: expand to show rooms
  const handleExpandProject = useCallback(async (projectId: string) => {
    if (expandedProjectId === projectId) {
      // Toggle collapse
      setExpandedProjectId(null);
      return;
    }
    setExpandedProjectId(projectId);
    await loadChatRooms(projectId);
  }, [expandedProjectId, loadChatRooms]);

  // Room click: select the room for chatting
  const handleSelectRoom = (projectId: string, room: ChatRoom) => {
    setSelectedChat({ type: 'project', id: projectId, roomId: room.id });
  };

  // Direct chat selection
  const handleSelectDirectChat = (userId: string) => {
    setSelectedChat({ type: 'direct', id: userId });
  };

  const handleBackToList = () => {
    setSelectedChat(null);
  };

  // Create new room
  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !expandedProjectId || !currentUser) return;

    const memberIds = selectedMemberIds.length > 0 ? selectedMemberIds : undefined;
    await createChatRoom(expandedProjectId, newRoomName.trim(), memberIds || [], newRoomDescription.trim() || undefined);

    setNewRoomName('');
    setNewRoomDescription('');
    setSelectedMemberIds([]);
    setShowCreateRoom(false);
  };

  // Get project team members for room creation dialog
  const expandedProjectMembers = useMemo(() => {
    if (!expandedProjectId) return [];
    const project = projects.find(p => p.id === expandedProjectId);
    if (!project?.teamMemberIds) return [];
    return project.teamMemberIds.map(id => users.find(u => u.id === id)).filter(Boolean);
  }, [expandedProjectId, projects, users]);

  // Get selected chat info
  const selectedChatInfo = useMemo(() => {
    if (!selectedChat) return null;

    if (selectedChat.type === 'project') {
      const project = projects.find(p => p.id === selectedChat.id);
      if (!project) return null;

      const room = selectedChat.roomId
        ? chatRooms.find(r => r.id === selectedChat.roomId)
        : null;

      return {
        name: room ? `${project.title}` : project.title,
        subtitle: room ? `# ${room.name}` : project.client,
        thumbnail: project.thumbnail,
      };
    } else {
      const user = users.find(u => u.id === selectedChat.id);
      return user ? { name: user.name, subtitle: user.department, avatar: user.avatar } : null;
    }
  }, [selectedChat, projects, users, chatRooms]);

  // Chat member IDs
  const chatMemberIds = useMemo(() => {
    if (!selectedChat) return undefined;
    if (selectedChat.type === 'project') {
      const project = projects.find(p => p.id === selectedChat.id);
      return project?.teamMemberIds || undefined;
    } else {
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
                      const isExpanded = expandedProjectId === project.id;
                      const rooms = isExpanded ? projectRooms : [];

                      return (
                        <div key={project.id}>
                          <button
                            onClick={() => handleExpandProject(project.id)}
                            className={`w-full flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors group text-left ${isExpanded ? 'bg-muted/30' : ''}`}
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
                                <ChevronRight className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {project.client}
                              </p>
                              {lastMessage ? (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                                  {lastMessage.content}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground/50 italic mt-1">
                                  {t('noMessagesYet')}
                                </p>
                              )}
                            </div>
                          </button>

                          {/* Chat Rooms Sub-list */}
                          {isExpanded && (
                            <div className="bg-muted/20 border-t border-border/50">
                              {rooms.map((room) => {
                                const isRoomSelected = selectedChat?.roomId === room.id;
                                return (
                                  <button
                                    key={room.id}
                                    onClick={() => handleSelectRoom(project.id, room)}
                                    className={`w-full flex items-center gap-2 px-4 py-2.5 pl-14 hover:bg-muted/50 transition-colors text-left text-sm ${isRoomSelected ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                                  >
                                    <Hash className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{room.name}</span>
                                    {room.isDefault && (
                                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full shrink-0">기본</span>
                                    )}
                                  </button>
                                );
                              })}

                              {/* Create new room button */}
                              <button
                                onClick={() => setShowCreateRoom(true)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 pl-14 hover:bg-muted/50 transition-colors text-left text-sm text-muted-foreground/70"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>새 채팅방</span>
                              </button>
                            </div>
                          )}
                        </div>
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
                          className={`w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors group text-left ${isSelected ? 'bg-muted' : ''}`}
                        >
                          <Avatar className="w-10 h-10">
                            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
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
                    {selectedChatInfo.avatar && <AvatarImage src={selectedChatInfo.avatar} alt={selectedChatInfo.name} />}
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
                                    {user?.avatar && <AvatarImage src={user.avatar} alt={user?.name} />}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label="Attach file"
                    onClick={() => {
                      if (selectedChat?.type === 'project') {
                        setShowFileUpload(true);
                      } else {
                        toast.info('파일 업로드는 프로젝트 채팅에서만 가능합니다');
                      }
                    }}
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <Input
                    placeholder={t('typeMessage')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
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

      {/* File Upload Modal */}
      {selectedChat?.type === 'project' && (
        <FileUploadModal
          open={showFileUpload}
          onClose={() => setShowFileUpload(false)}
          projectId={selectedChat.id}
          onUpload={handleFileUploadConfirm}
        />
      )}

      {/* Create Room Dialog */}
      <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>새 채팅방 만들기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="roomName">채팅방 이름</Label>
              <Input
                id="roomName"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="예: 촬영 준비, 후반작업"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roomDesc">설명 (선택)</Label>
              <Input
                id="roomDesc"
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                placeholder="채팅방 설명..."
              />
            </div>
            {expandedProjectMembers.length > 0 && (
              <div className="space-y-2">
                <Label>멤버 선택</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {expandedProjectMembers.map((user) => user && (
                    <div key={user.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`member-${user.id}`}
                        checked={selectedMemberIds.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedMemberIds(prev => [...prev, user.id]);
                          } else {
                            setSelectedMemberIds(prev => prev.filter(id => id !== user.id));
                          }
                        }}
                      />
                      <Label htmlFor={`member-${user.id}`} className="text-sm font-normal cursor-pointer">
                        {user.name} <span className="text-muted-foreground">({user.department})</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRoom(false)}>
              취소
            </Button>
            <Button onClick={handleCreateRoom} disabled={!newRoomName.trim()}>
              만들기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
