export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: UserRole;
}

export type ProjectType = 'BIDDING' | 'EXECUTION';
export type ProjectPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type HealthStatus = 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | 'HEALTHY' | 'TIGHT' | 'BALANCED' | 'OVERLOADED';

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

export interface Project {
  id: string;
  title: string;
  client: string;
  status: 'ACTIVE' | 'COMPLETED';
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
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'TASK' | 'DEADLINE' | 'MEETING' | 'PT' | 'DELIVERY';
  startAt: string;
  endAt: string;
  projectId?: string;
  ownerId: string;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  createdAt: string;
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
