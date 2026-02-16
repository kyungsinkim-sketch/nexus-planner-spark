// Shared types for Brain AI Edge Functions

export const BRAIN_BOT_USER_ID = '00000000-0000-0000-0000-000000000099';

export type BrainActionType = 'create_todo' | 'create_event' | 'share_location';
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

export interface BrainExtractedLocation {
  title: string;
  address: string;
  searchQuery: string;
}

export interface LLMExtractedAction {
  type: BrainActionType;
  confidence: number;
  data: BrainExtractedTodo | BrainExtractedEvent | BrainExtractedLocation;
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
