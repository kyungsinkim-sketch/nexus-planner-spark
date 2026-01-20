import { create } from 'zustand';
import { User, Project, CalendarEvent, ChatMessage, FileGroup, FileItem } from '@/types/core';
import { mockUsers, mockProjects, mockEvents, mockMessages, mockFileGroups, mockFiles, currentUser } from '@/mock/data';

interface AppState {
  // Auth
  currentUser: User;
  
  // Data
  users: User[];
  projects: Project[];
  events: CalendarEvent[];
  messages: ChatMessage[];
  fileGroups: FileGroup[];
  files: FileItem[];
  
  // UI State
  selectedProjectId: string | null;
  sidebarCollapsed: boolean;
  
  // Actions
  setSelectedProject: (projectId: string | null) => void;
  toggleSidebar: () => void;
  
  // Project Actions (placeholder)
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  
  // Event Actions (placeholder)
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (eventId: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (eventId: string) => void;
  
  // Message Actions (placeholder)
  addMessage: (message: ChatMessage) => void;
  
  // File Actions (placeholder)
  addFileGroup: (fileGroup: FileGroup) => void;
  addFile: (file: FileItem) => void;
  
  // Getters
  getProjectById: (id: string) => Project | undefined;
  getEventsByProject: (projectId: string) => CalendarEvent[];
  getMessagesByProject: (projectId: string) => ChatMessage[];
  getFileGroupsByProject: (projectId: string) => FileGroup[];
  getFilesByGroup: (groupId: string) => FileItem[];
  getUserById: (id: string) => User | undefined;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state from mock data
  currentUser,
  users: mockUsers,
  projects: mockProjects,
  events: mockEvents,
  messages: mockMessages,
  fileGroups: mockFileGroups,
  files: mockFiles,
  
  // UI State
  selectedProjectId: null,
  sidebarCollapsed: false,
  
  // Actions
  setSelectedProject: (projectId) => set({ selectedProjectId: projectId }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  // Project Actions
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (projectId, updates) => set((state) => ({
    projects: state.projects.map((p) => 
      p.id === projectId ? { ...p, ...updates } : p
    ),
  })),
  
  // Event Actions
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  updateEvent: (eventId, updates) => set((state) => ({
    events: state.events.map((e) => 
      e.id === eventId ? { ...e, ...updates } : e
    ),
  })),
  deleteEvent: (eventId) => set((state) => ({
    events: state.events.filter((e) => e.id !== eventId),
  })),
  
  // Message Actions
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  
  // File Actions
  addFileGroup: (fileGroup) => set((state) => ({ fileGroups: [...state.fileGroups, fileGroup] })),
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  
  // Getters
  getProjectById: (id) => get().projects.find((p) => p.id === id),
  getEventsByProject: (projectId) => get().events.filter((e) => e.projectId === projectId),
  getMessagesByProject: (projectId) => get().messages.filter((m) => m.projectId === projectId),
  getFileGroupsByProject: (projectId) => get().fileGroups.filter((fg) => fg.projectId === projectId),
  getFilesByGroup: (groupId) => get().files.filter((f) => f.fileGroupId === groupId),
  getUserById: (id) => get().users.find((u) => u.id === id),
}));
