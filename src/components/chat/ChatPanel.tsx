/**
 * ChatPanel — Persistent chat component that always remains visible
 * in the split-screen layout. Extracted from ChatPage.tsx.
 *
 * Features:
 * - Chat list (projects / direct tabs) with compact view
 * - Message area with date grouping
 * - Message input with rich content sharing
 * - File upload, room creation
 * - Realtime subscriptions
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MentionTextarea } from '@/components/ui/mention-textarea';
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
  Send,
  Paperclip,
  ArrowLeft,
  Plus,
  Hash,
  ChevronRight,
  Brain,
  Pin,
  X,
  Phone,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/useTranslation';
// ChatShareMenu removed — replaced by Brain AI (@AiAssistant mention)
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble';
import { FileUploadModal } from '@/components/project/FileUploadModal';
import type { LocationShare, ScheduleShare, DecisionShare, ChatMessage, ChatRoom, FileCategory } from '@/types/core';
import { BRAIN_BOT_USER_ID, BRAIN_AI_USER_ID, isBrainAIUser, extractEmailDomain, isFreelancerDomain, isAIPersonaUser, PERSONA_ID_MAP, PERSONA_PABLO_USER_ID, PERSONA_CD_USER_ID, PERSONA_PD_USER_ID } from '@/types/core';
import { CallStartDialog } from '@/components/chat/CallStartDialog';
import * as chatService from '@/services/chatService';
import * as fileService from '@/services/fileService';
import * as brainService from '@/services/brainService';
import * as personaService from '@/services/personaService';
import { isSupabaseConfigured } from '@/lib/supabase';
import { toast } from 'sonner';

type ChatType = 'project' | 'direct';

interface SelectedChat {
  type: ChatType;
  id: string; // projectId or userId
  roomId?: string; // selected room within project
}

interface ChatPanelProps {
  /** When provided (project tab), auto-select the project's default chat room on mount */
  defaultProjectId?: string;
}

export function ChatPanel({ defaultProjectId }: ChatPanelProps = {}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const {
    projects, users, currentUser, messages, chatRooms,
    sendProjectMessage, sendDirectMessage, sendRoomMessage,
    loadChatRooms, createChatRoom, getChatRoomsByProject,
    getUserById, addMessage,
    addFileGroup, addFile, getFileGroupsByProject,
    brainIntelligenceEnabled,
    loadEvents, loadTodos, addTodo, addEvent, updateEvent,
    addBrainReport, addBrainNotification,
    loadBoardData, addBoardTask,
    clearChatNotificationsForRoom,
    setActiveChatContext,
    pendingChatNavigation,
    setPendingChatNavigation,
  } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'projects' | 'direct'>('projects');
  const [selectedChat, setSelectedChat] = useState<SelectedChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callMediaType, setCallMediaType] = useState<'voice' | 'video'>('voice');
  const [pinnedAnnouncement, setPinnedAnnouncement] = useState<ChatMessage | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDescription, setNewRoomDescription] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  // /analyze command removed — no longer available in chat

  // Freelancer detection — freelancers can only access sub-chat rooms, not default/main
  const isFreelancer = useMemo(() => {
    if (!currentUser?.email) return false;
    const domain = extractEmailDomain(currentUser.email);
    return !domain || isFreelancerDomain(domain);
  }, [currentUser?.email]);

  // Auto-select project chat room when defaultProjectId is provided (widget on project tab)
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (!defaultProjectId || hasAutoSelectedRef.current) return;
    hasAutoSelectedRef.current = true;

    // Load chat rooms for the project, then auto-select the default room
    (async () => {
      await loadChatRooms(defaultProjectId);
      const rooms = getChatRoomsByProject(defaultProjectId);
      const defaultRoom = rooms.find(r => r.isDefault) || rooms[0];
      if (defaultRoom) {
        setSelectedChat({ type: 'project', id: defaultProjectId, roomId: defaultRoom.id });
        setExpandedProjectId(defaultProjectId);
      } else {
        // No rooms yet — just select the project-level chat
        setSelectedChat({ type: 'project', id: defaultProjectId });
        setExpandedProjectId(defaultProjectId);
      }
    })();
  }, [defaultProjectId, loadChatRooms, getChatRoomsByProject]);

  // Filter all projects
  const allProjects = useMemo(() => {
    return projects;
  }, [projects]);

  // Filter projects by search, sorted by most recent message
  const filteredProjects = useMemo(() => {
    let filtered = allProjects;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      const aMsg = messages.filter(m => m.projectId === a.id && !m.directChatUserId);
      const bMsg = messages.filter(m => m.projectId === b.id && !m.directChatUserId);
      const aLast = aMsg.length > 0 ? new Date(aMsg[aMsg.length - 1].createdAt).getTime() : 0;
      const bLast = bMsg.length > 0 ? new Date(bMsg[bMsg.length - 1].createdAt).getTime() : 0;
      return bLast - aLast;
    });
  }, [allProjects, searchQuery, messages]);

  // Filter users (excluding current user) + prepend AI persona virtual users
  const otherUsers = useMemo(() => {
    if (!currentUser) return users;
    const realUsers = users.filter(u => u.id !== currentUser.id);

    // Add Brain AI + AI persona virtual users at the top
    const aiUsers: typeof users = [
      { id: BRAIN_AI_USER_ID, name: 'Brain AI', role: 'ADMIN' as const, department: '업무 자동화 AI 어시스턴트' },
      { id: PERSONA_PABLO_USER_ID, name: 'Pablo AI', role: 'ADMIN' as const, department: 'CEO AI Advisor' },
      { id: PERSONA_CD_USER_ID, name: 'CD AI', role: 'MANAGER' as const, department: 'Creative Director AI' },
      { id: PERSONA_PD_USER_ID, name: 'PD AI', role: 'MANAGER' as const, department: 'Producer AI' },
    ];

    return [...aiUsers, ...realUsers];
  }, [users, currentUser]);

  // Filter users by search, sorted by most recent DM
  const filteredUsers = useMemo(() => {
    let filtered = otherUsers;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(u => u.name.toLowerCase().includes(q));
    }
    if (!currentUser) return filtered;
    return [...filtered].sort((a, b) => {
      const aDms = messages.filter(m =>
        (m.userId === currentUser.id && m.directChatUserId === a.id) ||
        (m.userId === a.id && m.directChatUserId === currentUser.id)
      );
      const bDms = messages.filter(m =>
        (m.userId === currentUser.id && m.directChatUserId === b.id) ||
        (m.userId === b.id && m.directChatUserId === currentUser.id)
      );
      const aLast = aDms.length > 0 ? new Date(aDms[aDms.length - 1].createdAt).getTime() : 0;
      const bLast = bDms.length > 0 ? new Date(bDms[bDms.length - 1].createdAt).getTime() : 0;
      return bLast - aLast;
    });
  }, [otherUsers, searchQuery, currentUser, messages]);

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
        return messages.filter(m => m.roomId === selectedChat.roomId);
      }
      return messages.filter(m => m.projectId === selectedChat.id);
    } else {
      if (!currentUser) return [];
      // For Brain AI DM: show user messages sent to Brain AI + Brain bot responses
      if (isBrainAIUser(selectedChat.id)) {
        return messages.filter(m =>
          // User messages TO Brain AI
          (m.userId === currentUser.id && m.directChatUserId === BRAIN_AI_USER_ID) ||
          // Brain bot responses TO current user (edge function sets directChatUserId = requesting userId)
          (m.userId === BRAIN_BOT_USER_ID && m.directChatUserId === currentUser.id)
        );
      }
      // For AI Persona DMs (@pablo, @cd, @pd): strict scoping to persona ID
      if (isAIPersonaUser(selectedChat.id)) {
        return messages.filter(m =>
          // User messages TO this persona
          (m.userId === currentUser.id && m.directChatUserId === selectedChat.id) ||
          // Bot responses scoped to this persona's DM thread
          (m.userId === BRAIN_BOT_USER_ID && m.directChatUserId === selectedChat.id)
        );
      }
      // Regular DM with real users
      return messages.filter(m =>
        // Messages FROM current user TO selected user
        (m.userId === currentUser.id && m.directChatUserId === selectedChat.id) ||
        // Messages FROM selected user TO current user
        (m.userId === selectedChat.id && m.directChatUserId === currentUser.id)
      );
    }
  }, [messages, selectedChat, currentUser]);

  const getLastMessage = (projectId: string) => {
    const projectMessages = messages.filter(m => m.projectId === projectId && !m.directChatUserId);
    return projectMessages[projectMessages.length - 1];
  };

  const getLastDirectMessage = (userId: string) => {
    if (!currentUser) return undefined;
    const dms = messages.filter(m =>
      (m.userId === currentUser.id && m.directChatUserId === userId) ||
      (m.userId === userId && m.directChatUserId === currentUser.id)
    );
    return dms[dms.length - 1];
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

  const scrollToBottom = (instant = false) => {
    // Find the Radix ScrollArea Viewport (the actual scrollable container)
    // messagesContainerRef is on the ScrollArea Root; the Viewport is its first child
    // with data-radix-scroll-area-viewport attribute, or we traverse via messagesEndRef
    const endEl = messagesEndRef.current;
    if (!endEl) return;
    // Walk up to find the nearest scrollable parent (Radix Viewport)
    let scrollParent: HTMLElement | null = endEl.parentElement;
    while (scrollParent) {
      const { overflow, overflowY } = getComputedStyle(scrollParent);
      if (overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll') {
        break;
      }
      // Radix viewport has data-radix-scroll-area-viewport
      if (scrollParent.hasAttribute('data-radix-scroll-area-viewport')) break;
      scrollParent = scrollParent.parentElement;
    }
    if (scrollParent) {
      if (instant) {
        scrollParent.scrollTop = scrollParent.scrollHeight;
      } else {
        scrollParent.scrollTo({ top: scrollParent.scrollHeight, behavior: 'smooth' });
      }
    }
  };

  // Track previous chat ID to detect room entry vs. new message
  const prevChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (chatMessages.length === 0) return;
    // Determine if this is a room entry (chat changed) vs. new message in same room
    const chatId = selectedChat ? `${selectedChat.type}-${selectedChat.id}-${selectedChat.roomId || ''}` : null;
    const isRoomEntry = chatId !== prevChatIdRef.current;
    prevChatIdRef.current = chatId;
    // Room entry → instant scroll (no animation delay);
    // On mobile always use instant scroll to avoid "scroll lag" feeling
    const useInstant = isRoomEntry || isMobile;
    // Small delay to ensure DOM has rendered the messages
    requestAnimationFrame(() => scrollToBottom(useInstant));
  }, [chatMessages, selectedChat, isMobile]);

  // Consume pending chat navigation from notification click
  useEffect(() => {
    if (!pendingChatNavigation) return;
    const nav = pendingChatNavigation;
    setPendingChatNavigation(null); // Consume immediately

    if (nav.type === 'direct') {
      setSelectedTab('direct');
      handleSelectDirectChat(nav.id);
    } else if (nav.type === 'project') {
      setSelectedTab('projects');
      if (nav.roomId) {
        setSelectedChat({ type: 'project', id: nav.id, roomId: nav.roomId });
      } else {
        // Expand project and select default room
        setExpandedProjectId(nav.id);
      }
    }
  }, [pendingChatNavigation]);

  // Track active chat context globally (for notification suppression) + auto-clear notifications
  useEffect(() => {
    if (!selectedChat) {
      setActiveChatContext(null);
      return;
    }
    // Set active context so addMessage() knows not to create notifications for this chat
    setActiveChatContext({
      type: selectedChat.type,
      id: selectedChat.id,
      roomId: selectedChat.roomId,
    });
    // Auto-clear existing notifications for this chat
    if (selectedChat.type === 'project') {
      clearChatNotificationsForRoom(selectedChat.roomId, selectedChat.id);
    } else if (selectedChat.type === 'direct') {
      clearChatNotificationsForRoom(undefined, undefined, selectedChat.id);
    }
    // Clear active context on unmount
    return () => setActiveChatContext(null);
  }, [selectedChat?.type, selectedChat?.id, selectedChat?.roomId, clearChatNotificationsForRoom, setActiveChatContext]);

  // Subscribe to realtime DELETE events for the active chat room.
  // INSERT events are handled by the global useChatNotifications hook
  // to avoid dual subscriptions and race conditions.
  useEffect(() => {
    if (!isSupabaseConfigured() || !selectedChat) return;

    let unsubscribe: (() => void) | null = null;

    // INSERT is a no-op — the global hook (useChatNotifications) handles all INSERTs
    const onInsertNoop = () => {};

    const onRemoteDelete = (messageId: string) => {
      useAppStore.setState((state) => ({
        messages: state.messages.filter(m => m.id !== messageId),
      }));
    };

    if (selectedChat.type === 'project' && selectedChat.roomId) {
      unsubscribe = chatService.subscribeToRoomMessages(selectedChat.roomId, onInsertNoop, onRemoteDelete);
    } else if (selectedChat.type === 'project') {
      unsubscribe = chatService.subscribeToProjectMessages(selectedChat.id, onInsertNoop, onRemoteDelete);
    } else if (selectedChat.type === 'direct' && currentUser) {
      unsubscribe = chatService.subscribeToDirectMessages(currentUser.id, selectedChat.id, onInsertNoop, onRemoteDelete);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedChat?.type, selectedChat?.id, selectedChat?.roomId, currentUser?.id]);

  const [brainProcessing, setBrainProcessing] = useState(false);
  const [pabloProcessing, setPabloProcessing] = useState(false);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !currentUser) return;

    const trimmed = newMessage.trim();

    // 1. Check for ANY persona mention (@pablo, @cd, @pd) — takes priority over brain
    const { isPersonaMention, cleanContent: personaCleanContent, personaId } = personaService.detectPersonaMention(trimmed);

    // 2. Check for @AiAssistant mention — triggers Brain AI
    const { isBrainMention: forceBrain, cleanContent } = brainService.detectBrainMention(trimmed);

    // Send the user's message first
    try {
      if (selectedChat.type === 'project') {
        if (selectedChat.roomId) {
          await sendRoomMessage(selectedChat.roomId, selectedChat.id, trimmed);
        } else {
          await sendProjectMessage(selectedChat.id, trimmed);
        }
      } else {
        await sendDirectMessage(selectedChat.id, trimmed);
      }
    } catch (sendError) {
      console.error('Failed to send message:', sendError);
      toast.error('메시지 전송에 실패했습니다. 다시 시도해주세요.');
      return; // Don't clear the input on failure
    }

    setNewMessage('');

    // NEW: If DM target is Brain AI, auto-trigger brain processing (no @Brain mention needed)
    if (selectedChat.type === 'direct' && isBrainAIUser(selectedChat.id)) {
      setBrainProcessing(true);
      try {
        // Build chat members from all users
        const chatMembers = users.map(u => ({ id: u.id, name: u.name }));
        if (!chatMembers.find(m => m.id === currentUser.id)) {
          chatMembers.push({ id: currentUser.id, name: currentUser.name });
        }

        // Gather recent conversation context from Brain AI DM for accumulation
        const brainDmMessages = messages
          .filter(m =>
            (m.userId === currentUser.id && m.directChatUserId === BRAIN_AI_USER_ID) ||
            (m.userId === BRAIN_BOT_USER_ID && m.directChatUserId === currentUser.id)
          )
          .slice(-10); // last 10 messages for context

        const conversationContext = brainDmMessages.map(m => {
          if (m.userId === currentUser.id) {
            return `User: ${m.content}`;
          }
          const replyMsg = (m.brainActionData as { replyMessage?: string })?.replyMessage || m.content;
          return `Brain AI: ${replyMsg}`;
        }).join('\n');

        const contextualMessage = conversationContext
          ? `[Previous conversation context]\n${conversationContext}\n\n[Current request]\n${trimmed}`
          : trimmed;

        const brainResult = await brainService.processMessageWithLLM({
          messageContent: contextualMessage,
          directChatUserId: BRAIN_AI_USER_ID,
          userId: currentUser.id,
          chatMembers,
        });

        // Auto-execute all pending actions (same as regular Brain processing)
        const brainActions = brainResult.actions || [];
        for (const action of brainActions) {
          const actionId = (action as { id?: string }).id;
          if (!actionId) continue;

          const act = action as Record<string, unknown>;
          const actionType = act.action_type || act.actionType;
          if (actionType === 'submit_service_suggestion') {
            const extracted = (act.extracted_data || act.extractedData) as Record<string, unknown> | undefined;
            if (extracted) {
              addBrainReport({
                userId: currentUser.id,
                userName: currentUser.name,
                suggestion: (extracted.suggestion as string) || trimmed,
                brainSummary: (extracted.brainSummary as string) || '',
                category: (extracted.category as 'feature_request' | 'bug_report' | 'ui_improvement' | 'workflow_suggestion' | 'other') || 'other',
                priority: (extracted.priority as 'low' | 'medium' | 'high') || 'medium',
              });
            }
            continue;
          }

          try {
            await brainService.updateActionStatus(actionId, 'confirmed', currentUser.id);
            const execResult = await brainService.executeAction(actionId, currentUser.id);
            const dataType = (execResult.executedData as { type?: string })?.type;
            if (dataType === 'event') {
              await loadEvents();
              const execData = execResult.executedData as Record<string, unknown>;
              if (!execData.updated) {
                const newTitle = (execData.title as string) || '';
                if (newTitle) {
                  const { events: currentEvents, deleteEvent: delEvt } = useAppStore.getState();
                  const dupes = currentEvents.filter(e => e.title === newTitle);
                  if (dupes.length > 1) {
                    const sorted = dupes.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
                    for (let d = 1; d < sorted.length; d++) {
                      await delEvt(sorted[d].id);
                    }
                  }
                }
              }
            }
            if (dataType === 'todo') {
              await loadTodos();
              const todoExecData = execResult.executedData as Record<string, unknown>;
              const todoTitle = (todoExecData.title as string) || '';
              if (todoTitle) {
                const { personalTodos, deleteTodo } = useAppStore.getState();
                const dupes = personalTodos.filter(td => td.title === todoTitle);
                if (dupes.length > 1) {
                  const sorted = [...dupes].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                  for (let d = 1; d < sorted.length; d++) {
                    await deleteTodo(sorted[d].id);
                  }
                }
              }
              for (let retry = 1; retry <= 2; retry++) {
                await new Promise(r => setTimeout(r, 1000));
                await loadTodos().catch(() => {});
              }
            }
            if (dataType === 'board_task') {
              const taskProjectId = (execResult.executedData as Record<string, unknown>)?.project_id as string;
              if (taskProjectId) await loadBoardData(taskProjectId);
            }
          } catch (execErr) {
            console.error('[Brain DM] Auto-execute failed:', actionId, execErr);
          }
        }

        // Sync bot message statuses
        const botMessageId = (brainResult.message as { id?: string })?.id;
        if (botMessageId && brainActions.length > 0 && isSupabaseConfigured()) {
          try {
            const dbActions = await brainService.getActionsByMessage(botMessageId);
            if (dbActions.length > 0) {
              const updatedBrainData = {
                hasAction: brainResult.llmResponse.hasAction,
                replyMessage: brainResult.llmResponse.replyMessage,
                actions: dbActions.map(a => ({
                  id: a.id,
                  type: a.actionType,
                  confidence: 1,
                  data: a.extractedData || {},
                  status: a.status,
                })),
              };
              const { supabase: sb } = await import('@/lib/supabase');
              await sb.from('chat_messages').update({ brain_action_data: updatedBrainData }).eq('id', botMessageId);
            }
          } catch (updateErr) {
            console.warn('[Brain DM] Failed to sync statuses:', updateErr);
          }
        }

        console.log('[Brain DM] Auto-query completed');
      } catch (brainErr) {
        console.error('[Brain DM] query failed:', brainErr);
        toast.error(`Brain AI 응답 실패: ${(brainErr as Error).message}`);
      } finally {
        setBrainProcessing(false);
      }
      return; // Skip persona/brain mention processing
    }

    // If DM target is an AI persona, auto-trigger persona query (no @mention needed)
    if (selectedChat.type === 'direct' && isAIPersonaUser(selectedChat.id)) {
      const personaInfo = PERSONA_ID_MAP[selectedChat.id];
      if (personaInfo) {
        setPabloProcessing(true);
        try {
          await personaService.queryPersona({
            personaId: personaInfo.personaId,
            query: trimmed,
            directChatUserId: selectedChat.id,
          });
          console.log(`[Persona DM] ${personaInfo.personaId} auto-query completed`);
        } catch (personaErr) {
          console.error(`[Persona DM] ${personaInfo.personaId} query failed:`, personaErr);
          toast.error(`AI 페르소나 응답 실패: ${(personaErr as Error).message}`);
        } finally {
          setPabloProcessing(false);
        }
        return; // Skip brain processing for persona DM
      }
    }

    // 2. Persona query — triggered by @pablo, @cd, @pd mention in message
    if (isPersonaMention && personaCleanContent) {
      setPabloProcessing(true);
      try {
        await personaService.queryPersona({
          personaId,
          query: personaCleanContent,
          projectId: selectedChat.type === 'project' ? selectedChat.id : undefined,
          roomId: selectedChat.roomId,
          directChatUserId: selectedChat.type === 'direct' ? selectedChat.id : undefined,
        });
        console.log(`[Persona] ${personaId} query completed`);
      } catch (personaErr) {
        console.error(`[Persona] ${personaId} query failed:`, personaErr);
        toast.error(`AI 페르소나 응답 실패: ${(personaErr as Error).message}`);
      } finally {
        setPabloProcessing(false);
      }
      return; // Skip brain processing if persona was triggered
    }

    // 3. Brain AI: triggered by @AiAssistant mention — works for both project and DM chats
    if (forceBrain && cleanContent) {
      setBrainProcessing(true);
      try {
        // Build chat members list for name resolution
        let chatMembers: { id: string; name: string }[] = [];
        let brainProjectId: string | undefined;
        let brainProjectTitle: string | undefined;

        if (selectedChat.type === 'project') {
          const project = projects.find(p => p.id === selectedChat.id) || null;
          const memberIds = project?.teamMemberIds || [];
          chatMembers = memberIds
            .map(id => {
              const user = getUserById(id);
              return user ? { id: user.id, name: user.name } : null;
            })
            .filter(Boolean) as { id: string; name: string }[];
          brainProjectId = selectedChat.id;
          brainProjectTitle = project?.title;
        } else {
          // DM chat — members are current user + the other user
          const otherUser = getUserById(selectedChat.id);
          if (otherUser) {
            chatMembers.push({ id: otherUser.id, name: otherUser.name });
          }
        }

        // Always include current user
        if (!chatMembers.find(m => m.id === currentUser.id)) {
          chatMembers.push({ id: currentUser.id, name: currentUser.name });
        }

        // Always use Claude LLM for intelligent parsing (replaces regex parser)
        const brainResult = await brainService.processMessageWithLLM({
          messageContent: cleanContent,
          roomId: selectedChat.roomId,
          projectId: brainProjectId,
          directChatUserId: selectedChat.type === 'direct' ? selectedChat.id : undefined,
          userId: currentUser.id,
          chatMembers,
          projectTitle: brainProjectTitle,
        });

        // Auto-execute all pending actions (same as BrainChatWidget)
        // This ensures todos/events are created immediately without manual "Confirm"
        const brainActions = brainResult.actions || [];
        for (const action of brainActions) {
          const actionId = (action as { id?: string }).id;
          if (!actionId) continue;

          // Handle service suggestions locally (no server-side execution needed)
          const act = action as Record<string, unknown>;
          const actionType = act.action_type || act.actionType;
          if (actionType === 'submit_service_suggestion') {
            const extracted = (act.extracted_data || act.extractedData) as Record<string, unknown> | undefined;
            if (extracted) {
              addBrainReport({
                userId: currentUser.id,
                userName: currentUser.name,
                suggestion: (extracted.suggestion as string) || cleanContent,
                brainSummary: (extracted.brainSummary as string) || '',
                category: (extracted.category as 'feature_request' | 'bug_report' | 'ui_improvement' | 'workflow_suggestion' | 'other') || 'other',
                priority: (extracted.priority as 'low' | 'medium' | 'high') || 'medium',
                chatRoomId: selectedChat?.roomId,
                messageId: undefined,
              });
              console.log('[Brain] Service suggestion saved to Brain Report (Supabase path)');
            }
            continue; // Skip server-side execution for suggestions
          }

          try {
            await brainService.updateActionStatus(actionId, 'confirmed', currentUser.id);
            const execResult = await brainService.executeAction(actionId, currentUser.id);
            const dataType = (execResult.executedData as { type?: string })?.type;
            if (dataType === 'event') {
              await loadEvents();
              const execData = execResult.executedData as Record<string, unknown>;
              const isUpdate = execData.updated === true;

              if (!isUpdate) {
                // Smart dedup: only for create_event — if Brain accidentally creates
                // a duplicate, detect same-title events and remove the older one.
                const newTitle = (execData.title as string) || '';
                if (newTitle) {
                  const { events: currentEvents, deleteEvent: delEvt } = useAppStore.getState();
                  const dupes = currentEvents.filter(e => e.title === newTitle);
                  if (dupes.length > 1) {
                    const sorted = dupes.sort((a, b) =>
                      new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
                    );
                    for (let d = 1; d < sorted.length; d++) {
                      await delEvt(sorted[d].id);
                      console.log(`[Brain] Dedup: removed older event "${sorted[d].title}" (${sorted[d].id})`);
                    }
                  }
                }
              }
              console.log(`[Brain] Auto-executed ${isUpdate ? 'event update' : 'event creation'} from chat, refreshed`);
            }
            if (dataType === 'todo') {
              await loadTodos();
              // Smart dedup: remove duplicate todos with same title
              const todoExecData = execResult.executedData as Record<string, unknown>;
              const todoTitle = (todoExecData.title as string) || '';
              if (todoTitle) {
                const { personalTodos, deleteTodo } = useAppStore.getState();
                const dupes = personalTodos.filter(td => td.title === todoTitle);
                if (dupes.length > 1) {
                  const sorted = [...dupes].sort((a, b) =>
                    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                  );
                  for (let d = 1; d < sorted.length; d++) {
                    await deleteTodo(sorted[d].id);
                    console.log(`[Brain] Dedup: removed older todo "${sorted[d].title}" (${sorted[d].id})`);
                  }
                }
              }
              console.log('[Brain] Auto-executed todo from chat, refreshed');
              for (let retry = 1; retry <= 2; retry++) {
                await new Promise(r => setTimeout(r, 1000));
                await loadTodos().catch(() => {});
              }
            }
            if (dataType === 'board_task') {
              const taskProjectId = (execResult.executedData as Record<string, unknown>)?.project_id as string;
              if (taskProjectId) {
                await loadBoardData(taskProjectId);
              }
              console.log('[Brain] Auto-executed board task from chat, refreshed');
            }
          } catch (execErr) {
            console.error('[Brain] Auto-execute failed for action:', actionId, execErr);
            // Mock mode fallback: create/update todo/event locally from action's extracted data
            if (!isSupabaseConfigured()) {
              const act = action as Record<string, unknown>;
              const actionType = act.action_type || act.actionType;
              const extracted = (act.extracted_data || act.extractedData) as Record<string, unknown> | undefined;
              if (actionType === 'create_todo' && extracted) {
                await addTodo({
                  title: (extracted.title as string) || 'Untitled',
                  assigneeIds: (extracted.assigneeIds as string[]) || [currentUser.id],
                  dueDate: (extracted.dueDate as string) || new Date().toISOString(),
                  priority: (extracted.priority as 'HIGH' | 'NORMAL' | 'LOW') || 'NORMAL',
                  projectId: (extracted.projectId as string) || selectedChat?.id,
                });
                console.log('[Brain] Mock fallback: todo created locally');
              }
              if (actionType === 'create_event' && extracted) {
                await addEvent({
                  title: (extracted.title as string) || 'Untitled Event',
                  startAt: (extracted.startAt as string) || (extracted.start as string) || new Date().toISOString(),
                  endAt: (extracted.endAt as string) || (extracted.end as string) || new Date().toISOString(),
                  type: (extracted.type as 'MEETING' | 'TASK' | 'DEADLINE') || 'MEETING',
                  projectId: (extracted.projectId as string) || selectedChat?.id,
                  ownerId: currentUser.id,
                  source: 'PAULUS',
                });
                console.log('[Brain] Mock fallback: event created locally');
              }
              if (actionType === 'update_event' && extracted) {
                const eventId = extracted.eventId as string;
                if (eventId) {
                  const updates: Record<string, unknown> = {};
                  if (extracted.title) updates.title = extracted.title;
                  if (extracted.startAt || extracted.start) updates.startAt = extracted.startAt || extracted.start;
                  if (extracted.endAt || extracted.end) updates.endAt = extracted.endAt || extracted.end;
                  if (extracted.type) updates.type = extracted.type;
                  await updateEvent(eventId, updates);
                  console.log('[Brain] Mock fallback: event updated locally');
                } else {
                  // No eventId — try to find event by title and update it
                  const { events } = useAppStore.getState();
                  const targetTitle = (extracted.title as string) || (extracted.originalTitle as string);
                  if (targetTitle) {
                    const matchEvent = events.find(e =>
                      e.title.includes(targetTitle) || targetTitle.includes(e.title)
                    );
                    if (matchEvent) {
                      const updates: Record<string, unknown> = {};
                      if (extracted.newTitle) updates.title = extracted.newTitle;
                      if (extracted.startAt || extracted.start || extracted.newStartAt) updates.startAt = extracted.newStartAt || extracted.startAt || extracted.start;
                      if (extracted.endAt || extracted.end || extracted.newEndAt) updates.endAt = extracted.newEndAt || extracted.endAt || extracted.end;
                      await updateEvent(matchEvent.id, updates);
                      console.log('[Brain] Mock fallback: event updated by title match');
                    }
                  }
                }
              }
              // Handle service suggestion action — save to Brain Report
              if (actionType === 'submit_service_suggestion' && extracted) {
                addBrainReport({
                  userId: currentUser.id,
                  userName: currentUser.name,
                  suggestion: (extracted.suggestion as string) || cleanContent,
                  brainSummary: (extracted.brainSummary as string) || '',
                  category: (extracted.category as 'feature_request' | 'bug_report' | 'ui_improvement' | 'workflow_suggestion' | 'other') || 'other',
                  priority: (extracted.priority as 'low' | 'medium' | 'high') || 'medium',
                  chatRoomId: selectedChat?.roomId,
                  messageId: undefined,
                });
                console.log('[Brain] Service suggestion saved to Brain Report');
              }
              if (actionType === 'create_board_task' && extracted) {
                const taskProjectId = (extracted.projectId as string) || selectedChat?.id;
                if (taskProjectId) {
                  await addBoardTask({
                    boardGroupId: '', // Will be resolved in store
                    projectId: taskProjectId,
                    title: (extracted.title as string) || 'Untitled Task',
                    ownerId: (extracted.assigneeIds as string[])?.[0] || currentUser.id,
                    status: (extracted.status as 'backlog' | 'working') || 'backlog',
                    startDate: (extracted.startDate as string) || new Date().toISOString().slice(0, 10),
                    endDate: extracted.endDate as string,
                    dueDate: extracted.dueDate as string,
                  });
                  console.log('[Brain] Mock fallback: board task created locally');
                }
              }
            }
          }
        }

        // After all actions auto-executed, update the bot message's brain_action_data
        // with final statuses so other users see "Done" instead of "Pending"
        const botMessageId = (brainResult.message as { id?: string })?.id;
        if (botMessageId && brainActions.length > 0 && isSupabaseConfigured()) {
          try {
            const dbActions = await brainService.getActionsByMessage(botMessageId);
            if (dbActions.length > 0) {
              const updatedBrainData = {
                hasAction: brainResult.llmResponse.hasAction,
                replyMessage: brainResult.llmResponse.replyMessage,
                actions: dbActions.map(a => ({
                  id: a.id,
                  type: a.actionType,
                  confidence: 1,
                  data: a.extractedData || {},
                  status: a.status,
                })),
              };
              const { supabase: sb } = await import('@/lib/supabase');
              await sb
                .from('chat_messages')
                .update({ brain_action_data: updatedBrainData })
                .eq('id', botMessageId);
              console.log('[Brain] Updated bot message brain_action_data with final statuses');
            }
          } catch (updateErr) {
            console.warn('[Brain] Failed to update bot message statuses (non-fatal):', updateErr);
          }
        }

        // Bot message will arrive via realtime subscription
      } catch (error) {
        console.error('Brain AI processing failed:', error);
        // Show error only if user explicitly triggered brain (Cmd+Enter)
        if (forceBrain) {
          toast.error('Brain AI processing failed', {
            description: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      } finally {
        setBrainProcessing(false);
      }
    }
  };

  // Brain action confirm/reject handlers
  const handleConfirmBrainAction = async (actionId: string) => {
    if (!currentUser) return;
    try {
      // First confirm, then execute
      await brainService.updateActionStatus(actionId, 'confirmed', currentUser.id);
      console.log('[Brain] Status updated to confirmed, now executing...');
      const result = await brainService.executeAction(actionId, currentUser.id);
      console.log('[Brain] Execute result:', JSON.stringify(result));

      const dataType = result.executedData?.type;
      const isEventAction = dataType === 'event' || dataType === 'update_event';
      const actionLabel =
        dataType === 'todo'
          ? 'Todo created successfully!'
          : dataType === 'event'
            ? 'Event created successfully!'
            : dataType === 'update_event'
              ? 'Event updated successfully!'
              : dataType === 'board_task'
                ? '보드 태스크가 생성되었습니다!'
                : 'Action completed!';
      toast.success(actionLabel);

      // Push brain notification for confirmed chat Brain actions
      if (dataType === 'event' || dataType === 'update_event') {
        const execData = result.executedData as Record<string, unknown>;
        addBrainNotification({
          type: 'brain_event',
          title: dataType === 'update_event' ? '이벤트 수정됨' : '이벤트 생성됨',
          message: (execData.title as string) || 'Event',
          chatRoomId: selectedChat?.roomId,
        });
      } else if (dataType === 'todo') {
        const execData = result.executedData as Record<string, unknown>;
        addBrainNotification({
          type: 'brain_todo',
          title: '할 일 생성됨',
          message: (execData.title as string) || 'Todo',
          chatRoomId: selectedChat?.roomId,
        });
      } else if (dataType === 'board_task') {
        const execData = result.executedData as Record<string, unknown>;
        addBrainNotification({
          type: 'brain_todo',
          title: '보드 태스크 생성됨',
          message: (execData.title as string) || 'Board Task',
          chatRoomId: selectedChat?.roomId,
        });
        const taskProjectId = execData.project_id as string;
        if (taskProjectId) {
          await loadBoardData(taskProjectId);
        }
      }

      // Force immediate refresh + retries for the created/updated entity
      // The edge function uses service_role key so the insert is instant
      if (isEventAction || dataType === 'todo') {
        const loadFn = isEventAction ? loadEvents : loadTodos;
        // Immediate first attempt
        try {
          await loadFn();
          console.log(`[Brain] Immediate ${dataType} refresh succeeded`);
        } catch (err) {
          console.error(`[Brain] Immediate ${dataType} refresh failed:`, err);
        }
        // Two more retries with delays
        for (let i = 1; i <= 2; i++) {
          await new Promise(r => setTimeout(r, 1000));
          try {
            await loadFn();
            console.log(`[Brain] Retry ${i} ${dataType} refresh succeeded`);
          } catch (err) {
            console.error(`[Brain] Retry ${i} ${dataType} refresh failed:`, err);
          }
        }
      }
      // Update the bot message's brain_action_data so other users see final status
      await syncBrainMessageStatus(actionId);
    } catch (error) {
      console.error('Failed to execute brain action:', error);
      toast.error('Failed to execute action. Please try again.');
    }
  };

  const handleRejectBrainAction = async (actionId: string) => {
    if (!currentUser) return;
    try {
      await brainService.updateActionStatus(actionId, 'rejected', currentUser.id);
      // Sync status to bot message for other users
      await syncBrainMessageStatus(actionId);
      toast.info('Action rejected.');
    } catch (error) {
      console.error('Failed to reject brain action:', error);
      toast.error('Failed to reject action.');
    }
  };

  /**
   * After executing/rejecting a brain action, update the parent chat_message's
   * brain_action_data with the latest statuses from brain_actions table.
   * This ensures other users loading the chat later see correct final status
   * (e.g., "Done" instead of stale "Pending").
   */
  const syncBrainMessageStatus = async (actionId: string) => {
    if (!isSupabaseConfigured()) return;
    try {
      const { supabase: sb } = await import('@/lib/supabase');
      // Get the message_id from the action
      const { data: actionRow } = await sb
        .from('brain_actions')
        .select('message_id')
        .eq('id', actionId)
        .single();
      if (!actionRow?.message_id) return;

      // Fetch all actions for this message + the existing brain_action_data
      const [allActions, { data: msgRow }] = await Promise.all([
        brainService.getActionsByMessage(actionRow.message_id),
        sb.from('chat_messages').select('brain_action_data').eq('id', actionRow.message_id).single(),
      ]);
      if (allActions.length === 0) return;

      const existingData = msgRow?.brain_action_data as Record<string, unknown> | undefined;
      const updatedBrainData = {
        hasAction: true,
        replyMessage: (existingData?.replyMessage as string) || '',
        actions: allActions.map(a => ({
          id: a.id,
          type: a.actionType,
          confidence: 1,
          data: a.extractedData || {},
          status: a.status,
        })),
      };

      await sb
        .from('chat_messages')
        .update({ brain_action_data: updatedBrainData })
        .eq('id', actionRow.message_id);
      console.log('[Brain] Synced bot message brain_action_data with final statuses');
    } catch (err) {
      console.warn('[Brain] Failed to sync bot message statuses (non-fatal):', err);
    }
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

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { deleteMessage } = useAppStore.getState();
      await deleteMessage(messageId);
      toast.success(t('messageDeleted'));
    } catch {
      toast.error(t('failedToDeleteMessage'));
    }
  };

  // File upload handler for chat
  const handleFileUploadConfirm = async (category: FileCategory, isImportant: boolean, comment: string, file?: File) => {
    if (!currentUser || !selectedChat) return;

    const isDM = selectedChat.type === 'direct';
    const projectId = isDM ? '' : selectedChat.id;
    const categoryTitles: Record<FileCategory, string> = {
      DECK: 'Presentations',
      FINAL: 'Final Deliverables',
      REFERENCE: 'References',
      CONTRACT: 'Contracts',
      ETC: 'Others',
    };

    try {
      const fileName = file?.name || `Document_${Date.now().toString().slice(-6)}.pdf`;

      if (isSupabaseConfigured() && file) {
        const storageBucket = isDM ? 'dm-files' : projectId;
        const { path: storagePath } = await fileService.uploadFile(file, storageBucket, currentUser.id);

        const fileExt = file.name.split('.').pop() || '';
        const fileSize = file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

        let fileItemId: string;

        if (isDM) {
          const { data, error } = await (await import('@/lib/supabase')).supabase
            .from('file_items')
            .insert({
              name: file.name,
              uploaded_by: currentUser.id,
              size: fileSize,
              type: fileExt,
              is_important: isImportant,
              source: 'CHAT',
              comment: comment || null,
              storage_path: storagePath,
            })
            .select()
            .single();

          if (error) throw new Error(error.message);
          fileItemId = data.id;

          addFile({
            id: data.id,
            fileGroupId: null,
            name: file.name,
            uploadedBy: currentUser.id,
            createdAt: data.created_at,
            size: fileSize,
            type: fileExt,
            isImportant,
            source: 'CHAT',
            comment,
            storagePath,
          });
        } else {
          const fileGroups = getFileGroupsByProject(projectId);
          let fileGroup = fileGroups.find(fg => fg.category === category);

          if (!fileGroup) {
            fileGroup = await fileService.createFileGroup({
              projectId,
              category,
              title: categoryTitles[category],
            });
            addFileGroup(fileGroup);
          }

          const fileItem = await fileService.createFileItem({
            fileGroupId: fileGroup.id,
            name: file.name,
            uploadedBy: currentUser.id,
            size: fileSize,
            type: fileExt,
            isImportant,
            source: 'CHAT',
            comment,
            storagePath,
          });

          addFile(fileItem);
          fileItemId = fileItem.id;
        }

        if (isDM) {
          await sendDirectMessage(selectedChat.id, `📎 Uploaded file: ${file.name}`, fileItemId);
        } else if (selectedChat.roomId) {
          await sendRoomMessage(selectedChat.roomId, projectId, `📎 Uploaded file: ${file.name}`, {
            messageType: 'file',
            attachmentId: fileItemId,
          });
        } else {
          await sendProjectMessage(projectId, `📎 Uploaded file: ${file.name}`, fileItemId);
        }
      } else {
        const newFileId = `f${Date.now()}`;
        addFile({
          id: newFileId,
          fileGroupId: '',
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
          directChatUserId: isDM ? selectedChat.id : undefined,
        });
      }

      toast.success(`${fileName} ${t('uploadComplete')}`);
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error(t('failedToUploadFile'));
    }
  };

  // Project click: expand rooms AND auto-select default room
  const handleExpandProject = useCallback(async (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }
    setExpandedProjectId(projectId);
    await loadChatRooms(projectId);

    const rooms = getChatRoomsByProject(projectId);
    // Freelancers cannot auto-select the default (main) room
    const availableRooms = isFreelancer ? rooms.filter(r => !r.isDefault) : rooms;
    const defaultRoom = availableRooms.find(r => r.isDefault) || availableRooms[0];
    if (defaultRoom) {
      setSelectedChat({ type: 'project', id: projectId, roomId: defaultRoom.id });
    }
  }, [expandedProjectId, loadChatRooms, getChatRoomsByProject, isFreelancer]);

  const handleSelectRoom = (projectId: string, room: ChatRoom) => {
    setSelectedChat({ type: 'project', id: projectId, roomId: room.id });
  };

  const handleSelectDirectChat = async (userId: string) => {
    setSelectedChat({ type: 'direct', id: userId });
    // Preload DM history for this conversation (ensures first-time chats work)
    if (isSupabaseConfigured() && currentUser) {
      try {
        const msgs = await chatService.getDirectMessages(currentUser.id, userId);
        if (msgs.length > 0) {
          const existingIds = new Set(useAppStore.getState().messages.map(m => m.id));
          const newMsgs = msgs.filter(m => !existingIds.has(m.id));
          if (newMsgs.length > 0) {
            useAppStore.setState((state) => ({
              messages: [...state.messages, ...newMsgs],
            }));
          }
        }
      } catch (e) {
        console.error('Failed to preload DM history:', e);
      }
    }
  };

  const handleBackToList = () => {
    setSelectedChat(null);
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !expandedProjectId || !currentUser) return;

    const memberIds = selectedMemberIds.length > 0 ? selectedMemberIds : undefined;
    await createChatRoom(expandedProjectId, newRoomName.trim(), memberIds || [], newRoomDescription.trim() || undefined);

    setNewRoomName('');
    setNewRoomDescription('');
    setSelectedMemberIds([]);
    setShowCreateRoom(false);
  };

  const expandedProjectMembers = useMemo(() => {
    if (!expandedProjectId) return [];
    const project = projects.find(p => p.id === expandedProjectId);
    if (!project?.teamMemberIds) return [];
    return project.teamMemberIds.map(id => users.find(u => u.id === id)).filter(Boolean);
  }, [expandedProjectId, projects, users]);

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
      // Check if it's Brain AI
      if (isBrainAIUser(selectedChat.id)) {
        return { name: 'Brain AI', subtitle: '업무 자동화 AI 어시스턴트 · 일정, 할일, 업무 요청' };
      }
      // Check if it's an AI persona
      if (isAIPersonaUser(selectedChat.id)) {
        const personaInfo = PERSONA_ID_MAP[selectedChat.id];
        return personaInfo ? { name: personaInfo.name, subtitle: personaInfo.description } : null;
      }
      const user = users.find(u => u.id === selectedChat.id);
      return user ? { name: user.name, subtitle: user.department, avatar: user.avatar } : null;
    }
  }, [selectedChat, projects, users, chatRooms]);

  const chatMemberIds = useMemo(() => {
    if (!selectedChat) return undefined;
    if (selectedChat.type === 'project') {
      const project = projects.find(p => p.id === selectedChat.id);
      return project?.teamMemberIds || undefined;
    } else {
      return currentUser ? [selectedChat.id, currentUser.id] : [selectedChat.id];
    }
  }, [selectedChat, projects, currentUser]);

  // Sort messages chronologically, then group by date
  const groupedMessages = useMemo(() => {
    const sorted = [...chatMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const groups: Record<string, typeof chatMessages> = {};
    const dateOrder: string[] = [];
    for (const message of sorted) {
      const date = formatDate(message.createdAt);
      if (!groups[date]) {
        groups[date] = [];
        dateOrder.push(date);
      }
      groups[date].push(message);
    }
    // Return as ordered entries array to preserve date order
    return { groups, dateOrder };
  }, [chatMessages]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden w-full max-w-full">
      {/* When no chat selected: show chat list */}
      {!selectedChat ? (
        <div className="flex flex-col h-full">
          {/* Search */}
          <div className="p-3 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('searchChats')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'projects' | 'direct')} className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full rounded-none border-b border-border bg-transparent p-0 shrink-0">
              <TabsTrigger
                value="projects"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1.5 text-xs py-2"
              >
                <FolderKanban className="w-3.5 h-3.5" />
                {t('projects')}
              </TabsTrigger>
              <TabsTrigger
                value="direct"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent gap-1.5 text-xs py-2"
              >
                <Users className="w-3.5 h-3.5" />
                {t('direct')}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="projects" className="m-0">
                {filteredProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FolderKanban className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">{t('noProjectsFound')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredProjects.map((project) => {
                      const lastMessage = getLastMessage(project.id);
                      const isExpanded = expandedProjectId === project.id;
                      const rooms = isExpanded ? projectRooms : [];

                      return (
                        <div key={project.id}>
                          <button
                            onClick={() => handleExpandProject(project.id)}
                            className={`w-full flex items-start gap-2.5 p-3 hover:bg-muted/50 transition-colors group text-left ${isExpanded ? 'bg-muted/30' : ''}`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                              {project.thumbnail ? (
                                <img src={project.thumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <FolderKanban className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center justify-between gap-1">
                                <h3 className="font-medium text-foreground text-xs line-clamp-1">
                                  {project.title}
                                </h3>
                                <div className="flex items-center gap-1 shrink-0">
                                  {lastMessage && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {formatTime(lastMessage.createdAt)}
                                    </span>
                                  )}
                                  <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {project.client}
                              </p>
                              {lastMessage && (
                                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {lastMessage.content}
                                </p>
                              )}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="bg-muted/20 border-t border-border/50">
                              {rooms.map((room) => {
                                const isRoomSelected = selectedChat?.roomId === room.id;
                                const isDefaultRoom = room.isDefault;
                                const isRoomLocked = isFreelancer && isDefaultRoom;
                                return (
                                  <button
                                    key={room.id}
                                    onClick={() => {
                                      if (isRoomLocked) {
                                        toast.info(t('mainChatRestricted'));
                                        return;
                                      }
                                      handleSelectRoom(project.id, room);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 pl-12 hover:bg-muted/50 transition-colors text-left text-xs ${
                                      isRoomLocked ? 'opacity-40 cursor-not-allowed' :
                                      isRoomSelected ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                                    }`}
                                  >
                                    <Hash className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{room.name}</span>
                                    {isDefaultRoom && (
                                      <span className="text-[9px] bg-muted px-1 py-0.5 rounded-full shrink-0">{t('defaultRoom')}</span>
                                    )}
                                    {isRoomLocked && (
                                      <span className="text-[9px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1 py-0.5 rounded-full shrink-0">
                                        {t('subChatOnly')}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                              <button
                                onClick={() => setShowCreateRoom(true)}
                                className="w-full flex items-center gap-2 px-3 py-2 pl-12 hover:bg-muted/50 transition-colors text-left text-xs text-muted-foreground/70"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{t('newChatRoom')}</span>
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
                    <Users className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">{t('noUsersFound')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredUsers.map((user) => {
                      const isSelected = selectedChat?.type === 'direct' && selectedChat?.id === user.id;
                      const lastDM = getLastDirectMessage(user.id);

                      return (
                        <button
                          key={user.id}
                          onClick={() => handleSelectDirectChat(user.id)}
                          className={`w-full flex items-start gap-2.5 p-3 hover:bg-muted/50 transition-colors group text-left ${isSelected ? 'bg-muted' : ''}`}
                        >
                          <Avatar className="w-8 h-8 shrink-0">
                            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                            <AvatarFallback className={`text-xs ${
                              isBrainAIUser(user.id)
                                ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                                : isAIPersonaUser(user.id)
                                  ? PERSONA_ID_MAP[user.id]?.color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                    : PERSONA_ID_MAP[user.id]?.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                    : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                  : 'bg-primary/10 text-primary'
                            }`}>
                              {isBrainAIUser(user.id) ? '🧠' : isAIPersonaUser(user.id) ? '\uD83E\uDD16' : getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="font-medium text-foreground text-xs flex items-center gap-1">
                                {user.name}
                                {isBrainAIUser(user.id) && (
                                  <span className="text-[9px] px-1 py-0.5 rounded-full font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                                    AI
                                  </span>
                                )}
                                {isAIPersonaUser(user.id) && (
                                  <span className={`text-[9px] px-1 py-0.5 rounded-full font-medium ${
                                    PERSONA_ID_MAP[user.id]?.color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                                    PERSONA_ID_MAP[user.id]?.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  }`}>
                                    AI
                                  </span>
                                )}
                              </h3>
                              {lastDM && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {formatTime(lastDM.createdAt)}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {user.department}
                            </p>
                            {lastDM && (
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                                {lastDM.content}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      ) : (
        /* When chat selected: show messages */
        <div className="flex flex-col h-full overflow-hidden">
          {/* Chat Header — sticky on mobile so it never scrolls away */}
          <div className={`p-3 border-b border-border flex items-center gap-2.5 shrink-0 min-w-0 overflow-hidden bg-background ${isMobile ? 'sticky top-0 z-20' : ''}`}>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 w-7 h-7"
              onClick={handleBackToList}
              aria-label="Back to chat list"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            {selectedChat.type === 'project' ? (
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                {selectedChatInfo?.thumbnail ? (
                  <img src={selectedChatInfo.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <FolderKanban className="w-4 h-4 text-primary" />
                )}
              </div>
            ) : (
              <Avatar className="w-8 h-8">
                {selectedChatInfo?.avatar && <AvatarImage src={selectedChatInfo.avatar} alt={selectedChatInfo?.name} />}
                <AvatarFallback className={`text-xs ${
                  selectedChat?.id && isBrainAIUser(selectedChat.id)
                    ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {selectedChat?.id && isBrainAIUser(selectedChat.id)
                    ? '🧠'
                    : selectedChatInfo?.name ? getInitials(selectedChatInfo.name) : '?'}
                </AvatarFallback>
              </Avatar>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-semibold text-foreground text-sm truncate">
                  {selectedChatInfo?.name}
                </h2>
                {brainIntelligenceEnabled && (
                  <Badge variant="outline" className="text-[10px] gap-1 text-violet-500 border-violet-200 dark:border-violet-800 shrink-0">
                    <Brain className="w-2.5 h-2.5" /> {t('brainAiActive')}
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {selectedChatInfo?.subtitle}
              </p>
            </div>

            {/* Call buttons — hide for Brain AI / AI persona chats */}
            {selectedChat && !isBrainAIUser(selectedChat.id) && !isAIPersonaUser(selectedChat.id) && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-muted-foreground hover:text-green-500"
                  onClick={() => { setCallMediaType('voice'); setShowCallDialog(true); }}
                  title="음성 통화"
                >
                  <Phone className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-muted-foreground hover:text-blue-500"
                  onClick={() => { setCallMediaType('video'); setShowCallDialog(true); }}
                  title="화상 통화"
                >
                  <Video className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Pinned Announcement Banner */}
          {pinnedAnnouncement && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/50 dark:border-amber-800/50 shrink-0 min-w-0">
              <Pin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-200 flex-1 min-w-0 truncate font-medium">
                {pinnedAnnouncement.content}
              </p>
              <button
                onClick={() => setPinnedAnnouncement(null)}
                className="p-0.5 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors shrink-0"
                title={t('close')}
              >
                <X className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              </button>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 p-3 min-w-0 overflow-x-hidden">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Send className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-foreground text-sm mb-1">{t('noMessagesYet')}</h3>
                <p className="text-xs text-muted-foreground">
                  {t('startConversation')}
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-w-full">
                {groupedMessages.dateOrder.map((date) => {
                  const dateMessages = groupedMessages.groups[date];
                  return (
                  <div key={date} className="max-w-full">
                    <div className="flex items-center gap-2 mb-3">
                      <Separator className="flex-1" />
                      <span className="text-[10px] font-medium text-muted-foreground">{date}</span>
                      <Separator className="flex-1" />
                    </div>
                    <div className="space-y-3">
                      {dateMessages.map((message, index) => {
                        const user = getUserById(message.userId);
                        const isCurrentUser = message.userId === currentUser?.id;
                        const showAvatar = index === 0 || dateMessages[index - 1].userId !== message.userId;

                        return (
                          <div
                            key={message.id}
                            className={`flex gap-2 min-w-0 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
                          >
                            {showAvatar ? (
                              <Avatar className="w-7 h-7 shrink-0">
                                {user?.avatar && <AvatarImage src={user.avatar} alt={user?.name} />}
                                <AvatarFallback className={`text-[10px] ${isCurrentUser
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                                  }`}>
                                  {user?.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="w-7" />
                            )}
                            <div className={`flex-1 min-w-0 overflow-visible ${isCurrentUser ? 'text-right' : ''}`}>
                              {showAvatar && (
                                <div className={`flex items-center gap-1.5 mb-0.5 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                                  <span className="text-xs font-medium text-foreground">
                                    {isCurrentUser ? t('you') : user?.name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatMessageTime(message.createdAt)}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`group/msg-actions relative max-w-full pt-2 ${isCurrentUser ? 'ml-auto' : ''}`}
                                style={{ width: message.messageType === 'brain_action' ? '100%' : 'fit-content' }}
                              >
                                <ChatMessageBubble
                                  message={message}
                                  isCurrentUser={isCurrentUser}
                                  onVoteDecision={handleVoteDecision}
                                  onAcceptSchedule={handleAcceptSchedule}
                                  onDelete={handleDeleteMessage}
                                  onPin={(msgId) => {
                                    const msg = chatMessages.find(m => m.id === msgId);
                                    if (msg) setPinnedAnnouncement(msg);
                                  }}
                                  onConfirmBrainAction={handleConfirmBrainAction}
                                  onRejectBrainAction={handleRejectBrainAction}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <Separator />

          {/* AI Persona Processing Indicator */}
          {pabloProcessing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200/50 dark:border-amber-800/50">
              <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                AI 페르소나가 생각하는 중...
              </span>
            </div>
          )}

          {/* Brain Processing Indicator */}
          {brainProcessing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-950/30 border-t border-violet-200/50 dark:border-violet-800/50">
              <div className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">
                Brain AI is thinking...
              </span>
            </div>
          )}

          {/* /analyze command removed */}

          {/* Message Input — Enter=send, @AiAssistant=Brain AI, @pablo/@cd/@pd=Persona */}
          <div className={`p-2.5 bg-background shrink-0 min-w-0 ${isMobile ? 'sticky bottom-0 z-20 border-t' : ''}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 w-8 h-8"
                aria-label="Attach file"
                onClick={() => setShowFileUpload(true)}
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <MentionTextarea
                placeholder={
                  selectedChat?.type === 'direct' && selectedChat?.id && isBrainAIUser(selectedChat.id)
                    ? t('brainAIPlaceholder')
                    : t('typeMessage')
                }
                value={newMessage}
                onChange={setNewMessage}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    if (e.shiftKey) {
                      // Shift+Enter → newline (default behavior)
                    } else {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }
                }}
                rows={1}
                className="flex-1"
                mentionableUserIds={
                  selectedChat?.type === 'project'
                    ? projects.find(p => p.id === selectedChat.id)?.teamMemberIds
                    : undefined
                }
                showPersonaMentions
              />
              <Button
                size="icon"
                className="shrink-0 w-8 h-8"
                onClick={() => handleSendMessage()}
                disabled={!newMessage.trim()}
                aria-label="Send message"
              >
                {brainProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
            {/* Keyboard shortcut hints — hidden on mobile */}
            <div className={`flex items-center gap-3 mt-1 px-1 ${isMobile ? 'hidden' : ''}`}>
              <span className="text-[10px] text-muted-foreground">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Shift</kbd>+<kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Enter</kbd> {t('newLine')}
              </span>
              {selectedChat?.type === 'direct' && selectedChat?.id && isBrainAIUser(selectedChat.id) ? (
                <span className="text-[10px] text-violet-500 font-medium flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  Brain AI와 직접 대화 · 대화 내용이 누적됩니다
                </span>
              ) : (
                <span className="text-[10px] text-violet-500 font-medium flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  @Brain AI @pablo @cd @pd → AI 페르소나
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Upload Modal */}
      {selectedChat && (
        <FileUploadModal
          open={showFileUpload}
          onClose={() => setShowFileUpload(false)}
          projectId={selectedChat.type === 'project' ? selectedChat.id : 'direct-messages'}
          onUpload={handleFileUploadConfirm}
        />
      )}

      {/* /analyze file input removed */}

      {/* Create Room Dialog */}
      <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('createNewChatRoom')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="roomName">{t('chatRoomName')}</Label>
              <Input
                id="roomName"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder={t('chatRoomNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roomDesc">{t('descriptionOptional')}</Label>
              <Input
                id="roomDesc"
                value={newRoomDescription}
                onChange={(e) => setNewRoomDescription(e.target.value)}
                placeholder={t('chatRoomDescriptionPlaceholder')}
              />
            </div>
            {expandedProjectMembers.length > 0 && (
              <div className="space-y-2">
                <Label>{t('selectMembers')}</Label>
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
              {t('cancel')}
            </Button>
            <Button onClick={handleCreateRoom} disabled={!newRoomName.trim()}>
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Start Dialog */}
      <CallStartDialog
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
        mediaType={callMediaType}
        targetUserIds={
          selectedChat?.type === 'direct' && !isBrainAIUser(selectedChat.id) && !isAIPersonaUser(selectedChat.id)
            ? [selectedChat.id]
            : undefined
        }
        projectId={selectedChat?.type === 'project' ? selectedChat.id : undefined}
        availableMembers={
          selectedChat?.type === 'project'
            ? users.filter(u => {
                const project = projects.find(p => p.id === selectedChat.id);
                return project?.teamMemberIds?.includes(u.id);
              })
            : undefined
        }
      />
    </div>
  );
}
