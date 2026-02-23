import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Project, CalendarEvent, ChatMessage, ChatRoom, ChatMessageType, LocationShare, ScheduleShare, DecisionShare, FileGroup, FileItem, PerformanceSnapshot, PortfolioItem, PeerFeedback, ProjectContribution, ScoreSettings, UserWorkStatus, PersonalTodo, ImportantNote, InspirationQuote, CompanyNotification, GmailMessage, EmailBrainSuggestion, BrainNotification, BrainReport, BrainFeedback, BrainExtractedEvent, BrainExtractedTodo, VoiceRecording, RecordingMetadata, AppNotification, BoardGroup, BoardTask, BoardTaskStatus, extractEmailDomain, isFreelancerDomain } from '@/types/core';
import { mockUsers, mockProjects, mockEvents, mockMessages, mockFileGroups, mockFiles, mockPerformanceSnapshots, mockPortfolioItems, mockPeerFeedback, mockProjectContributions, mockPersonalTodos, currentUser } from '@/mock/data';
import * as gmailService from '@/services/gmailService';
import * as audioService from '@/services/audioService';
import { Language, getTranslation } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as projectService from '@/services/projectService';
import * as eventService from '@/services/eventService';
import * as authService from '@/services/authService';
import * as chatService from '@/services/chatService';
import * as todoService from '@/services/todoService';
import * as fileService from '@/services/fileService';
import * as boardService from '@/services/boardService';
import { playNotificationSound } from '@/services/notificationSoundService';
import { useWidgetStore } from '@/stores/widgetStore';

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
  importantNotes: ImportantNote[];
  inspirationQuotes: InspirationQuote[];
  companyNotifications: CompanyNotification[];
  scoreSettings: ScoreSettings;

  // User Work Status
  userWorkStatus: UserWorkStatus;

  // Language
  language: Language;

  // Theme
  theme: 'light' | 'dark';

  // Brain AI
  brainIntelligenceEnabled: boolean;

  // Widget Settings (persisted per-widget configuration)
  widgetSettings: Record<string, Record<string, unknown>>;
  todoCreateDialogOpen: boolean;
  projectCreateDialogOpen: boolean;
  importantNoteAddOpen: boolean;
  projectSearchOpen: boolean;
  showAutoCheckInDialog: boolean;
  autoCheckInPosition: { latitude: number; longitude: number; address?: string } | null;
  worldClockSettingsOpen: boolean;
  weatherSettingsOpen: boolean;

  // Currently active/open chat context — used to suppress notifications for visible chat
  activeChatContext: { type: 'project' | 'direct'; id: string; roomId?: string } | null;

  // Pending chat navigation target — set by notification click, consumed by ChatPanel
  pendingChatNavigation: { type: 'project' | 'direct'; id: string; roomId?: string } | null;

  // Notification Sound
  notificationSoundEnabled: boolean;

  // Notification dismiss state — shared across all notification widget instances
  dismissedNotificationIds: string[];

  // Gmail + Brain Email Analysis
  gmailMessages: GmailMessage[];
  emailSuggestions: EmailBrainSuggestion[];
  gmailLastSyncAt: string | null;
  gmailSyncing: boolean;

  // Brain AI Notifications, Reports & Feedback
  brainNotifications: BrainNotification[];
  brainReports: BrainReport[];
  brainFeedback: BrainFeedback[];

  // Voice Recordings (Voice-to-Brain)
  voiceRecordings: VoiceRecording[];

  // Global App Notifications (unified notification center)
  appNotifications: AppNotification[];

  // Track locally-trashed Gmail message IDs so they don't reappear on sync
  // (server-side trash requires gmail.modify scope which may not be granted yet)
  trashedGmailMessageIds: string[];

  // Board Tasks (Project Board Widget)
  boardGroups: BoardGroup[];
  boardTasks: BoardTask[];

  // Mock data persistence — track deleted mock event IDs across refreshes
  deletedMockEventIds: string[];

  // UI State
  selectedProjectId: string | null;
  sidebarCollapsed: boolean;
  chatPanelCollapsed: boolean;

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

  // Board Task Actions
  loadBoardData: (projectId: string) => Promise<void>;
  addBoardGroup: (projectId: string, title: string, color?: string) => Promise<void>;
  updateBoardGroup: (groupId: string, updates: { title?: string; color?: string; orderNo?: number }) => Promise<void>;
  deleteBoardGroup: (groupId: string) => Promise<void>;
  addBoardTask: (task: { boardGroupId: string; projectId: string; title: string; ownerId: string; status?: BoardTaskStatus; startDate?: string; endDate?: string; dueDate?: string }) => Promise<void>;
  updateBoardTask: (taskId: string, updates: Partial<{ title: string; status: BoardTaskStatus; ownerId: string; reviewerIds: string[]; startDate: string | null; endDate: string | null; dueDate: string | null; progress: number; boardGroupId: string }>) => Promise<void>;
  deleteBoardTask: (taskId: string) => Promise<void>;

  // UI Actions
  setSelectedProject: (projectId: string | null) => void;
  toggleSidebar: () => void;
  toggleChatPanel: () => void;
  setChatPanelCollapsed: (collapsed: boolean) => void;
  setUserWorkStatus: (status: UserWorkStatus) => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setBrainIntelligenceEnabled: (enabled: boolean) => void;
  updateWidgetSettings: (widgetType: string, settings: Record<string, unknown>) => void;
  setTodoCreateDialogOpen: (open: boolean) => void;
  setProjectCreateDialogOpen: (open: boolean) => void;
  setImportantNoteAddOpen: (open: boolean) => void;
  setProjectSearchOpen: (open: boolean) => void;
  setShowAutoCheckInDialog: (open: boolean) => void;
  setActiveChatContext: (ctx: { type: 'project' | 'direct'; id: string; roomId?: string } | null) => void;
  setPendingChatNavigation: (nav: { type: 'project' | 'direct'; id: string; roomId?: string } | null) => void;
  setWorldClockSettingsOpen: (open: boolean) => void;
  setWeatherSettingsOpen: (open: boolean) => void;
  setNotificationSoundEnabled: (enabled: boolean) => void;
  dismissNotification: (id: string) => void;
  dismissAllNotifications: (ids: string[]) => void;

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
  deleteMessage: (messageId: string) => Promise<void>;
  sendProjectMessage: (projectId: string, content: string, attachmentId?: string) => Promise<void>;
  sendDirectMessage: (toUserId: string, content: string, attachmentId?: string) => Promise<void>;

  // Chat Room Actions
  loadChatRooms: (projectId: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  loadRoomMessages: (roomId: string) => Promise<void>;
  createChatRoom: (projectId: string, name: string, memberIds: string[], description?: string) => Promise<ChatRoom | null>;
  sendRoomMessage: (roomId: string, projectId: string, content: string, options?: {
    attachmentId?: string;
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
  updateFileItem: (fileId: string, updates: Partial<FileItem>) => Promise<void>;
  deleteFileItem: (fileId: string) => Promise<void>;

  // Todo Actions
  addTodo: (todo: Partial<PersonalTodo>) => Promise<void>;
  updateTodo: (todoId: string, updates: Partial<PersonalTodo>) => Promise<void>;
  deleteTodo: (todoId: string) => Promise<void>;
  completeTodo: (todoId: string) => Promise<void>;

  // Important Notes Actions
  loadImportantNotes: () => Promise<void>;
  addImportantNote: (note: Omit<ImportantNote, 'id' | 'createdAt'>) => Promise<void>;
  removeImportantNote: (noteId: string) => Promise<void>;
  getImportantNotesByProject: (projectId: string) => ImportantNote[];

  // Inspiration Quotes Actions
  addQuote: (quote: Omit<InspirationQuote, 'id'>) => void;
  updateQuote: (id: string, updates: Partial<InspirationQuote>) => void;
  removeQuote: (id: string) => void;

  // Company Notification Actions
  broadcastNotification: (title: string, message: string) => void;
  dismissCompanyNotification: (id: string) => void;

  // Gmail + Brain Email Actions
  syncGmail: (forceFullSync?: boolean) => Promise<void>;
  trashEmail: (messageId: string) => Promise<void>;
  markEmailAsRead: (messageId: string) => Promise<void>;
  analyzeEmail: (messageId: string) => Promise<void>;
  confirmEmailSuggestion: (suggestionId: string) => Promise<void>;
  rejectEmailSuggestion: (suggestionId: string) => void;
  sendEmailReply: (suggestionId: string, editedBody?: string) => Promise<void>;
  composeEmail: (to: string, subject: string, body: string) => Promise<{ success: boolean; error?: string }>;
  replyToEmail: (messageId: string, body: string) => Promise<{ success: boolean; error?: string }>;

  // Voice Recording Actions
  startVoiceRecording: (blob: Blob, metadata: RecordingMetadata) => Promise<void>;
  uploadVoiceFile: (file: File, metadata: RecordingMetadata) => Promise<void>;
  updateVoiceRecording: (id: string, updates: Partial<VoiceRecording>) => void;

  // Brain AI Notification & Report Actions
  addBrainNotification: (notification: Omit<BrainNotification, 'id' | 'createdAt'>) => void;
  addBrainReport: (report: Omit<BrainReport, 'id' | 'createdAt' | 'status'>) => void;
  updateBrainReportStatus: (reportId: string, status: BrainReport['status'], adminNote?: string) => void;
  addBrainFeedback: (feedback: Omit<BrainFeedback, 'id' | 'createdAt'>) => void;
  confirmEmailSuggestionWithEdits: (
    suggestionId: string,
    edits: {
      event?: BrainExtractedEvent;
      todo?: BrainExtractedTodo;
      note?: string;
      includeEvent: boolean;
      includeTodo: boolean;
      includeNote: boolean;
    },
  ) => Promise<void>;

  // App Notification Actions
  addAppNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markAppNotificationRead: (id: string) => void;
  markAllAppNotificationsRead: () => void;
  clearAppNotifications: () => void;
  clearChatNotificationsForRoom: (roomId?: string, projectId?: string, directUserId?: string) => void;
  getUnreadAppNotificationCount: () => number;

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

/**
 * Detect whether a chat message should be auto-extracted as an Important Note.
 * Keywords: '중요한', '기억해', '기억해주세요', '잊지마', '잊지 마', '꼭 기억', 'important', 'remember'
 * EXCEPT: if the message matches '~해주세요' action-request pattern → goes to todos instead
 */
const IMPORTANT_KEYWORDS = ['중요한', '기억해', '기억해주세요', '잊지마', '잊지 마', '꼭 기억', 'important', 'remember this', '꼭 참고'];

function shouldExtractAsImportantNote(content: string): boolean {
  const text = content.toLowerCase();
  // Action requests go to todos, not important notes
  // Pattern: ends with verb + 해주세요 (e.g., 확인해주세요, 수정해주세요, 보내주세요)
  if (/[가-힣]+해\s*주세요/.test(content) && !text.includes('기억해')) return false;
  // Check for important note keywords
  return IMPORTANT_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * Extract individual note items from a multi-line message.
 * Splits by lines starting with -, •, *, or numbered prefixes (1., 2., etc.)
 * If no bullet items found, returns the whole content as a single note.
 */
function extractNoteItems(content: string): string[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  // Separate trigger lines (containing keywords) from content lines
  const bulletItems: string[] = [];
  for (const line of lines) {
    // Strip leading bullet markers: -, •, *, numbered (1., 2.)
    const cleaned = line.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
    if (!cleaned) continue;
    // Skip lines that are just the keyword trigger phrase
    const lowerLine = cleaned.toLowerCase();
    const isOnlyTrigger = IMPORTANT_KEYWORDS.some(kw => {
      // If the line is just the keyword or a short phrase around it, skip it
      const stripped = lowerLine.replace(kw, '').replace(/[*\s,.:;!?아래사항들내용이니중요한기억해주세요]/g, '');
      return stripped.length < 5;
    });
    if (isOnlyTrigger) continue;
    bulletItems.push(cleaned);
  }

  // If we found bullet items, return them individually
  if (bulletItems.length > 0) return bulletItems;
  // Fallback: return the whole content as a single note (strip keyword trigger line)
  return [content.trim()];
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
      importantNotes: [],
      inspirationQuotes: [
        { id: '1', text: "Every line drawn is a step into a new possibility.", author: "Kai Anderson" },
        { id: '2', text: "Design is not just what it looks like. Design is how it works.", author: "Steve Jobs" },
        { id: '3', text: "Creativity is intelligence having fun.", author: "Albert Einstein" },
        { id: '4', text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
        { id: '5', text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
      ],
      companyNotifications: [],
      scoreSettings: { financialWeight: 70, peerWeight: 30 },
      userWorkStatus: 'NOT_AT_WORK',
      language: 'ko',
      theme: 'light',
      brainIntelligenceEnabled: false,
      widgetSettings: {},
      todoCreateDialogOpen: false,
      projectCreateDialogOpen: false,
      importantNoteAddOpen: false,
      projectSearchOpen: false,
      showAutoCheckInDialog: false,
      autoCheckInPosition: null,
      activeChatContext: null,
      pendingChatNavigation: null,
      worldClockSettingsOpen: false,
      weatherSettingsOpen: false,
      notificationSoundEnabled: true,
      dismissedNotificationIds: [],
      gmailMessages: [],
      emailSuggestions: [],
      gmailLastSyncAt: null,
      gmailSyncing: false,
      brainNotifications: [],
      brainReports: [],
      brainFeedback: [],
      voiceRecordings: [],
      appNotifications: [],
      boardGroups: [],
      boardTasks: [],
      trashedGmailMessageIds: [],
      deletedMockEventIds: [],
      selectedProjectId: null,
      sidebarCollapsed: false,
      chatPanelCollapsed: false,

      // Auth Actions
      signIn: async (email: string, password: string) => {
        if (!isSupabaseConfigured()) {
          throw new Error('Supabase not configured');
        }

        set({ isLoading: true });
        try {
          const user = await authService.signIn(email, password);
          set({ currentUser: user, isAuthenticated: true });

          // Load users FIRST so loadProjects can do domain-based filtering
          await get().loadUsers();
          await get().loadProjects();
          await get().loadEvents();
          await get().loadMessages();
          await get().loadTodos();
          await get().loadImportantNotes();
          useWidgetStore.getState().loadLayoutFromDB();
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
            // Load users FIRST so loadProjects can do domain-based filtering
            await get().loadUsers();
            await get().loadProjects();
            await get().loadEvents();
            await get().loadMessages();
            await get().loadTodos();
            await get().loadImportantNotes();
            useWidgetStore.getState().loadLayoutFromDB();
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
          const allProjects = await projectService.getProjects();
          const { currentUser, users: allUsers } = get();
          // ADMIN sees all projects; others only see projects they're a team member of
          // Domain-based sharing: users with same email domain share the project dashboard
          let projects = allProjects;
          if (currentUser && currentUser.role !== 'ADMIN') {
            const userDomain = currentUser.email ? extractEmailDomain(currentUser.email) : '';
            const isFreelancer = !userDomain || isFreelancerDomain(userDomain);

            if (isFreelancer) {
              // Freelancers only see projects where they're explicitly a team member
              projects = allProjects.filter(p => p.teamMemberIds?.includes(currentUser.id));
            } else {
              // Company users: see projects where ANY same-domain user is a team member
              // Always include the current user (their email is always available from auth)
              const sameDomainUserIds = new Set<string>([currentUser.id]);
              // Also add other users with matching domain (if their email is available)
              for (const u of allUsers) {
                if (u.email && extractEmailDomain(u.email) === userDomain) {
                  sameDomainUserIds.add(u.id);
                }
              }
              projects = allProjects.filter(p =>
                p.teamMemberIds?.some(id => sameDomainUserIds.has(id))
              );
            }
          }
          set({ projects });
        } catch (error) {
          console.error('Failed to load projects:', error);
        }
      },

      loadEvents: async () => {
        if (!isSupabaseConfigured()) {
          return;
        }

        // Concurrency guard — prevent multiple simultaneous loadEvents calls
        // which cause AbortError cascades when requests overlap
        const state = get();
        if ((state as unknown as Record<string, boolean>)._loadingEvents) {
          return;
        }
        (state as unknown as Record<string, boolean>)._loadingEvents = true;

        try {
          const events = await eventService.getEvents();
          set({ events });
        } catch (error) {
          // AbortError is expected during rapid navigation/focus changes — suppress
          const msg = (error as Error).message || '';
          if (msg.includes('AbortError') || msg.includes('signal is aborted')) {
            console.warn('[Events] Request aborted (non-fatal, likely rapid refresh)');
          } else {
            console.error('Failed to load events:', error);
          }
        } finally {
          (get() as unknown as Record<string, boolean>)._loadingEvents = false;
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

          // Load ALL files for this project (grouped + chat-uploaded)
          const allProjectFiles = await fileService.getFilesByProject(projectId);

          // Merge: keep files from other projects, replace this project's files
          const allProjectFileIds = new Set(allProjectFiles.map(f => f.id));
          const groupIds = new Set(groups.map(g => g.id));
          set((state) => {
            const otherFiles = state.files.filter(f =>
              !allProjectFileIds.has(f.id) &&
              (!f.fileGroupId || !groupIds.has(f.fileGroupId))
            );
            return { files: [...otherFiles, ...allProjectFiles] };
          });
        } catch (error) {
          console.error('Failed to load file groups:', error);
        }
      },

      // ── Board Task Actions ─────────────────────────────────────

      loadBoardData: async (projectId: string) => {
        if (!isSupabaseConfigured()) {
          // Mock mode: generate default groups if none exist for this project
          const { boardGroups } = get();
          if (!boardGroups.some(g => g.projectId === projectId)) {
            const defaultGroups: BoardGroup[] = [
              { id: `bg-${projectId}-1`, projectId, title: '기획', color: '#0073EA', orderNo: 0, createdAt: new Date().toISOString() },
              { id: `bg-${projectId}-2`, projectId, title: '디자인', color: '#E44258', orderNo: 1, createdAt: new Date().toISOString() },
              { id: `bg-${projectId}-3`, projectId, title: '제작', color: '#FDAB3D', orderNo: 2, createdAt: new Date().toISOString() },
            ];
            set((state) => ({
              boardGroups: [...state.boardGroups, ...defaultGroups],
            }));
          }
          return;
        }

        try {
          const [groups, tasks] = await Promise.all([
            boardService.getBoardGroups(projectId),
            boardService.getBoardTasks(projectId),
          ]);

          set((state) => ({
            boardGroups: [...state.boardGroups.filter(g => g.projectId !== projectId), ...groups],
            boardTasks: [...state.boardTasks.filter(t => t.projectId !== projectId), ...tasks],
          }));
        } catch (error) {
          console.error('Failed to load board data:', error);
        }
      },

      addBoardGroup: async (projectId, title, color) => {
        if (!isSupabaseConfigured()) {
          const newGroup: BoardGroup = {
            id: `bg-${Date.now()}`,
            projectId,
            title,
            color: color || '#0073EA',
            orderNo: get().boardGroups.filter(g => g.projectId === projectId).length,
            createdAt: new Date().toISOString(),
          };
          set((state) => ({ boardGroups: [...state.boardGroups, newGroup] }));
          return;
        }

        try {
          const orderNo = get().boardGroups.filter(g => g.projectId === projectId).length;
          const group = await boardService.createBoardGroup(projectId, title, color || '#0073EA', orderNo);
          set((state) => ({ boardGroups: [...state.boardGroups, group] }));
        } catch (error) {
          console.error('Failed to add board group:', error);
        }
      },

      updateBoardGroup: async (groupId, updates) => {
        // Optimistic update
        set((state) => ({
          boardGroups: state.boardGroups.map(g =>
            g.id === groupId ? { ...g, ...updates } : g
          ),
        }));

        if (!isSupabaseConfigured()) return;

        try {
          await boardService.updateBoardGroup(groupId, updates);
        } catch (error) {
          console.error('Failed to update board group:', error);
        }
      },

      deleteBoardGroup: async (groupId) => {
        set((state) => ({
          boardGroups: state.boardGroups.filter(g => g.id !== groupId),
          boardTasks: state.boardTasks.filter(t => t.boardGroupId !== groupId),
        }));

        if (!isSupabaseConfigured()) return;

        try {
          await boardService.deleteBoardGroup(groupId);
        } catch (error) {
          console.error('Failed to delete board group:', error);
        }
      },

      addBoardTask: async (task) => {
        const currentUser = get().currentUser;
        if (!currentUser) return;

        if (!isSupabaseConfigured()) {
          const newTask: BoardTask = {
            id: `bt-${Date.now()}`,
            boardGroupId: task.boardGroupId,
            projectId: task.projectId,
            title: task.title,
            status: task.status || 'backlog',
            ownerId: task.ownerId,
            reviewerIds: [],
            startDate: task.startDate,
            endDate: task.endDate,
            dueDate: task.dueDate,
            progress: 0,
            orderNo: get().boardTasks.filter(t => t.boardGroupId === task.boardGroupId).length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({ boardTasks: [...state.boardTasks, newTask] }));
          return;
        }

        try {
          const orderNo = get().boardTasks.filter(t => t.boardGroupId === task.boardGroupId).length;
          const created = await boardService.createBoardTask({ ...task, orderNo });
          set((state) => ({ boardTasks: [...state.boardTasks, created] }));
        } catch (error) {
          console.error('Failed to add board task:', error);
        }
      },

      updateBoardTask: async (taskId, updates) => {
        // Optimistic update
        set((state) => ({
          boardTasks: state.boardTasks.map(t =>
            t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        }));

        if (!isSupabaseConfigured()) return;

        try {
          await boardService.updateBoardTask(taskId, updates);
        } catch (error) {
          console.error('Failed to update board task:', error);
        }
      },

      deleteBoardTask: async (taskId) => {
        set((state) => ({
          boardTasks: state.boardTasks.filter(t => t.id !== taskId),
        }));

        if (!isSupabaseConfigured()) return;

        try {
          await boardService.deleteBoardTask(taskId);
        } catch (error) {
          console.error('Failed to delete board task:', error);
        }
      },

      // UI Actions
      setSelectedProject: (projectId) => set({ selectedProjectId: projectId }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleChatPanel: () => set((state) => ({ chatPanelCollapsed: !state.chatPanelCollapsed })),
      setChatPanelCollapsed: (collapsed) => set({ chatPanelCollapsed: collapsed }),

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
      setBrainIntelligenceEnabled: (enabled) => set({ brainIntelligenceEnabled: enabled }),

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

            // Best-effort: push to Google Calendar if connected (non-blocking)
            if (newEvent.source === 'PAULUS' && !newEvent.googleEventId) {
              const { currentUser } = get();
              if (currentUser?.id) {
                import('@/lib/supabase').then(({ supabase: sb }) => {
                  sb.functions.invoke('gcal-push-event', {
                    body: { userId: currentUser.id, eventId: newEvent.id, action: 'create' },
                  }).then(({ data }) => {
                    if (data?.googleEventId) {
                      set((state) => ({
                        events: state.events.map((e) =>
                          e.id === newEvent.id ? { ...e, googleEventId: data.googleEventId } : e
                        ),
                      }));
                    }
                  }).catch(() => { /* non-fatal */ });
                });
              }
            }
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

            // Best-effort: push update to Google Calendar if connected (non-blocking)
            if (updatedEvent.source === 'PAULUS') {
              const { currentUser } = get();
              if (currentUser?.id) {
                import('@/lib/supabase').then(({ supabase: sb }) => {
                  sb.functions.invoke('gcal-push-event', {
                    body: { userId: currentUser.id, eventId, action: 'update' },
                  }).then(({ data }) => {
                    if (data?.googleEventId && !updatedEvent.googleEventId) {
                      set((state) => ({
                        events: state.events.map((e) =>
                          e.id === eventId ? { ...e, googleEventId: data.googleEventId } : e
                        ),
                      }));
                    }
                  }).catch(() => { /* non-fatal */ });
                });
              }
            }
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
            // Check if event is Google-sourced — if so, also delete from Google Calendar
            const event = get().events.find((e) => e.id === eventId);

            await eventService.deleteEvent(eventId);
            set((state) => ({
              events: state.events.filter((e) => e.id !== eventId),
            }));

            // Best-effort sync: delete from Google Calendar if it's a Google event
            if (event?.source === 'GOOGLE' && event.googleEventId) {
              const { currentUser } = get();
              if (currentUser?.id) {
                import('@/services/googleCalendarService').then((gcal) => {
                  gcal.deleteGoogleCalendarEvent(currentUser.id, event.googleEventId!).catch(() => {
                    // Non-fatal: Google event may already be deleted
                  });
                });
              }
            }
          } catch (error) {
            console.error('Failed to delete event:', error);
            throw error;
          }
        } else {
          // Mock mode — also persist the deletion so it survives refresh
          set((state) => ({
            events: state.events.filter((e) => e.id !== eventId),
            deletedMockEventIds: [...state.deletedMockEventIds, eventId],
          }));
        }
      },

      // Message Actions
      addMessage: (message) => {
        const state = get();
        // Prevent duplicate messages (realtime subscription + local add race condition)
        if (state.messages.some(m => m.id === message.id)) return;

        // Check if this message belongs to the currently visible chat
        const ctx = state.activeChatContext;
        const isInActiveChat = ctx && (() => {
          if (ctx.type === 'project') {
            if (ctx.roomId && message.roomId === ctx.roomId) return true;
            if (!ctx.roomId && message.projectId === ctx.id && !message.roomId) return true;
            return false;
          }
          if (ctx.type === 'direct') {
            return message.directChatUserId === ctx.id ||
              (message.userId === ctx.id && message.directChatUserId === state.currentUser?.id);
          }
          return false;
        })();

        // Play notification sound only for messages NOT in the active chat
        if (!isInActiveChat && state.notificationSoundEnabled && state.currentUser && message.userId !== state.currentUser.id) {
          playNotificationSound('message');
        }
        set({ messages: [...state.messages, message] });

        // ALWAYS create app notification for messages from others (even for active chat).
        // This ensures bell-icon notifications are never missed due to race conditions
        // between multiple ChatPanel instances or realtime subscription ordering.
        // For active chat, the notification is immediately cleared below.
        const notifiableTypes = ['text', 'file', 'brain_action', 'persona_response', 'location', 'schedule', 'decision'];
        if (state.currentUser && message.userId !== state.currentUser.id && notifiableTypes.includes(message.messageType || 'text')) {
          const BRAIN_BOT = '00000000-0000-0000-0000-000000000099';
          // Use sender name, or "Brain AI" for bot messages
          const sender = message.userId === BRAIN_BOT
            ? { name: 'Brain AI' }
            : state.users.find(u => u.id === message.userId);
          // Determine preview text based on message type
          let preview = message.content.slice(0, 100);
          if (message.messageType === 'brain_action') {
            const replyMsg = (message.brainActionData as { replyMessage?: string })?.replyMessage;
            preview = replyMsg ? replyMsg.slice(0, 100) : 'Brain AI 응답';
          } else if (message.messageType === 'persona_response') {
            const personaData = message.personaResponseData as { personaName?: string; response?: string } | undefined;
            preview = personaData?.response ? personaData.response.slice(0, 100) : 'AI 페르소나 응답';
          } else if (message.messageType === 'file') {
            preview = '📎 ' + message.content.slice(0, 80);
          }
          get().addAppNotification({
            type: 'chat',
            title: sender?.name || 'New message',
            message: preview,
            projectId: message.projectId || undefined,
            roomId: message.roomId || undefined,
            sourceId: message.id,
          });

          // If user is currently looking at this chat, immediately clear the notification
          // so the bell badge doesn't flash unnecessarily
          if (isInActiveChat) {
            if (ctx?.type === 'project') {
              get().clearChatNotificationsForRoom(message.roomId, message.projectId || undefined);
            } else if (ctx?.type === 'direct') {
              get().clearChatNotificationsForRoom(undefined, undefined, ctx.id);
            }
          }
        }
      },

      deleteMessage: async (messageId) => {
        if (isSupabaseConfigured()) {
          try {
            await chatService.deleteMessage(messageId);
          } catch (error) {
            console.error('Failed to delete message:', error);
            throw error;
          }
        }
        set((state) => ({
          messages: state.messages.filter((m) => m.id !== messageId),
        }));
      },

      sendProjectMessage: async (projectId, content, attachmentId?) => {
        const { currentUser, addImportantNote } = get();
        if (!currentUser) return;

        let messageId = '';
        if (isSupabaseConfigured()) {
          try {
            const message = await chatService.sendProjectMessage(projectId, currentUser.id, content, attachmentId);
            messageId = message.id;
            set((state) => ({ messages: [...state.messages, message] }));
          } catch (error) {
            console.error('Failed to send message:', error);
            throw error;
          }
        } else {
          // Mock mode
          messageId = `m${Date.now()}`;
          const message: ChatMessage = {
            id: messageId,
            projectId,
            userId: currentUser.id,
            content,
            createdAt: new Date().toISOString(),
            attachmentId,
            messageType: 'text',
          };
          set((state) => ({ messages: [...state.messages, message] }));
        }

        // Auto-extract important notes from message content
        if (projectId && shouldExtractAsImportantNote(content)) {
          const noteItems = extractNoteItems(content);
          for (const item of noteItems) {
            addImportantNote({ projectId, content: item, sourceMessageId: messageId, createdBy: currentUser.id });
          }
        }
      },

      sendDirectMessage: async (toUserId, content, attachmentId?) => {
        const { currentUser } = get();
        if (!currentUser) return;

        if (isSupabaseConfigured()) {
          try {
            const message = await chatService.sendDirectMessage(currentUser.id, toUserId, content, attachmentId);
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
            attachmentId,
            messageType: attachmentId ? 'file' : 'text',
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
                name: getTranslation(get().language, 'allMembers'),
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
        const { currentUser, addImportantNote } = get();
        if (!currentUser) return;

        let messageId = '';
        if (isSupabaseConfigured()) {
          try {
            const message = await chatService.sendRoomMessage(roomId, projectId, currentUser.id, content, options);
            messageId = message.id;
            set((state) => ({ messages: [...state.messages, message] }));
          } catch (error) {
            console.error('Failed to send room message:', error);
            throw error;
          }
        } else {
          // Mock mode
          messageId = `m${Date.now()}`;
          const message: ChatMessage = {
            id: messageId,
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

        // Auto-extract important notes from text messages
        if (projectId && (!options?.messageType || options.messageType === 'text') && shouldExtractAsImportantNote(content)) {
          const noteItems = extractNoteItems(content);
          for (const item of noteItems) {
            addImportantNote({ projectId, content: item, sourceMessageId: messageId, createdBy: currentUser.id });
          }
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

      updateFileItem: async (fileId, updates) => {
        if (isSupabaseConfigured()) {
          try {
            const updated = await fileService.updateFileItem(fileId, updates);
            set((state) => ({
              files: state.files.map((f) => f.id === fileId ? { ...f, ...updated } : f),
            }));
          } catch (error) {
            console.error('Failed to update file:', error);
            throw error;
          }
        } else {
          // Mock mode
          set((state) => ({
            files: state.files.map((f) => f.id === fileId ? { ...f, ...updates } : f),
          }));
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
            // Push app notification for assigned todo
            if (newTodo.assigneeIds?.includes(currentUser.id)) {
              get().addAppNotification({
                type: 'todo',
                title: newTodo.title,
                message: `마감: ${new Date(newTodo.dueDate).toLocaleDateString('ko-KR')}`,
                projectId: newTodo.projectId,
                sourceId: newTodo.id,
              });
            }
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
          // Push app notification for assigned todo
          if (newTodo.assigneeIds?.includes(currentUser.id)) {
            get().addAppNotification({
              type: 'todo',
              title: newTodo.title,
              message: `마감: ${new Date(newTodo.dueDate).toLocaleDateString('ko-KR')}`,
              projectId: newTodo.projectId,
              sourceId: newTodo.id,
            });
          }
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

      // Important Notes Actions
      loadImportantNotes: async () => {
        if (!isSupabaseConfigured()) return;
        try {
          const { getAllNotesForProjects } = await import('@/services/importantNoteService');
          const projectIds = get().projects.map(p => p.id);
          if (projectIds.length === 0) return;
          const notes = await getAllNotesForProjects(projectIds);
          set({ importantNotes: notes });
        } catch (error) {
          console.error('Failed to load important notes:', error);
        }
      },

      addImportantNote: async (note) => {
        if (isSupabaseConfigured()) {
          const { createNote } = await import('@/services/importantNoteService');
          const created = await createNote(note);
          if (created) {
            set((state) => ({
              importantNotes: [...state.importantNotes, created],
            }));
          }
        } else {
          set((state) => ({
            importantNotes: [...state.importantNotes, {
              ...note,
              id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              createdAt: new Date().toISOString(),
            }],
          }));
        }
      },

      removeImportantNote: async (noteId) => {
        if (isSupabaseConfigured()) {
          const { deleteNote } = await import('@/services/importantNoteService');
          const success = await deleteNote(noteId);
          if (success) {
            set((state) => ({
              importantNotes: state.importantNotes.filter((n) => n.id !== noteId),
            }));
          }
        } else {
          set((state) => ({
            importantNotes: state.importantNotes.filter((n) => n.id !== noteId),
          }));
        }
      },

      getImportantNotesByProject: (projectId) =>
        get().importantNotes.filter((n) => n.projectId === projectId),

      // Inspiration Quotes Actions
      addQuote: (quote) => set((state) => ({
        inspirationQuotes: [...state.inspirationQuotes, {
          ...quote,
          id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        }],
      })),
      updateQuote: (id, updates) => set((state) => ({
        inspirationQuotes: state.inspirationQuotes.map((q) =>
          q.id === id ? { ...q, ...updates } : q
        ),
      })),
      removeQuote: (id) => set((state) => ({
        inspirationQuotes: state.inspirationQuotes.filter((q) => q.id !== id),
      })),

      // Company Notification Actions
      broadcastNotification: (title, message) => {
        const { currentUser, notificationSoundEnabled } = get();
        if (!currentUser) return;
        const notification: CompanyNotification = {
          id: `cn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          title,
          message,
          sentBy: currentUser.id,
          sentAt: new Date().toISOString(),
        };
        set((state) => ({
          companyNotifications: [...state.companyNotifications, notification],
        }));
        // Play alert sound for company-wide notifications
        if (notificationSoundEnabled) {
          playNotificationSound('alert');
        }
      },
      dismissCompanyNotification: (id) => set((state) => ({
        companyNotifications: state.companyNotifications.filter((n) => n.id !== id),
      })),

      // ── Gmail + Brain Email Actions ──────────────────

      trashEmail: async (messageId: string) => {
        const state = get();
        if (!state.currentUser) return;

        // Always remove from local list immediately for better UX
        // Also persist the trashed ID so syncGmail won't re-add it
        set({
          gmailMessages: state.gmailMessages.filter(m => m.id !== messageId),
          emailSuggestions: state.emailSuggestions.filter(s => s.emailId !== messageId),
          trashedGmailMessageIds: [...state.trashedGmailMessageIds, messageId],
        });

        // Try server-side trash (may fail if gmail.modify scope not granted)
        try {
          const result = await gmailService.trashGmailMessage(state.currentUser.id, messageId);
          if (!result.success) {
            console.warn('[Gmail] Server trash failed (local removed):', result.error);
          }
        } catch (err) {
          console.warn('[Gmail] Server trash exception (local removed):', err);
        }
      },

      markEmailAsRead: async (messageId: string) => {
        const state = get();
        if (!state.currentUser) return;

        // Check if already read
        const msg = state.gmailMessages.find(m => m.id === messageId);
        if (!msg || !msg.isUnread) return;

        // Update local state immediately for snappy UX
        set({
          gmailMessages: state.gmailMessages.map(m =>
            m.id === messageId ? { ...m, isUnread: false } : m
          ),
        });

        // Sync to Gmail server (best effort)
        try {
          const result = await gmailService.markMessageAsRead(state.currentUser.id, messageId);
          if (!result.success) {
            console.warn('[Gmail] Server mark-read failed (local updated):', result.error);
          }
        } catch (err) {
          console.warn('[Gmail] Server mark-read exception (local updated):', err);
        }
      },

      // ─── Voice Recording Actions ─────────────────────

      startVoiceRecording: async (blob: Blob, metadata: RecordingMetadata) => {
        const state = get();
        if (!state.currentUser) return;

        const userId = state.currentUser.id;
        const recordingId = crypto.randomUUID();
        const recording: VoiceRecording = {
          id: recordingId,
          title: metadata.title,
          projectId: metadata.projectId,
          audioUrl: '',
          audioStoragePath: '',
          duration: 0,
          status: 'uploading',
          createdAt: new Date().toISOString(),
          createdBy: userId,
        };

        // Helper: update a single recording in the array (avoids repeating map logic)
        const patchRecording = (updates: Partial<VoiceRecording>) => {
          set((s) => ({
            voiceRecordings: s.voiceRecordings.map(r =>
              r.id === recordingId ? { ...r, ...updates } : r
            ),
          }));
        };

        // Add to state immediately
        set({ voiceRecordings: [recording, ...state.voiceRecordings] });

        try {
          // Upload to Supabase Storage (get duration in parallel)
          const [duration, { storagePath, publicUrl }] = await Promise.all([
            audioService.getAudioDuration(blob),
            audioService.uploadAudio(blob, userId, metadata),
          ]);

          // Update with URL + duration → transition to transcribing
          patchRecording({ audioUrl: publicUrl, audioStoragePath: storagePath, duration, status: 'transcribing' });

          // Start transcription
          const transcript = await audioService.transcribeAudio(userId, recordingId, storagePath);
          patchRecording({ transcript, status: 'analyzing' });

          // Build brain context (only active projects to reduce payload)
          const brainContext = {
            projects: state.projects
              .filter(p => p.status === 'ACTIVE')
              .map(p => ({
                id: p.id, title: p.title, client: p.client,
                status: p.status, teamMemberIds: p.teamMemberIds,
              })),
            users: state.users.map(u => ({
              id: u.id, name: u.name, department: u.department, role: u.role,
            })),
          };

          const analysis = await audioService.analyzeTranscript(userId, recordingId, transcript, brainContext);
          patchRecording({ brainAnalysis: analysis, status: 'completed' });
        } catch (err) {
          console.error('[VoiceRecording] Pipeline error:', err);
          patchRecording({ status: 'error', errorMessage: (err as Error).message });
        }
      },

      uploadVoiceFile: async (file: File, metadata: RecordingMetadata) => {
        // Reuse the file directly as a Blob (File extends Blob — no copy needed)
        await get().startVoiceRecording(file, metadata);
      },

      updateVoiceRecording: (id: string, updates: Partial<VoiceRecording>) => {
        set((s) => ({
          voiceRecordings: s.voiceRecordings.map(r =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
      },

      analyzeEmail: async (messageId: string) => {
        const state = get();
        if (!state.currentUser) return;

        const email = state.gmailMessages.find(m => m.id === messageId);
        if (!email) return;

        // Build context for Brain AI — projects + users
        const brainContext = {
          projects: state.projects.map(p => ({
            id: p.id, title: p.title, client: p.client,
            status: p.status, teamMemberIds: p.teamMemberIds,
          })),
          users: state.users.map(u => ({
            id: u.id, name: u.name, department: u.department, role: u.role,
          })),
        };

        try {
          const suggestions = await gmailService.analyzeSingleEmail(state.currentUser.id, email, brainContext, state.brainFeedback);
          if (suggestions.length > 0) {
            // Patch emailId to match the actual email (mock data may have different IDs)
            const patchedSuggestions = suggestions.map(s => ({
              ...s,
              emailId: messageId,
            }));
            // Replace existing suggestions for this email, add new ones
            const otherSuggestions = get().emailSuggestions.filter(s => s.emailId !== messageId);
            set({ emailSuggestions: [...patchedSuggestions, ...otherSuggestions] });
            console.log(`[Gmail] Brain analyzed email ${messageId}: ${patchedSuggestions.length} suggestions`);
          } else {
            console.log(`[Gmail] Brain analyzed email ${messageId}: no suggestions found`);
          }
        } catch (err) {
          console.error('[Gmail] Analyze email exception:', err);
        }
      },

      syncGmail: async (forceFullSync?: boolean) => {
        const state = get();
        if (!state.currentUser || state.gmailSyncing) return;
        set({ gmailSyncing: true });
        try {
          // Force full fetch if explicitly requested or cache is empty
          const needsFullFetch = forceFullSync || state.gmailMessages.length === 0;
          const { messages: newMessages } = await gmailService.fetchNewEmails(
            state.currentUser.id,
            needsFullFetch,
          );
          if (newMessages.length === 0) {
            set({ gmailSyncing: false, gmailLastSyncAt: new Date().toISOString() });
            return;
          }
          // Merge new messages — replace existing by ID (to fix stale/garbled cache)
          const existingById = new Map(state.gmailMessages.map(m => [m.id, m]));
          const trulyNew: typeof newMessages = [];
          for (const msg of newMessages) {
            if (!existingById.has(msg.id)) {
              trulyNew.push(msg);
            }
            existingById.set(msg.id, msg); // always update with fresh data
          }
          // Filter out locally-trashed messages so they don't reappear
          const trashedSet = new Set(get().trashedGmailMessageIds);
          const allMessages = Array.from(existingById.values())
            .filter(m => !trashedSet.has(m.id))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 50); // keep max 50

          // Analyze new messages with Brain AI — include project/user context
          const brainCtx = {
            projects: state.projects.map(p => ({
              id: p.id, title: p.title, client: p.client,
              status: p.status, teamMemberIds: p.teamMemberIds,
            })),
            users: state.users.map(u => ({
              id: u.id, name: u.name, department: u.department, role: u.role,
            })),
          };
          const suggestions = await gmailService.analyzeWithBrain(state.currentUser!.id, trulyNew, brainCtx, state.brainFeedback);
          const existingSugIds = new Set(state.emailSuggestions.map(s => s.id));
          const newSuggestions = suggestions.filter(s => !existingSugIds.has(s.id));

          set({
            gmailMessages: allMessages,
            emailSuggestions: [...newSuggestions, ...state.emailSuggestions],
            gmailLastSyncAt: new Date().toISOString(),
            gmailSyncing: false,
          });

          // Notification sound for new suggestions
          if (newSuggestions.length > 0 && state.notificationSoundEnabled) {
            playNotificationSound('alert');
          }
        } catch (err) {
          console.error('[Gmail] Sync error:', err);
          set({ gmailSyncing: false });
        }
      },

      confirmEmailSuggestion: async (suggestionId) => {
        const state = get();
        const suggestion = state.emailSuggestions.find(s => s.id === suggestionId);
        if (!suggestion || !state.currentUser) return;

        // Update status to confirmed first
        set({
          emailSuggestions: state.emailSuggestions.map(s =>
            s.id === suggestionId ? { ...s, status: 'confirmed' as const } : s
          ),
        });

        try {
          const email = state.gmailMessages.find(m => m.id === suggestion.emailId);

          // Create event if suggested
          if (suggestion.suggestedEvent) {
            const event = suggestion.suggestedEvent;
            console.log('[Brain] Creating event from suggestion:', event.title, event.startAt);
            await get().addEvent({
              title: event.title,
              type: event.type || 'MEETING',
              startAt: event.startAt,
              endAt: event.endAt,
              projectId: event.projectId,
              ownerId: state.currentUser!.id,
              source: 'PAULUS',
              location: event.location,
              locationUrl: event.locationUrl,
              attendeeIds: Array.isArray(event.attendeeIds) ? event.attendeeIds : [],
            });
            // Push brain notification
            get().addBrainNotification({
              type: 'brain_event',
              title: '이벤트 생성됨',
              message: `${event.title} (${new Date(event.startAt).toLocaleString('ko-KR')})`,
              emailSubject: email?.subject,
            });
          }

          // Create todo if suggested
          if (suggestion.suggestedTodo) {
            const todo = suggestion.suggestedTodo;
            // Fallback dueDate: tomorrow if Brain didn't provide one
            const dueDate = todo.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            console.log('[Brain] Creating todo from suggestion:', todo.title, dueDate);
            const assignees = Array.isArray(todo.assigneeIds) && todo.assigneeIds.length > 0
              ? todo.assigneeIds
              : [state.currentUser!.id];
            await get().addTodo({
              title: todo.title,
              assigneeIds: assignees,
              requestedById: state.currentUser!.id,
              projectId: todo.projectId,
              dueDate,
              priority: todo.priority || 'NORMAL',
              status: 'PENDING',
            });
            // Push brain notification
            get().addBrainNotification({
              type: 'brain_todo',
              title: '할 일 생성됨',
              message: `${todo.title} (마감: ${new Date(dueDate).toLocaleDateString('ko-KR')})`,
              emailSubject: email?.subject,
            });
          }

          // Create important note if suggested
          if (suggestion.suggestedNote) {
            get().addImportantNote({
              projectId: suggestion.suggestedEvent?.projectId || suggestion.suggestedTodo?.projectId || '',
              content: suggestion.suggestedNote,
              createdBy: state.currentUser!.id,
              sourceMessageId: email ? `email-${email.id}` : undefined,
            });
            // Push brain notification
            get().addBrainNotification({
              type: 'brain_note',
              title: '중요 노트 추가됨',
              message: suggestion.suggestedNote.slice(0, 80),
              emailSubject: email?.subject,
            });
          }

          // Mark as executed
          set({
            emailSuggestions: get().emailSuggestions.map(s =>
              s.id === suggestionId ? { ...s, status: 'executed' as const } : s
            ),
          });
        } catch (err) {
          console.error('[Gmail] Confirm suggestion error:', err);
          set({
            emailSuggestions: get().emailSuggestions.map(s =>
              s.id === suggestionId ? { ...s, status: 'failed' as const } : s
            ),
          });
        }
      },

      rejectEmailSuggestion: (suggestionId) => set((state) => ({
        emailSuggestions: state.emailSuggestions.map(s =>
          s.id === suggestionId ? { ...s, status: 'rejected' as const } : s
        ),
      })),

      sendEmailReply: async (suggestionId, editedBody) => {
        const state = get();
        const suggestion = state.emailSuggestions.find(s => s.id === suggestionId);
        if (!suggestion || !state.currentUser) return;
        const email = state.gmailMessages.find(m => m.id === suggestion.emailId);
        if (!email) return;

        const body = editedBody || suggestion.suggestedReplyDraft || '';
        // Extract email address from "Name <email>" format
        const fromMatch = email.from.match(/<(.+?)>/);
        const replyTo = fromMatch ? fromMatch[1] : email.from;

        const result = await gmailService.sendReply(state.currentUser.id, {
          threadId: suggestion.threadId,
          messageId: suggestion.emailId,
          body,
          to: replyTo,
          subject: `Re: ${email.subject}`,
        });

        if (!result.success) {
          console.error('[Gmail] Reply send error:', result.error);
        }
      },

      composeEmail: async (to, subject, body) => {
        const state = get();
        if (!state.currentUser) return { success: false, error: 'Not logged in' };

        const result = await gmailService.sendNewEmail(state.currentUser.id, { to, subject, body });
        if (result.success) {
          console.log('[Gmail] New email sent to:', to);
        }
        return result;
      },

      replyToEmail: async (messageId, body) => {
        const state = get();
        if (!state.currentUser) return { success: false, error: 'Not logged in' };

        const email = state.gmailMessages.find(m => m.id === messageId);
        if (!email) return { success: false, error: 'Email not found' };

        // Extract email address from "Name <email>" format
        const fromMatch = email.from.match(/<(.+?)>/);
        const replyTo = fromMatch ? fromMatch[1] : email.from;

        const result = await gmailService.sendReply(state.currentUser.id, {
          threadId: email.threadId,
          messageId: email.id,
          body,
          to: replyTo,
          subject: `Re: ${email.subject}`,
        });

        if (!result.success) {
          console.error('[Gmail] Direct reply error:', result.error);
        }
        return result;
      },

      // ── Brain AI Notification & Report Actions ──────
      addBrainNotification: (notification) => set((state) => ({
        brainNotifications: [
          {
            ...notification,
            id: `bn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            createdAt: new Date().toISOString(),
          },
          ...state.brainNotifications,
        ].slice(0, 100), // keep max 100
      })),

      addBrainReport: (report) => set((state) => ({
        brainReports: [
          {
            ...report,
            id: `br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            createdAt: new Date().toISOString(),
            status: 'new' as const,
          },
          ...state.brainReports,
        ],
      })),

      updateBrainReportStatus: (reportId, status, adminNote) => set((state) => ({
        brainReports: state.brainReports.map(r =>
          r.id === reportId ? { ...r, status, ...(adminNote !== undefined ? { adminNote } : {}) } : r
        ),
      })),

      addBrainFeedback: (feedback) => set((state) => {
        const newFeedback: BrainFeedback = {
          ...feedback,
          id: `bf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          createdAt: new Date().toISOString(),
        };
        return { brainFeedback: [newFeedback, ...state.brainFeedback].slice(0, 50) };
      }),

      confirmEmailSuggestionWithEdits: async (suggestionId, edits) => {
        const state = get();
        const suggestion = state.emailSuggestions.find(s => s.id === suggestionId);
        if (!suggestion || !state.currentUser) return;

        // Update status to confirmed
        set({
          emailSuggestions: state.emailSuggestions.map(s =>
            s.id === suggestionId ? { ...s, status: 'confirmed' as const } : s
          ),
        });

        try {
          const email = state.gmailMessages.find(m => m.id === suggestion.emailId);

          // Store feedback if user made changes
          const hasChanges =
            JSON.stringify(edits.event) !== JSON.stringify(suggestion.suggestedEvent) ||
            JSON.stringify(edits.todo) !== JSON.stringify(suggestion.suggestedTodo) ||
            edits.note !== suggestion.suggestedNote ||
            edits.includeEvent !== !!suggestion.suggestedEvent ||
            edits.includeTodo !== !!suggestion.suggestedTodo ||
            edits.includeNote !== !!suggestion.suggestedNote;

          if (hasChanges) {
            get().addBrainFeedback({
              suggestionId,
              emailSubject: email?.subject,
              original: {
                event: suggestion.suggestedEvent,
                todo: suggestion.suggestedTodo,
                note: suggestion.suggestedNote,
              },
              corrected: {
                event: edits.includeEvent ? edits.event : undefined,
                todo: edits.includeTodo ? edits.todo : undefined,
                note: edits.includeNote ? edits.note : undefined,
              },
              included: {
                event: edits.includeEvent,
                todo: edits.includeTodo,
                note: edits.includeNote,
              },
            });
          }

          // Create event if included
          if (edits.includeEvent && edits.event) {
            const ev = edits.event;
            await get().addEvent({
              title: ev.title,
              type: ev.type || 'MEETING',
              startAt: ev.startAt,
              endAt: ev.endAt,
              projectId: ev.projectId,
              ownerId: state.currentUser!.id,
              source: 'PAULUS',
              location: ev.location,
              locationUrl: ev.locationUrl,
              attendeeIds: Array.isArray(ev.attendeeIds) ? ev.attendeeIds : [],
            });
            get().addBrainNotification({
              type: 'brain_event',
              title: '이벤트 생성됨',
              message: `${ev.title} (${new Date(ev.startAt).toLocaleString('ko-KR')})`,
              emailSubject: email?.subject,
            });
          }

          // Create todo if included
          if (edits.includeTodo && edits.todo) {
            const td = edits.todo;
            const dueDate = td.dueDate || new Date(Date.now() + 86400000).toISOString();
            const assignees = Array.isArray(td.assigneeIds) && td.assigneeIds.length > 0
              ? td.assigneeIds : [state.currentUser!.id];
            await get().addTodo({
              title: td.title,
              assigneeIds: assignees,
              requestedById: state.currentUser!.id,
              projectId: td.projectId,
              dueDate,
              priority: td.priority || 'MEDIUM',
              status: 'PENDING',
            });
            get().addBrainNotification({
              type: 'brain_todo',
              title: '할 일 생성됨',
              message: `${td.title} (마감: ${new Date(dueDate).toLocaleDateString('ko-KR')})`,
              emailSubject: email?.subject,
            });
          }

          // Create note if included
          if (edits.includeNote && edits.note) {
            get().addImportantNote({
              projectId: edits.event?.projectId || edits.todo?.projectId || '',
              content: edits.note,
              createdBy: state.currentUser!.id,
              sourceMessageId: email ? `email-${email.id}` : undefined,
            });
            get().addBrainNotification({
              type: 'brain_note',
              title: '중요 노트 추가됨',
              message: edits.note.slice(0, 80),
              emailSubject: email?.subject,
            });
          }

          // Mark as executed
          set({
            emailSuggestions: get().emailSuggestions.map(s =>
              s.id === suggestionId ? { ...s, status: 'executed' as const } : s
            ),
          });
        } catch (err) {
          console.error('[Gmail] Confirm suggestion with edits error:', err);
          set({
            emailSuggestions: get().emailSuggestions.map(s =>
              s.id === suggestionId ? { ...s, status: 'failed' as const } : s
            ),
          });
        }
      },

      // Widget Settings Actions
      updateWidgetSettings: (widgetType, settings) => set((state) => ({
        widgetSettings: {
          ...state.widgetSettings,
          [widgetType]: { ...(state.widgetSettings[widgetType] || {}), ...settings },
        },
      })),

      setTodoCreateDialogOpen: (open) => set({ todoCreateDialogOpen: open }),
      setProjectCreateDialogOpen: (open) => set({ projectCreateDialogOpen: open }),
      setImportantNoteAddOpen: (open) => set({ importantNoteAddOpen: open }),
      setProjectSearchOpen: (open) => set({ projectSearchOpen: open }),
      setShowAutoCheckInDialog: (open) => set({ showAutoCheckInDialog: open }),
      setActiveChatContext: (ctx: { type: 'project' | 'direct'; id: string; roomId?: string } | null) => set({ activeChatContext: ctx }),
      setPendingChatNavigation: (nav: { type: 'project' | 'direct'; id: string; roomId?: string } | null) => set({ pendingChatNavigation: nav }),
      setWorldClockSettingsOpen: (open) => set({ worldClockSettingsOpen: open }),
      setWeatherSettingsOpen: (open) => set({ weatherSettingsOpen: open }),
      setNotificationSoundEnabled: (enabled) => set({ notificationSoundEnabled: enabled }),
      dismissNotification: (id) => set((state) => ({
        dismissedNotificationIds: [...state.dismissedNotificationIds, id],
      })),
      dismissAllNotifications: (ids) => set((state) => ({
        dismissedNotificationIds: [...new Set([...state.dismissedNotificationIds, ...ids])],
      })),

      // Settings Actions
      // App Notification Actions
      addAppNotification: (notification) => {
        const newNotif: AppNotification = {
          ...notification,
          id: `an-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
          read: false,
        };
        set((state) => ({
          appNotifications: [newNotif, ...state.appNotifications].slice(0, 200),
        }));
        // Sound is played by addMessage() — no duplicate sound here
      },
      markAppNotificationRead: (id) => set((state) => ({
        appNotifications: state.appNotifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        ),
      })),
      markAllAppNotificationsRead: () => set((state) => ({
        appNotifications: state.appNotifications.map(n => ({ ...n, read: true })),
      })),
      clearAppNotifications: () => set({ appNotifications: [] }),
      clearChatNotificationsForRoom: (roomId, projectId, directUserId) => set((state) => ({
        appNotifications: state.appNotifications.filter(n => {
          if (n.type !== 'chat') return true;
          // Match by roomId
          if (roomId && n.roomId === roomId) return false;
          // Match by projectId (project-level chat without room)
          if (projectId && !roomId && n.projectId === projectId && !n.roomId) return false;
          // Match DM notifications — sourceId is the message id, check via the messages
          if (directUserId) {
            // DM notifications don't have roomId but have sourceId (message id)
            const msg = state.messages.find(m => m.id === n.sourceId);
            if (msg && (
              (msg.userId === directUserId && msg.directChatUserId === state.currentUser?.id) ||
              (msg.userId === state.currentUser?.id && msg.directChatUserId === directUserId)
            )) return false;
          }
          return true;
        }),
      })),
      getUnreadAppNotificationCount: () =>
        get().appNotifications.filter(n => !n.read).length,

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
      version: 8, // v2: clear garbled gmail cache, v3: brainNotifications+brainReports, v4: trashedGmailMessageIds, v5: brainFeedback, v6: voiceRecordings, v7: appNotifications, v8: boardGroups+boardTasks
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          state.gmailMessages = [];
        }
        if (version < 3) {
          state.brainNotifications = [];
          state.brainReports = [];
        }
        if (version < 4) {
          state.trashedGmailMessageIds = [];
        }
        if (version < 5) {
          state.brainFeedback = [];
        }
        if (version < 6) {
          state.voiceRecordings = [];
        }
        if (version < 7) {
          state.appNotifications = [];
        }
        if (version < 8) {
          state.boardGroups = [];
          state.boardTasks = [];
        }
        return state;
      },
      partialize: (state) => ({
        language: state.language,
        sidebarCollapsed: state.sidebarCollapsed,
        chatPanelCollapsed: state.chatPanelCollapsed,
        userWorkStatus: state.userWorkStatus,
        brainIntelligenceEnabled: state.brainIntelligenceEnabled,
        widgetSettings: state.widgetSettings,
        deletedMockEventIds: state.deletedMockEventIds,
        theme: state.theme,
        importantNotes: state.importantNotes,
        inspirationQuotes: state.inspirationQuotes,
        companyNotifications: state.companyNotifications,
        personalTodos: state.personalTodos,
        messages: state.messages,
        notificationSoundEnabled: state.notificationSoundEnabled,
        dismissedNotificationIds: state.dismissedNotificationIds,
        gmailMessages: state.gmailMessages,
        emailSuggestions: state.emailSuggestions,
        gmailLastSyncAt: state.gmailLastSyncAt,
        trashedGmailMessageIds: state.trashedGmailMessageIds,
        brainNotifications: state.brainNotifications,
        brainReports: state.brainReports,
        brainFeedback: state.brainFeedback,
        voiceRecordings: state.voiceRecordings,
        appNotifications: state.appNotifications,
        boardGroups: state.boardGroups,
        boardTasks: state.boardTasks,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<AppState>) };
        // In mock mode, filter out deleted events from the initial mockEvents
        if (!isSupabaseConfigured() && merged.deletedMockEventIds?.length) {
          const deletedSet = new Set(merged.deletedMockEventIds);
          merged.events = mockEvents.filter((e) => !deletedSet.has(e.id));
        }
        // In mock mode, merge persisted todos with mock todos (avoid duplicates)
        if (!isSupabaseConfigured()) {
          const persistedTodos = (persisted as Partial<AppState>)?.personalTodos;
          if (persistedTodos && persistedTodos.length > 0) {
            // Persisted takes priority — use persisted + any mock todos not already there
            const persistedIds = new Set(persistedTodos.map((t: { id: string }) => t.id));
            const newMockTodos = mockPersonalTodos.filter(t => !persistedIds.has(t.id));
            merged.personalTodos = [...persistedTodos, ...newMockTodos];
          }
          // Merge persisted messages with mock messages
          const persistedMsgs = (persisted as Partial<AppState>)?.messages;
          if (persistedMsgs && persistedMsgs.length > 0) {
            const persistedMsgIds = new Set(persistedMsgs.map((m: { id: string }) => m.id));
            const newMockMsgs = mockMessages.filter(m => !persistedMsgIds.has(m.id));
            merged.messages = [...persistedMsgs, ...newMockMsgs];
          }
        }
        return merged;
      },
    }
  )
);
