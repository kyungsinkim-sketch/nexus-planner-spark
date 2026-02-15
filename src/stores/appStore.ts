import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Project, CalendarEvent, ChatMessage, ChatRoom, ChatMessageType, LocationShare, ScheduleShare, DecisionShare, FileGroup, FileItem, PerformanceSnapshot, PortfolioItem, PeerFeedback, ProjectContribution, ScoreSettings, UserWorkStatus, PersonalTodo } from '@/types/core';
import { mockUsers, mockProjects, mockEvents, mockMessages, mockFileGroups, mockFiles, mockPerformanceSnapshots, mockPortfolioItems, mockPeerFeedback, mockProjectContributions, mockPersonalTodos, currentUser } from '@/mock/data';
import { Language } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as projectService from '@/services/projectService';
import * as eventService from '@/services/eventService';
import * as authService from '@/services/authService';
import * as chatService from '@/services/chatService';
import * as todoService from '@/services/todoService';
import * as fileService from '@/services/fileService';

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;

  // Data
  users: User[];
  projects: Project[];
  events: CalendarEvent[];
  messages: ChatMessage[];
  chatRooms: ChatRoom[];
  fileGroups: FileGroup[];
  files: FileItem[];
  performanceSnapshots: PerformanceSnapshot[];
  portfolioItems: PortfolioItem[];
  peerFeedback: PeerFeedback[];
  projectContributions: ProjectContribution[];
  personalTodos: PersonalTodo[];
  scoreSettings: ScoreSettings;

  // User Work Status
  userWorkStatus: UserWorkStatus;

  // Language
  language: Language;

  // Theme
  theme: 'light' | 'dark';

  // UI State
  selectedProjectId: string | null;
  sidebarCollapsed: boolean;

  // Auth Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  initializeAuth: () => Promise<void>;

  // Data Loading Actions
  loadProjects: () => Promise<void>;
  loadEvents: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loadTodos: () => Promise<void>;
  loadFileGroups: (projectId: string) => Promise<void>;

  // UI Actions
  setSelectedProject: (projectId: string | null) => void;
  toggleSidebar: () => void;
  setUserWorkStatus: (status: UserWorkStatus) => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;

  // Project Actions
  addProject: (project: Partial<Project>) => Promise<void>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;

  // Event Actions
  addEvent: (event: Partial<CalendarEvent>) => Promise<void>;
  updateEvent: (eventId: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;

  // Message Actions
  addMessage: (message: ChatMessage) => void;
  sendProjectMessage: (projectId: string, content: string) => Promise<void>;
  sendDirectMessage: (toUserId: string, content: string) => Promise<void>;

  // Chat Room Actions
  loadChatRooms: (projectId: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  loadRoomMessages: (roomId: string) => Promise<void>;
  createChatRoom: (projectId: string, name: string, memberIds: string[], description?: string) => Promise<ChatRoom | null>;
  sendRoomMessage: (roomId: string, projectId: string, content: string, options?: {
    messageType?: ChatMessageType;
    locationData?: LocationShare;
    scheduleData?: ScheduleShare;
    decisionData?: DecisionShare;
  }) => Promise<void>;

  // File Actions
  addFileGroup: (fileGroup: FileGroup) => void;
  addFile: (file: FileItem) => void;
  createFileGroup: (fileGroup: Partial<FileGroup>) => Promise<void>;
  uploadFile: (file: File, projectId: string, fileGroupId: string) => Promise<void>;
  deleteFileItem: (fileId: string) => Promise<void>;

  // Todo Actions
  addTodo: (todo: Partial<PersonalTodo>) => Promise<void>;
  updateTodo: (todoId: string, updates: Partial<PersonalTodo>) => Promise<void>;
  deleteTodo: (todoId: string) => Promise<void>;
  completeTodo: (todoId: string) => Promise<void>;

  // Settings Actions
  updateScoreSettings: (settings: Partial<ScoreSettings>) => void;

  // Getters
  getProjectById: (id: string) => Project | undefined;
  getEventsByProject: (projectId: string) => CalendarEvent[];
  getMessagesByProject: (projectId: string) => ChatMessage[];
  getMessagesByRoom: (roomId: string) => ChatMessage[];
  getChatRoomsByProject: (projectId: string) => ChatRoom[];
  getFileGroupsByProject: (projectId: string) => FileGroup[];
  getFilesByGroup: (groupId: string) => FileItem[];
  getUserById: (id: string) => User | undefined;
  getPerformanceByUser: (userId: string) => PerformanceSnapshot[];
  getPortfolioByUser: (userId: string) => PortfolioItem[];
  getFeedbackByProject: (projectId: string) => PeerFeedback[];
  getContributionsByProject: (projectId: string) => ProjectContribution[];
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state - always start unauthenticated (login required)
      currentUser: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: true,
      users: isSupabaseConfigured() ? [] : mockUsers,
      projects: isSupabaseConfigured() ? [] : mockProjects,
      events: isSupabaseConfigured() ? [] : mockEvents,
      messages: isSupabaseConfigured() ? [] : mockMessages,
      chatRooms: [],
      fileGroups: isSupabaseConfigured() ? [] : mockFileGroups,
      files: isSupabaseConfigured() ? [] : mockFiles,
      performanceSnapshots: isSupabaseConfigured() ? [] : mockPerformanceSnapshots,
      portfolioItems: isSupabaseConfigured() ? [] : mockPortfolioItems,
      peerFeedback: isSupabaseConfigured() ? [] : mockPeerFeedback,
      projectContributions: isSupabaseConfigured() ? [] : mockProjectContributions,
      personalTodos: isSupabaseConfigured() ? [] : mockPersonalTodos,
      scoreSettings: { financialWeight: 70, peerWeight: 30 },
      userWorkStatus: 'NOT_AT_WORK',
      language: 'ko',
      theme: 'light',
      selectedProjectId: null,
      sidebarCollapsed: false,

      // Auth Actions
      signIn: async (email: string, password: string) => {
        if (!isSupabaseConfigured()) {
          throw new Error('Supabase not configured');
        }

        set({ isLoading: true });
        try {
          const user = await authService.signIn(email, password);
          set({ currentUser: user, isAuthenticated: true });

          // Load user data
          await get().loadProjects();
          await get().loadEvents();
          await get().loadUsers();
          await get().loadMessages();
        } finally {
          set({ isLoading: false });
        }
      },

      signUp: async (email: string, password: string, name: string) => {
        if (!isSupabaseConfigured()) {
          throw new Error('Supabase not configured');
        }

        set({ isLoading: true });
        try {
          const user = await authService.signUp(email, password, name);
          set({ currentUser: user, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      signOut: async () => {
        if (!isSupabaseConfigured()) {
          set({ currentUser: null, isAuthenticated: false, userWorkStatus: 'NOT_AT_WORK' });
          return;
        }

        try {
          await authService.signOut();
        } catch (error) {
          console.error('Failed to sign out:', error);
        } finally {
          // Always clear local state even if API call fails
          set({
            currentUser: null,
            isAuthenticated: false,
            projects: [],
            events: [],
            messages: [],
          });
        }
      },

      setCurrentUser: (user: User | null) => {
        set({ currentUser: user, isAuthenticated: !!user });
      },

      initializeAuth: async () => {
        if (!isSupabaseConfigured()) {
          set({ isInitializing: false });
          return;
        }

        set({ isInitializing: true });
        try {
          const user = await authService.getCurrentUser();
          if (user) {
            set({ currentUser: user, isAuthenticated: true });
            await get().loadProjects();
            await get().loadEvents();
            await get().loadUsers();
            await get().loadMessages();
          }
        } finally {
          set({ isInitializing: false });
        }
      },

      // Data Loading Actions
      loadProjects: async () => {
        if (!isSupabaseConfigured()) {
          return;
        }

        try {
          const projects = await projectService.getProjects();
          set({ projects });
        } catch (error) {
          console.error('Failed to load projects:', error);
        }
      },

      loadEvents: async () => {
        if (!isSupabaseConfigured()) {
          return;
        }

        try {
          const events = await eventService.getEvents();
          set({ events });
        } catch (error) {
          console.error('Failed to load events:', error);
        }
      },

      loadUsers: async () => {
        if (!isSupabaseConfigured()) {
          return;
        }

        try {
          const users = await authService.getAllUsers();
          set({ users });
        } catch (error) {
          console.error('Failed to load users:', error);
        }
      },

      loadMessages: async () => {
        if (!isSupabaseConfigured()) {
          return;
        }

        const { currentUser } = get();
        if (!currentUser) return;

        try {
          // Load recent conversations to get initial messages
          const conversations = await chatService.getRecentConversations(currentUser.id);
          const allMessages: ChatMessage[] = [];

          // Load project messages for each conversation
          for (const chat of conversations.projectChats) {
            try {
              const msgs = await chatService.getMessagesByProject(chat.projectId);
              allMessages.push(...msgs);
            } catch (e) {
              console.error(`Failed to load messages for project ${chat.projectId}:`, e);
            }
          }

          // Load direct messages
          for (const chat of conversations.directChats) {
            try {
              const msgs = await chatService.getDirectMessages(currentUser.id, chat.userId);
              allMessages.push(...msgs);
            } catch (e) {
              console.error(`Failed to load direct messages with ${chat.userId}:`, e);
            }
          }

          // Deduplicate by id
          const uniqueMessages = Array.from(
            new Map(allMessages.map(m => [m.id, m])).values()
          );

          set({ messages: uniqueMessages });
        } catch (error) {
          console.error('Failed to load messages:', error);
        }
      },

      loadTodos: async () => {
        if (!isSupabaseConfigured()) {
          return;
        }

        try {
          const todos = await todoService.getTodos();
          set({ personalTodos: todos });
        } catch (error) {
          console.error('Failed to load todos:', error);
        }
      },

      loadFileGroups: async (projectId: string) => {
        if (!isSupabaseConfigured()) {
          return;
        }

        try {
          const groups = await fileService.getFileGroupsByProject(projectId);

          // Merge with existing groups instead of replacing
          set((state) => {
            const otherGroups = state.fileGroups.filter(fg => fg.projectId !== projectId);
            return { fileGroups: [...otherGroups, ...groups] };
          });

          // Load files for each group
          const newFiles: FileItem[] = [];
          for (const group of groups) {
            const files = await fileService.getFilesByGroup(group.id);
            newFiles.push(...files);
          }

          // Merge with existing files instead of replacing
          const groupIds = new Set(groups.map(g => g.id));
          set((state) => {
            const otherFiles = state.files.filter(f => !groupIds.has(f.fileGroupId));
            return { files: [...otherFiles, ...newFiles] };
          });
        } catch (error) {
          console.error('Failed to load file groups:', error);
        }
      },

      // UI Actions
      setSelectedProject: (projectId) => set({ selectedProjectId: projectId }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setUserWorkStatus: async (status) => {
        set({ userWorkStatus: status });

        const { currentUser } = get();
        if (currentUser && isSupabaseConfigured()) {
          try {
            await authService.updateWorkStatus(currentUser.id, status);
          } catch (error) {
            console.error('Failed to update work status:', error);
          }
        }
      },

      setLanguage: (lang) => set({ language: lang }),
      setTheme: (theme) => {
        set({ theme });
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
      toggleTheme: () => {
        const current = get().theme;
        const next = current === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },

      // Project Actions
      addProject: async (project) => {
        if (isSupabaseConfigured()) {
          try {
            const newProject = await projectService.createProject(project);
            set((state) => ({ projects: [...state.projects, newProject] }));
          } catch (error) {
            console.error('Failed to create project:', error);
            throw error;
          }
        } else {
          // Mock mode
          const newProject: Project = {
            id: `p${Date.now()}`,
            title: project.title || '',
            client: project.client || '',
            status: project.status || 'ACTIVE',
            startDate: project.startDate || new Date().toISOString(),
            endDate: project.endDate || new Date().toISOString(),
            ...project,
          };
          set((state) => ({ projects: [...state.projects, newProject] }));
        }
      },

      updateProject: async (projectId, updates) => {
        if (isSupabaseConfigured()) {
          try {
            const updatedProject = await projectService.updateProject(projectId, updates);
            set((state) => ({
              projects: state.projects.map((p) =>
                p.id === projectId ? updatedProject : p
              ),
            }));
          } catch (error) {
            console.error('Failed to update project:', error);
            throw error;
          }
        } else {
          // Mock mode
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === projectId ? { ...p, ...updates } : p
            ),
          }));
        }
      },

      deleteProject: async (projectId) => {
        if (isSupabaseConfigured()) {
          try {
            await projectService.deleteProject(projectId);
            set((state) => ({
              projects: state.projects.filter((p) => p.id !== projectId),
            }));
          } catch (error) {
            console.error('Failed to delete project:', error);
            throw error;
          }
        } else {
          // Mock mode
          set((state) => ({
            projects: state.projects.filter((p) => p.id !== projectId),
          }));
        }
      },

      // Event Actions
      addEvent: async (event) => {
        if (isSupabaseConfigured()) {
          try {
            const newEvent = await eventService.createEvent(event);
            set((state) => ({ events: [...state.events, newEvent] }));
          } catch (error) {
            console.error('Failed to create event:', error);
            throw error;
          }
        } else {
          // Mock mode
          const newEvent: CalendarEvent = {
            id: `e${Date.now()}`,
            title: event.title || '',
            type: event.type || 'TASK',
            startAt: event.startAt || new Date().toISOString(),
            endAt: event.endAt || new Date().toISOString(),
            ownerId: event.ownerId || get().currentUser?.id || '',
            source: event.source || 'PAULUS',
            ...event,
          };
          set((state) => ({ events: [...state.events, newEvent] }));
        }
      },

      updateEvent: async (eventId, updates) => {
        if (isSupabaseConfigured()) {
          try {
            const updatedEvent = await eventService.updateEvent(eventId, updates);
            set((state) => ({
              events: state.events.map((e) =>
                e.id === eventId ? updatedEvent : e
              ),
            }));
          } catch (error) {
            console.error('Failed to update event:', error);
            throw error;
          }
        } else {
          // Mock mode
          set((state) => ({
            events: state.events.map((e) =>
              e.id === eventId ? { ...e, ...updates } : e
            ),
          }));
        }
      },

      deleteEvent: async (eventId) => {
        if (isSupabaseConfigured()) {
          try {
            await eventService.deleteEvent(eventId);
            set((state) => ({
              events: state.events.filter((e) => e.id !== eventId),
            }));
          } catch (error) {
            console.error('Failed to delete event:', error);
            throw error;
          }
        } else {
          // Mock mode
          set((state) => ({
            events: state.events.filter((e) => e.id !== eventId),
          }));
        }
      },

      // Message Actions
      addMessage: (message) => set((state) => {
        // Prevent duplicate messages (realtime subscription + local add race condition)
        if (state.messages.some(m => m.id === message.id)) return state;
        return { messages: [...state.messages, message] };
      }),

      sendProjectMessage: async (projectId, content) => {
        const { currentUser } = get();
        if (!currentUser) return;

        if (isSupabaseConfigured()) {
          try {
            const message = await chatService.sendProjectMessage(projectId, currentUser.id, content);
            set((state) => ({ messages: [...state.messages, message] }));
          } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
          }
        } else {
          // Mock mode
          const message: ChatMessage = {
            id: `m${Date.now()}`,
            projectId,
            userId: currentUser.id,
            content,
            createdAt: new Date().toISOString(),
            messageType: 'text',
          };
          set((state) => ({ messages: [...state.messages, message] }));
        }
      },

      sendDirectMessage: async (toUserId, content) => {
        const { currentUser } = get();
        if (!currentUser) return;

        if (isSupabaseConfigured()) {
          try {
            const message = await chatService.sendDirectMessage(currentUser.id, toUserId, content);
            set((state) => ({ messages: [...state.messages, message] }));
          } catch (error) {
            console.error('Failed to send direct message:', error);
            throw error;
          }
        } else {
          // Mock mode
          const message: ChatMessage = {
            id: `m${Date.now()}`,
            projectId: '',
            userId: currentUser.id,
            content,
            createdAt: new Date().toISOString(),
            directChatUserId: toUserId,
            messageType: 'text',
          };
          set((state) => ({ messages: [...state.messages, message] }));
        }
      },

      // Chat Room Actions
      loadChatRooms: async (projectId) => {
        if (isSupabaseConfigured()) {
          try {
            const rooms = await chatService.getRoomsByProject(projectId);
            set((state) => {
              const otherRooms = state.chatRooms.filter(r => r.projectId !== projectId);
              return { chatRooms: [...otherRooms, ...rooms] };
            });

            // Also load messages for all rooms in this project
            for (const room of rooms) {
              try {
                const msgs = await chatService.getMessagesByRoom(room.id);
                set((state) => {
                  // Merge with existing messages, avoiding duplicates
                  const existingIds = new Set(state.messages.map(m => m.id));
                  const newMsgs = msgs.filter(m => !existingIds.has(m.id));
                  return { messages: [...state.messages, ...newMsgs] };
                });
              } catch (e) {
                console.error(`Failed to load messages for room ${room.id}:`, e);
              }
            }
          } catch (error) {
            console.error('Failed to load chat rooms:', error);
          }
        } else {
          // Mock mode: create a default room for the project if none exists
          set((state) => {
            const existing = state.chatRooms.filter(r => r.projectId === projectId);
            if (existing.length === 0) {
              const defaultRoom: ChatRoom = {
                id: `room-default-${projectId}`,
                projectId,
                name: '전체',
                isDefault: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              return { chatRooms: [...state.chatRooms, defaultRoom] };
            }
            return state;
          });
        }
      },

      loadRoomMessages: async (roomId) => {
        if (!isSupabaseConfigured()) return;

        try {
          const msgs = await chatService.getMessagesByRoom(roomId);
          set((state) => {
            const existingIds = new Set(state.messages.map(m => m.id));
            const newMsgs = msgs.filter(m => !existingIds.has(m.id));
            return { messages: [...state.messages, ...newMsgs] };
          });
        } catch (error) {
          console.error(`Failed to load room messages:`, error);
        }
      },

      createChatRoom: async (projectId, name, memberIds, description) => {
        const { currentUser } = get();
        if (!currentUser) return null;

        if (isSupabaseConfigured()) {
          try {
            const room = await chatService.createRoom(projectId, name, currentUser.id, description, memberIds);
            set((state) => ({ chatRooms: [...state.chatRooms, room] }));
            return room;
          } catch (error) {
            console.error('Failed to create chat room:', error);
            return null;
          }
        } else {
          // Mock mode
          const room: ChatRoom = {
            id: `room-${Date.now()}`,
            projectId,
            name,
            description,
            isDefault: false,
            createdBy: currentUser.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({ chatRooms: [...state.chatRooms, room] }));
          return room;
        }
      },

      sendRoomMessage: async (roomId, projectId, content, options) => {
        const { currentUser } = get();
        if (!currentUser) return;

        if (isSupabaseConfigured()) {
          try {
            const message = await chatService.sendRoomMessage(roomId, projectId, currentUser.id, content, options);
            set((state) => ({ messages: [...state.messages, message] }));
          } catch (error) {
            console.error('Failed to send room message:', error);
            throw error;
          }
        } else {
          // Mock mode
          const message: ChatMessage = {
            id: `m${Date.now()}`,
            projectId,
            userId: currentUser.id,
            content,
            createdAt: new Date().toISOString(),
            roomId,
            messageType: options?.messageType || 'text',
            locationData: options?.locationData,
            scheduleData: options?.scheduleData,
            decisionData: options?.decisionData,
          };
          set((state) => ({ messages: [...state.messages, message] }));
        }
      },

      // File Actions
      addFileGroup: (fileGroup) => set((state) => ({ fileGroups: [...state.fileGroups, fileGroup] })),
      addFile: (file) => set((state) => ({ files: [...state.files, file] })),

      createFileGroup: async (fileGroup) => {
        if (isSupabaseConfigured()) {
          try {
            const newGroup = await fileService.createFileGroup(fileGroup);
            set((state) => ({ fileGroups: [...state.fileGroups, newGroup] }));
          } catch (error) {
            console.error('Failed to create file group:', error);
            throw error;
          }
        } else {
          // Mock mode
          const newGroup: FileGroup = {
            id: `fg${Date.now()}`,
            projectId: fileGroup.projectId!,
            category: fileGroup.category!,
            title: fileGroup.title!,
          };
          set((state) => ({ fileGroups: [...state.fileGroups, newGroup] }));
        }
      },

      uploadFile: async (file, projectId, fileGroupId) => {
        const { currentUser } = get();
        if (!currentUser) return;

        if (isSupabaseConfigured()) {
          try {
            const { path, url } = await fileService.uploadFile(file, projectId, currentUser.id);
            const fileItem = await fileService.createFileItem({
              fileGroupId,
              name: file.name,
              uploadedBy: currentUser.id,
              size: `${(file.size / 1024).toFixed(2)} KB`,
              type: file.type,
            });
            set((state) => ({ files: [...state.files, fileItem] }));
          } catch (error) {
            console.error('Failed to upload file:', error);
            throw error;
          }
        } else {
          // Mock mode
          const newFile: FileItem = {
            id: `f${Date.now()}`,
            fileGroupId,
            name: file.name,
            uploadedBy: currentUser.id,
            createdAt: new Date().toISOString(),
            size: `${(file.size / 1024).toFixed(2)} KB`,
            type: file.type,
          };
          set((state) => ({ files: [...state.files, newFile] }));
        }
      },

      deleteFileItem: async (fileId) => {
        if (isSupabaseConfigured()) {
          try {
            await fileService.deleteFileItem(fileId);
            set((state) => ({
              files: state.files.filter((f) => f.id !== fileId),
            }));
          } catch (error) {
            console.error('Failed to delete file:', error);
            throw error;
          }
        } else {
          // Mock mode
          set((state) => ({
            files: state.files.filter((f) => f.id !== fileId),
          }));
        }
      },

      // Todo Actions
      addTodo: async (todo) => {
        const { currentUser } = get();
        if (!currentUser) return;

        if (isSupabaseConfigured()) {
          try {
            const newTodo = await todoService.createTodo({
              ...todo,
              requestedById: todo.requestedById || currentUser.id,
            });
            set((state) => ({ personalTodos: [...state.personalTodos, newTodo] }));
          } catch (error) {
            console.error('Failed to create todo:', error);
            throw error;
          }
        } else {
          // Mock mode
          const newTodo: PersonalTodo = {
            id: `td${Date.now()}`,
            title: todo.title!,
            assigneeIds: todo.assigneeIds || [currentUser.id],
            requestedById: todo.requestedById || currentUser.id,
            projectId: todo.projectId,
            dueDate: todo.dueDate!,
            priority: todo.priority || 'NORMAL',
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };
          set((state) => ({ personalTodos: [...state.personalTodos, newTodo] }));
        }
      },

      updateTodo: async (todoId, updates) => {
        if (isSupabaseConfigured()) {
          try {
            const updatedTodo = await todoService.updateTodo(todoId, updates);
            set((state) => ({
              personalTodos: state.personalTodos.map((t) =>
                t.id === todoId ? updatedTodo : t
              ),
            }));
          } catch (error) {
            console.error('Failed to update todo:', error);
            throw error;
          }
        } else {
          // Mock mode
          set((state) => ({
            personalTodos: state.personalTodos.map((t) =>
              t.id === todoId ? { ...t, ...updates } : t
            ),
          }));
        }
      },

      deleteTodo: async (todoId) => {
        if (isSupabaseConfigured()) {
          try {
            await todoService.deleteTodo(todoId);
            set((state) => ({
              personalTodos: state.personalTodos.filter((t) => t.id !== todoId),
            }));
          } catch (error) {
            console.error('Failed to delete todo:', error);
            throw error;
          }
        } else {
          // Mock mode
          set((state) => ({
            personalTodos: state.personalTodos.filter((t) => t.id !== todoId),
          }));
        }
      },

      completeTodo: async (todoId) => {
        if (isSupabaseConfigured()) {
          try {
            const completedTodo = await todoService.completeTodo(todoId);
            set((state) => ({
              personalTodos: state.personalTodos.map((t) =>
                t.id === todoId ? completedTodo : t
              ),
            }));
          } catch (error) {
            console.error('Failed to complete todo:', error);
            throw error;
          }
        } else {
          // Mock mode
          set((state) => ({
            personalTodos: state.personalTodos.map((t) =>
              t.id === todoId ? { ...t, status: 'COMPLETED' as const, completedAt: new Date().toISOString() } : t
            ),
          }));
        }
      },

      // Settings Actions
      updateScoreSettings: (settings) => set((state) => ({
        scoreSettings: { ...state.scoreSettings, ...settings }
      })),

      // Getters
      getProjectById: (id) => get().projects.find((p) => p.id === id),
      getEventsByProject: (projectId) => get().events.filter((e) => e.projectId === projectId),
      getMessagesByProject: (projectId) => get().messages.filter((m) => m.projectId === projectId),
      getMessagesByRoom: (roomId) => get().messages.filter((m) => m.roomId === roomId),
      getChatRoomsByProject: (projectId) => get().chatRooms.filter((r) => r.projectId === projectId),
      getFileGroupsByProject: (projectId) => get().fileGroups.filter((fg) => fg.projectId === projectId),
      getFilesByGroup: (groupId) => get().files.filter((f) => f.fileGroupId === groupId),
      getUserById: (id) => get().users.find((u) => u.id === id),
      getPerformanceByUser: (userId) => get().performanceSnapshots.filter((ps) => ps.userId === userId),
      getPortfolioByUser: (userId) => get().portfolioItems.filter((pi) => pi.userId === userId),
      getFeedbackByProject: (projectId) => get().peerFeedback.filter((f) => f.projectId === projectId),
      getContributionsByProject: (projectId) => get().projectContributions.filter((c) => c.projectId === projectId),
    }),
    {
      name: 're-be-storage',
      partialize: (state) => ({
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed,
        userWorkStatus: state.userWorkStatus,
      }),
    }
  )
);
