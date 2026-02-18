// Shared types for Brain AI Edge Functions

export const BRAIN_BOT_USER_ID = '00000000-0000-0000-0000-000000000099';

export type BrainActionType = 'create_todo' | 'create_event' | 'update_event' | 'share_location' | 'submit_service_suggestion';
export type BrainActionStatus = 'pending' | 'confirmed' | 'rejected' | 'executed' | 'failed';

export interface BrainExtractedTodo {
  title: string;
  assigneeNames: string[];
  assigneeIds: string[];
  dueDate: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
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

export interface BrainExtractedEventUpdate {
  originalTitle: string;      // Title of the event to find and update
  title?: string;             // New title (if changing)
  startAt?: string;           // New start time
  endAt?: string;             // New end time
  location?: string;          // New location
  attendeeIds?: string[];     // New attendees
  type?: 'MEETING' | 'TASK' | 'DEADLINE' | 'DELIVERY';
}

export interface BrainExtractedLocation {
  title: string;
  address: string;
  searchQuery: string;
}

export interface BrainExtractedServiceSuggestion {
  suggestion: string;
  brainSummary: string;
  category: 'feature_request' | 'bug_report' | 'ui_improvement' | 'workflow_suggestion' | 'other';
  priority: 'low' | 'medium' | 'high';
}

export interface LLMExtractedAction {
  type: BrainActionType;
  confidence: number;
  data: BrainExtractedTodo | BrainExtractedEvent | BrainExtractedEventUpdate | BrainExtractedLocation | BrainExtractedServiceSuggestion;
}

export interface LLMResponse {
  hasAction: boolean;
  replyMessage: string;
  actions: LLMExtractedAction[];
}

export interface ProcessRequest {
  messageContent: string;
  roomId?: string;
  projectId?: string;
  userId: string;
  chatMembers: { id: string; name: string }[];
  projectTitle?: string;
}

export interface ExecuteRequest {
  actionId: string;
  userId: string;
}

export interface ChatMember {
  id: string;
  name: string;
}

// ============================================================
// Brain Intelligence Types (Phase 1 — Passive Intelligence)
// ============================================================

export type DigestType = 'decisions' | 'action_items' | 'risks' | 'summary';

export interface DigestItem {
  text: string;
  confidence: number;
  relatedUserIds?: string[];
  category?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface DigestResult {
  decisions: DigestItem[];
  actionItems: DigestItem[];
  risks: DigestItem[];
  summary: string;
}

export interface DigestRequest {
  roomId?: string;
  projectId?: string;
  messageThreshold?: number; // default 15
}

export interface DigestResponse {
  success: boolean;
  digests: Array<{
    id: string;
    digestType: DigestType;
    content: { items: DigestItem[]; summary?: string };
    messageCount: number;
  }>;
  processedRange: { start: string; end: string };
}

export interface ContextRequest {
  projectId: string;
  forceRefresh?: boolean;
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

export interface ContextResponse {
  success: boolean;
  snapshot: ProjectInsightsData;
  cached: boolean;
}
