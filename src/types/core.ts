export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: UserRole;
  department?: string;
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
}

export type EventSource = 'PAULUS' | 'GOOGLE';

// User work status
export type UserWorkStatus = 'AT_WORK' | 'NOT_AT_WORK' | 'LUNCH' | 'TRAINING';

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
}

export interface ChatMessage {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  createdAt: string;
  attachmentId?: string; // Reference to uploaded file
  directChatUserId?: string; // For direct messages between users
}

export interface FileGroup {
  id: string;
  projectId: string;
  category: 'DECK' | 'FINAL' | 'REFERENCE' | 'CONTRACT' | 'ETC';
  title: string;
}

export interface FileItem {
  id: string;
  fileGroupId: string;
  name: string;
  uploadedBy: string;
  createdAt: string;
  size?: string;
  type?: string;
  isImportant?: boolean;
  source?: 'UPLOAD' | 'CHAT';
  comment?: string; // Comment for searchability
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

// Google Calendar Integration
export type GoogleCalendarSyncStatus = 'DISCONNECTED' | 'CONNECTED' | 'SYNCING' | 'ERROR';

export interface GoogleCalendarSettings {
  isConnected: boolean;
  syncStatus: GoogleCalendarSyncStatus;
  lastSyncAt?: string;
  connectedEmail?: string;
  autoSync: boolean;
}
