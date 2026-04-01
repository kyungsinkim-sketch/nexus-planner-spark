/**
 * MobileChatListView — Chat-first mobile experience.
 * Shows all conversations (DMs, group chats, project chats) sorted by recency.
 * Tapping opens the existing MobileDmChatView / project chat.
 * Tapping avatar opens member detail (MobileMembersView style).
 */

import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useWidgetStore } from '@/stores/widgetStore';
import { useTranslation } from '@/hooks/useTranslation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Users, Search, X } from 'lucide-react';
import { BRAIN_BOT_USER_ID, BRAIN_AI_USER_ID } from '@/types/core';

function MobileChatListView() {
  const { t, language } = useTranslation();
  const {
    users, messages, currentUser, getGroupRooms, getUnreadCount,
    chatRooms, projects,
  } = useAppStore();
  const { openMobileDm, openMobileGroupChat, openMobileProjectChat, setMobileView } = useWidgetStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Build unified conversation list sorted by last message time
  const conversations = useMemo(() => {
    if (!currentUser) return [];
    const myId = currentUser.id;
    const convos: {
      key: string;
      type: 'dm' | 'group' | 'project';
      name: string;
      avatar?: string;
      userId?: string; // for DM → member detail
      roomId?: string;
      projectId?: string;
      lastMessage?: string;
      lastTime?: string;
      lastSender?: string;
      unread: number;
    }[] = [];

    // ── DM conversations ──
    const dmPartners = new Map<string, { content: string; time: string; senderId: string }>();
    for (const msg of messages) {
      if (!msg.directChatUserId) continue;
      // Skip brain bot messages
      if (msg.userId === BRAIN_BOT_USER_ID || msg.directChatUserId === BRAIN_BOT_USER_ID) continue;
      if (msg.userId === BRAIN_AI_USER_ID || msg.directChatUserId === BRAIN_AI_USER_ID) continue;

      const otherUserId = msg.userId === myId ? msg.directChatUserId : msg.userId;
      if (!otherUserId || otherUserId === myId) continue;

      const existing = dmPartners.get(otherUserId);
      if (!existing || msg.createdAt > existing.time) {
        dmPartners.set(otherUserId, {
          content: msg.content,
          time: msg.createdAt,
          senderId: msg.userId,
        });
      }
    }

    for (const [userId, last] of dmPartners) {
      const user = users.find(u => u.id === userId);
      if (!user) continue;
      const sender = last.senderId === myId ? (language === 'ko' ? '나' : 'Me') : user.name;
      convos.push({
        key: `dm:${userId}`,
        type: 'dm',
        name: user.name,
        avatar: user.avatar,
        userId,
        lastMessage: last.content,
        lastTime: last.time,
        lastSender: sender,
        unread: getUnreadCount(`dm:${userId}`),
      });
    }

    // ── Group chats ──
    const groupRooms = getGroupRooms();
    for (const room of groupRooms) {
      const roomMsgs = messages
        .filter(m => m.roomId === room.id && !m.directChatUserId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const lastMsg = roomMsgs[0];
      const sender = lastMsg ? users.find(u => u.id === lastMsg.userId) : null;

      convos.push({
        key: `room:${room.id}`,
        type: 'group',
        name: room.name || 'Group',
        roomId: room.id,
        lastMessage: lastMsg?.content,
        lastTime: lastMsg?.createdAt,
        lastSender: lastMsg?.userId === myId ? (language === 'ko' ? '나' : 'Me') : (sender?.name || ''),
        unread: getUnreadCount(`room:${room.id}`),
      });
    }

    // ── Project default room chats ──
    for (const project of projects) {
      const projectRooms = chatRooms.filter(r => r.projectId === project.id);
      const defaultRoom = projectRooms.find(r => r.name === '전체' || r.name === 'General') || projectRooms[0];
      if (!defaultRoom) continue;
      // Skip if already in group rooms
      if (groupRooms.some(g => g.id === defaultRoom.id)) continue;

      const roomMsgs = messages
        .filter(m => m.roomId === defaultRoom.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const lastMsg = roomMsgs[0];
      if (!lastMsg) continue; // Skip projects with no chat activity
      const sender = lastMsg ? users.find(u => u.id === lastMsg.userId) : null;

      convos.push({
        key: `project:${project.id}`,
        type: 'project',
        name: `# ${project.title}`,
        projectId: project.id,
        roomId: defaultRoom.id,
        lastMessage: lastMsg?.content,
        lastTime: lastMsg?.createdAt,
        lastSender: lastMsg?.userId === myId ? (language === 'ko' ? '나' : 'Me') : (sender?.name || ''),
        unread: getUnreadCount(`room:${defaultRoom.id}`),
      });
    }

    // Sort by last message time (most recent first)
    convos.sort((a, b) => {
      if (!a.lastTime && !b.lastTime) return 0;
      if (!a.lastTime) return 1;
      if (!b.lastTime) return -1;
      return b.lastTime.localeCompare(a.lastTime);
    });

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return convos.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.lastMessage?.toLowerCase().includes(q)
      );
    }

    return convos;
  }, [messages, users, currentUser, projects, chatRooms, getGroupRooms, getUnreadCount, searchQuery, language]);

  // Also show users with no conversation yet (for starting new DMs)
  const usersWithoutConvo = useMemo(() => {
    if (!currentUser || searchQuery.trim()) return [];
    const dmUserIds = new Set(conversations.filter(c => c.type === 'dm').map(c => c.userId));
    return users.filter(u =>
      u.id !== currentUser.id &&
      u.id !== BRAIN_BOT_USER_ID &&
      u.id !== BRAIN_AI_USER_ID &&
      !dmUserIds.has(u.id)
    );
  }, [users, currentUser, conversations, searchQuery]);

  const handleConvoClick = useCallback((c: typeof conversations[0]) => {
    if (c.type === 'dm' && c.userId) {
      openMobileDm(c.userId);
    } else if (c.type === 'group' && c.roomId) {
      openMobileGroupChat(c.roomId);
    } else if (c.type === 'project' && c.projectId) {
      openMobileProjectChat(c.projectId);
    }
  }, [openMobileDm, openMobileGroupChat, openMobileProjectChat]);

  const handleAvatarClick = useCallback((e: React.MouseEvent, userId?: string) => {
    if (!userId) return;
    e.stopPropagation();
    // Navigate to members view with this user selected
    useWidgetStore.getState().setMobileView('members');
    // Small delay to let the view mount, then trigger selection
    setTimeout(() => {
      // MobileMembersView reads a global store value for pre-selection
      useAppStore.setState({ pendingMemberDetailId: userId });
    }, 100);
  }, []);

  const formatTime = (time?: string) => {
    if (!time) return '';
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    } else if (diffDays === 1) {
      return language === 'ko' ? '어제' : 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('ko-KR', { weekday: 'short' });
    }
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const truncate = (text?: string, max = 40) => {
    if (!text) return '';
    const clean = text.replace(/\n/g, ' ').trim();
    return clean.length > max ? clean.slice(0, max) + '…' : clean;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-3 pb-2 bg-background/95 backdrop-blur-sm">
        <h1 className="typo-h3 font-bold text-foreground mb-2">
          {language === 'ko' ? '채팅' : 'Chat'}
        </h1>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={language === 'ko' ? '대화 검색...' : 'Search chats...'}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-muted/50 border border-border/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto pb-24">
        {conversations.length === 0 && !searchQuery && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
            <MessageSquare className="w-10 h-10 mb-3" />
            <p className="typo-body">{language === 'ko' ? '대화가 없습니다' : 'No conversations'}</p>
          </div>
        )}

        {conversations.map(c => (
          <button
            key={c.key}
            onClick={() => handleConvoClick(c)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors border-b border-border/10"
          >
            {/* Avatar */}
            {c.type === 'dm' ? (
              <div onClick={e => handleAvatarClick(e, c.userId)}>
                <Avatar className="w-12 h-12 shrink-0">
                  <AvatarImage src={c.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{c.name[0]}</AvatarFallback>
                </Avatar>
              </div>
            ) : (
              <div className="w-12 h-12 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
                {c.type === 'group' ? (
                  <Users className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className={`typo-body font-semibold truncate ${c.unread > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                  {c.name}
                </span>
                <span className="typo-caption text-muted-foreground shrink-0 ml-2">
                  {formatTime(c.lastTime)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <p className={`typo-caption truncate ${c.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {c.lastSender ? `${c.lastSender}: ${truncate(c.lastMessage, 30)}` : truncate(c.lastMessage)}
                </p>
                {c.unread > 0 && (
                  <span className="min-w-[20px] h-[20px] rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1.5 shrink-0 ml-2">
                    {c.unread > 99 ? '99+' : c.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* Users without conversation — show at bottom for starting new DMs */}
        {usersWithoutConvo.length > 0 && conversations.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <p className="typo-caption text-muted-foreground/50 uppercase tracking-wider">
              {language === 'ko' ? '새 대화 시작' : 'Start new chat'}
            </p>
          </div>
        )}
        {usersWithoutConvo.map(user => (
          <button
            key={user.id}
            onClick={() => openMobileDm(user.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors border-b border-border/10 opacity-60"
          >
            <Avatar className="w-12 h-12 shrink-0">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">{user.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <span className="typo-body font-medium truncate block">{user.name}</span>
              <span className="typo-caption text-muted-foreground">
                {language === 'ko' ? '메시지 보내기' : 'Send message'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default MobileChatListView;
