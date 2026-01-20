export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: UserRole;
}

export interface Project {
  id: string;
  title: string;
  client: string;
  status: 'ACTIVE' | 'COMPLETED';
  startDate: string;
  endDate: string;
  description?: string;
  progress?: number;
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

export type EventType = CalendarEvent['type'];
export type ProjectStatus = Project['status'];
export type FileCategory = FileGroup['category'];
