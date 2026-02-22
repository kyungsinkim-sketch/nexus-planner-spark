export type UserRole = 'ADMIN' | 'MANAGER' | 'PRODUCER' | 'MEMBER';

// User work status
export type UserWorkStatus = 'AT_WORK' | 'NOT_AT_WORK' | 'LUNCH' | 'TRAINING' | 'REMOTE' | 'OVERSEAS' | 'FILMING' | 'FIELD';

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: UserRole;
  department?: string;
  workStatus?: UserWorkStatus;
}

export type ProjectType = 'BIDDING' | 'EXECUTION';
export type ProjectPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type HealthStatus = 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | 'HEALTHY' | 'TIGHT' | 'BALANCED' | 'OVERLOADED';
export type FeedbackStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type Currency = 'KRW' | 'USD';

export interface ProjectHealth {
  schedule: 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
  workload: 'BALANCED' | 'OVERLOADED';
  budget: 'HEALTHY' | 'TIGHT';
}

export interface ProjectMilestone {
  id: string;
  title: string;
  completed: boolean;
}

// Project Task (simple checklist item)
export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  ownerId: string;
  assigneeId?: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
}

// Deliverable
export type DeliverableStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';

export interface Deliverable {
  id: string;
  projectId: string;
  name: string;
  ownerId: string;
  dueDate: string;
  status: DeliverableStatus;
  fileIds: string[];
  createdAt: string;
}

// Inspiration Quote — admin-managed, displayed on dashboard
export interface InspirationQuote {
  id: string;
  text: string;
  author: string;
}

// Company-wide notification — broadcast from admin to all users
export interface CompanyNotification {
  id: string;
  title: string;
  message: string;
  sentBy: string;       // admin userId
  sentAt: string;
}

// Important Note — project-lifetime text note extracted from chat
export interface ImportantNote {
  id: string;
  projectId: string;
  content: string;
  sourceMessageId?: string;   // chat message that triggered it
  createdBy: string;          // userId who sent the message
  createdAt: string;
}

// Personal To-do
export type TodoPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type TodoStatus = 'PENDING' | 'COMPLETED';

export interface PersonalTodo {
  id: string;
  title: string;
  assigneeIds: string[]; // Changed to support multiple assignees
  requestedById: string;
  projectId?: string;
  dueDate: string;
  priority: TodoPriority;
  status: TodoStatus;
  createdAt: string;
  completedAt?: string;
  sourceTaskId?: string; // Link to ProjectTask if auto-created
}

export interface Project {
  id: string;
  title: string;
  client: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  type?: ProjectType;
  priority?: ProjectPriority;
  startDate: string;
  endDate: string;
  description?: string;
  progress?: number;
  pmId?: string;
  teamMemberIds?: string[];
  lastActivityAt?: string;
  health?: ProjectHealth;
  milestones?: ProjectMilestone[];
  tasksCompleted?: number;
  tasksTotal?: number;
  budget?: number;
  currency?: Currency;
  isLocked?: boolean;
  feedbackStatus?: FeedbackStatus;
  thumbnail?: string;
  keyColor?: string; // Project key color for calendar display
  // Completion fields
  finalVideoUrl?: string; // URL of published final video
  completedAt?: string; // When the project was marked complete
  completionApprovedBy?: string; // User ID who submitted completion
}

// Completion peer review
export interface CompletionReview {
  id: string;
  projectId: string;
  fromUserId: string;
  toUserId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
}

// Team Load Snapshot for a project
export interface TeamLoadSnapshot {
  userId: string;
  chatMessages: number;
  fileUploads: number;
  todosCompleted: number;
  calendarEvents: number;
  loadScore: number; // Calculated workload score
}

export type EventSource = 'PAULUS' | 'GOOGLE';

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'TASK' | 'DEADLINE' | 'MEETING' | 'PT' | 'DELIVERY' | 'TODO' | 'DELIVERABLE' | 'R_TRAINING';
  startAt: string;
  endAt: string;
  projectId?: string;
  ownerId: string;
  dueDate?: string; // For auto-calendar sync
  source: EventSource;
  googleEventId?: string;
  todoId?: string; // Link to PersonalTodo
  deliverableId?: string; // Link to Deliverable
  allDay?: boolean; // All-day event (no specific time)
  attendeeIds?: string[]; // Invited user IDs
  location?: string; // Location text (e.g., "강남역 9번출구")
  locationUrl?: string; // Map URL for the location
}

// Chat message types for rich content sharing
export type ChatMessageType = 'text' | 'file' | 'location' | 'schedule' | 'decision' | 'brain_action' | 'persona_response';

// ============================================================
// Brain AI Types
// ============================================================

export const BRAIN_BOT_USER_ID = '00000000-0000-0000-0000-000000000099';

export type BrainActionType = 'create_todo' | 'create_event' | 'share_location' | 'submit_service_suggestion';
export type BrainActionStatus = 'pending' | 'confirmed' | 'rejected' | 'executed' | 'failed';

export interface BrainAction {
  id: string;
  messageId: string;
  actionType: BrainActionType;
  status: BrainActionStatus;
  extractedData: BrainExtractedTodo | BrainExtractedEvent | BrainExtractedLocation;
  executedData?: Record<string, unknown>;
  confirmedBy?: string;
  createdAt: string;
  executedAt?: string;
}

export interface BrainExtractedTodo {
  title: string;
  assigneeNames: string[];    // Original names from message ("민규님")
  assigneeIds: string[];      // Resolved user IDs
  dueDate: string;            // ISO string
  priority: TodoPriority;
  projectId?: string;
}

export interface BrainExtractedEvent {
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  locationUrl?: string;
  attendeeIds: string[];
  type: 'MEETING' | 'TASK' | 'DEADLINE' | 'DELIVERY';
  projectId?: string;
}

export interface BrainExtractedLocation {
  title: string;
  address: string;
  searchQuery: string;       // "서울역" → Map search query
}

// ============================================================
// AI Persona Types (@pablo CEO persona)
// ============================================================

export interface PersonaResponseData {
  personaId: string;
  personaName: string;
  response: string;
  ragContext?: Array<{
    id: string;
    summary: string;
    type: string;
    similarity: number;
  }>;
  queryLogId: string;
}

// ============================================================
// Brain Intelligence Types (Phase 1 — Passive Intelligence)
// ============================================================

export type DigestType = 'decisions' | 'action_items' | 'risks' | 'summary';

export interface ChatDigest {
  id: string;
  roomId?: string;
  projectId?: string;
  digestType: DigestType;
  content: DigestContent;
  messageRangeStart: string;
  messageRangeEnd: string;
  messageCount: number;
  modelUsed?: string;
  confidence?: number;
  createdAt: string;
  expiresAt?: string;
}

export interface DigestContent {
  items: DigestItem[];
  summary?: string;
}

export interface DigestItem {
  text: string;
  confidence: number;
  relatedUserIds?: string[];
  category?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface ProjectContextSnapshot {
  id: string;
  projectId: string;
  snapshotData: ProjectInsightsData;
  generatedAt: string;
  expiresAt: string;
}

export interface ProjectInsightsData {
  recentDecisions: DigestItem[];
  openActionItems: DigestItem[];
  identifiedRisks: DigestItem[];
  conversationSummary: string;
  activityLevel: 'low' | 'medium' | 'high';
  lastAnalyzedAt: string;
  messageCount: number;
}

export interface BrainActivityLogEntry {
  id: string;
  activityType: 'digest_created' | 'context_generated' | 'crud_parsed' | 'error';
  roomId?: string;
  projectId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface LocationShare {
  title: string;
  address: string;
  url: string; // Google Maps, Naver Map, etc.
  latitude?: number;
  longitude?: number;
  provider: 'google' | 'naver' | 'kakao' | 'other';
}

export interface ScheduleShare {
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
  description?: string;
  inviteeIds: string[]; // Users invited to this event
  calendarEventId?: string; // If synced to internal calendar
}

export interface DecisionOption {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  metadata?: Record<string, string>; // e.g. { location: '...', actor: '...', costume: '...' }
}

export interface DecisionVote {
  userId: string;
  optionId: string;
  reason: string; // Required: must explain why
  votedAt: string;
}

export interface DecisionShare {
  title: string;
  description?: string;
  options: DecisionOption[];
  votes: DecisionVote[];
  status: 'open' | 'closed';
  closedAt?: string;
  selectedOptionId?: string; // Final decision
}

export interface ChatRoom {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoomMember {
  roomId: string;
  userId: string;
  joinedAt: string;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  createdAt: string;
  attachmentId?: string; // Reference to uploaded file
  directChatUserId?: string; // For direct messages between users
  roomId?: string; // Chat room reference
  messageType: ChatMessageType;
  locationData?: LocationShare;
  scheduleData?: ScheduleShare;
  decisionData?: DecisionShare;
  brainActionData?: BrainAction; // Brain AI extracted action
  personaResponseData?: PersonaResponseData; // AI persona response (@pablo)
}

export interface FileGroup {
  id: string;
  projectId: string;
  category: 'DECK' | 'FINAL' | 'REFERENCE' | 'CONTRACT' | 'ETC';
  title: string;
}

export interface FileComment {
  id: string;
  fileItemId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface FileItem {
  id: string;
  fileGroupId: string | null;
  name: string;
  uploadedBy: string;
  createdAt: string;
  size?: string;
  type?: string;
  isImportant?: boolean;
  source?: 'UPLOAD' | 'CHAT';
  comment?: string; // Legacy single comment for searchability
  comments?: FileComment[]; // Threaded comments
  storagePath?: string; // Supabase Storage path for download
}

// Performance & Evaluation Types
export interface PerformanceSnapshot {
  id: string;
  userId: string;
  period: string; // YYYY-MM
  totalScore: number;
  financialScore: number;
  peerScore: number;
  rank: number;
  calculatedAt: string;
}

export interface PortfolioItem {
  id: string;
  userId: string;
  projectId: string;
  projectTitle: string;
  client: string;
  role: string;
  thumbnail?: string;
  completedAt: string;
}

export interface PeerFeedback {
  id: string;
  projectId: string;
  fromUserId: string;
  toUserId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
}

export interface ProjectContribution {
  id: string;
  projectId: string;
  userId: string;
  contributionRate: number; // 0-1
  contributionValue: number;
  calculatedAt: string;
}

export interface ScoreSettings {
  financialWeight: number; // 0-100
  peerWeight: number; // 0-100
}

export type EventType = CalendarEvent['type'];
export type ProjectStatus = Project['status'];
export type FileCategory = FileGroup['category'];

// ============================================================
// Gmail + Brain Email Analysis Types
// ============================================================

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;          // "Name <email>"
  to: string[];
  cc?: string[];
  subject: string;
  body: string;          // plain text (stripped HTML)
  date: string;          // ISO string
  isUnread: boolean;
  snippet: string;       // short preview
}

export interface GmailThread {
  id: string;
  snippet: string;
  messages: GmailMessage[];
  latestDate: string;    // for sorting
}

// Date inconsistency detected by Brain (e.g. "3/6(금)" but 3/6 is Thursday)
export interface DateInconsistency {
  mentioned: string;     // "3/6(금)" — expression in email
  actualDay: string;     // "목요일" — actual day of week
  correction: string;    // "3/6은 목요일입니다. 3/7(금) 확인 필요"
}

export type EmailIntentType =
  | 'meeting_request'
  | 'schedule_change'
  | 'deadline'
  | 'info_share'
  | 'action_required'
  | 'location_compare';

// Brain email analysis result — one per email
export interface EmailBrainSuggestion {
  id: string;
  emailId: string;
  threadId: string;
  intent: EmailIntentType;
  summary: string;                        // 1-line Korean summary
  dateInconsistency?: DateInconsistency;
  suggestedEvent?: BrainExtractedEvent;   // Calendar event suggestion (includes location)
  suggestedTodo?: BrainExtractedTodo;     // Todo suggestion
  suggestedNote?: string;                 // Important note content (location comparison, decisions, etc.)
  suggestedReplyDraft?: string;           // Reply draft
  confidence: number;                     // 0-1
  status: BrainActionStatus;              // pending → confirmed → executed
}

// Brain AI Notification — logged when a confirmed suggestion creates data
export type BrainNotificationType = 'brain_event' | 'brain_todo' | 'brain_note';

export interface BrainNotification {
  id: string;
  type: BrainNotificationType;
  title: string;           // e.g., "이벤트 생성됨"
  message: string;         // e.g., "미팅 - 파울러스 사무실 (2026-02-19 14:00)"
  emailSubject?: string;   // source email subject (if from email suggestion)
  chatRoomId?: string;     // source chat room (if from chat Brain action)
  createdAt: string;
}

// Brain Feedback — stores user corrections to Brain suggestions for learning
export interface BrainFeedback {
  id: string;
  suggestionId: string;
  emailSubject?: string;
  original: {
    event?: BrainExtractedEvent;
    todo?: BrainExtractedTodo;
    note?: string;
  };
  corrected: {
    event?: BrainExtractedEvent;
    todo?: BrainExtractedTodo;
    note?: string;
  };
  included: {
    event: boolean;
    todo: boolean;
    note: boolean;
  };
  createdAt: string;
}

// Brain Report — service suggestions collected from chat Brain interactions
export type BrainReportCategory =
  | 'feature_request'
  | 'bug_report'
  | 'ui_improvement'
  | 'workflow_suggestion'
  | 'other';

export type BrainReportStatus = 'new' | 'reviewed' | 'implemented' | 'dismissed';

export interface BrainReport {
  id: string;
  userId: string;
  userName: string;
  suggestion: string;          // The actual suggestion text
  brainSummary: string;        // Brain's classification summary
  category: BrainReportCategory;
  priority: 'low' | 'medium' | 'high';
  chatRoomId?: string;
  messageId?: string;          // Source chat message ID
  createdAt: string;
  status: BrainReportStatus;
  adminNote?: string;          // Admin's note when reviewing
}

// ─── Voice Recording (Voice-to-Brain) ─────────────────────

export type VoiceRecordingStatus = 'uploading' | 'transcribing' | 'analyzing' | 'completed' | 'error';

export interface VoiceRecording {
  id: string;
  title: string;
  projectId?: string;
  audioUrl: string;              // Supabase Storage URL
  audioStoragePath: string;      // Storage path for Edge Function access
  duration: number;              // seconds
  status: VoiceRecordingStatus;
  errorMessage?: string;
  transcript?: TranscriptSegment[];
  brainAnalysis?: VoiceBrainAnalysis;
  createdAt: string;
  createdBy: string;
}

export interface TranscriptSegment {
  speaker: string;               // "Speaker 1" or resolved name
  text: string;
  startTime: number;             // seconds
  endTime: number;               // seconds
}

export interface VoiceBrainAnalysis {
  summary: string;
  decisions: Array<{ content: string; decidedBy?: string; confidence?: number }>;
  suggestedEvents: BrainExtractedEvent[];
  actionItems: BrainExtractedTodo[];
  followups: Array<{ content: string; remindDate?: string }>;
  keyQuotes: Array<{ speaker: string; text: string; timestamp: number; importance?: string }>;
}

export interface RecordingMetadata {
  title: string;
  projectId?: string;
}

// Google Calendar Integration
export type GoogleCalendarSyncStatus = 'DISCONNECTED' | 'CONNECTED' | 'SYNCING' | 'ERROR';

export interface GoogleCalendarSettings {
  isConnected: boolean;
  syncStatus: GoogleCalendarSyncStatus;
  lastSyncAt?: string;
  connectedEmail?: string;
  autoSync: boolean;
}
