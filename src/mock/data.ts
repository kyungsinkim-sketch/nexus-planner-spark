import { User, Project, CalendarEvent, ChatMessage, FileGroup, FileItem } from '@/types/core';

// Helper to generate dates relative to today
const today = new Date();
const addDays = (days: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export const mockUsers: User[] = [
  { id: 'u1', name: 'Paul Kim', avatar: '', role: 'ADMIN' },
  { id: 'u2', name: 'Sarah Chen', avatar: '', role: 'MANAGER' },
  { id: 'u3', name: 'James Lee', avatar: '', role: 'MEMBER' },
  { id: 'u4', name: 'Emily Park', avatar: '', role: 'MEMBER' },
  { id: 'u5', name: 'David Song', avatar: '', role: 'MANAGER' },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    title: 'Samsung Galaxy Campaign',
    client: 'Samsung Electronics',
    status: 'ACTIVE',
    startDate: addDays(-30),
    endDate: addDays(30),
    description: 'Global marketing campaign for Galaxy S25 launch',
    progress: 65,
  },
  {
    id: 'p2',
    title: 'Hyundai EV Brand Film',
    client: 'Hyundai Motor',
    status: 'ACTIVE',
    startDate: addDays(-14),
    endDate: addDays(45),
    description: 'Brand film production for new electric vehicle lineup',
    progress: 35,
  },
  {
    id: 'p3',
    title: 'LG Smart Home Integration',
    client: 'LG Electronics',
    status: 'ACTIVE',
    startDate: addDays(-7),
    endDate: addDays(60),
    description: 'Smart home ecosystem marketing materials',
    progress: 20,
  },
  {
    id: 'p4',
    title: 'SK Telecom 5G Launch',
    client: 'SK Telecom',
    status: 'COMPLETED',
    startDate: addDays(-90),
    endDate: addDays(-30),
    description: '5G network launch campaign completed successfully',
    progress: 100,
  },
  {
    id: 'p5',
    title: 'Kakao Pay Rebrand',
    client: 'Kakao',
    status: 'ACTIVE',
    startDate: addDays(-21),
    endDate: addDays(21),
    description: 'Complete visual identity refresh for Kakao Pay',
    progress: 50,
  },
];

export const mockEvents: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Samsung Kickoff Meeting',
    type: 'MEETING',
    startAt: addDays(0),
    endAt: addDays(0),
    projectId: 'p1',
    ownerId: 'u1',
  },
  {
    id: 'e2',
    title: 'Galaxy Campaign - Phase 1 Deadline',
    type: 'DEADLINE',
    startAt: addDays(3),
    endAt: addDays(3),
    projectId: 'p1',
    ownerId: 'u2',
  },
  {
    id: 'e3',
    title: 'Hyundai Storyboard Review',
    type: 'TASK',
    startAt: addDays(1),
    endAt: addDays(2),
    projectId: 'p2',
    ownerId: 'u3',
  },
  {
    id: 'e4',
    title: 'Client Presentation - LG',
    type: 'PT',
    startAt: addDays(5),
    endAt: addDays(5),
    projectId: 'p3',
    ownerId: 'u1',
  },
  {
    id: 'e5',
    title: 'Final Assets Delivery',
    type: 'DELIVERY',
    startAt: addDays(7),
    endAt: addDays(7),
    projectId: 'p1',
    ownerId: 'u4',
  },
  {
    id: 'e6',
    title: 'Kakao Brand Guidelines Review',
    type: 'MEETING',
    startAt: addDays(2),
    endAt: addDays(2),
    projectId: 'p5',
    ownerId: 'u5',
  },
  {
    id: 'e7',
    title: 'Hyundai EV Film - Script Finalization',
    type: 'TASK',
    startAt: addDays(4),
    endAt: addDays(6),
    projectId: 'p2',
    ownerId: 'u2',
  },
  {
    id: 'e8',
    title: 'Weekly Team Sync',
    type: 'MEETING',
    startAt: addDays(0),
    endAt: addDays(0),
    ownerId: 'u1',
  },
  {
    id: 'e9',
    title: 'Design Sprint Planning',
    type: 'TASK',
    startAt: addDays(8),
    endAt: addDays(8),
    projectId: 'p3',
    ownerId: 'u3',
  },
  {
    id: 'e10',
    title: 'Kakao Pay Launch Presentation',
    type: 'PT',
    startAt: addDays(14),
    endAt: addDays(14),
    projectId: 'p5',
    ownerId: 'u1',
  },
];

export const mockMessages: ChatMessage[] = [
  {
    id: 'm1',
    projectId: 'p1',
    userId: 'u1',
    content: 'Just uploaded the latest campaign deck for review',
    createdAt: addDays(-1),
  },
  {
    id: 'm2',
    projectId: 'p1',
    userId: 'u2',
    content: 'Looks great! Minor feedback on slides 3-5',
    createdAt: addDays(-1),
  },
  {
    id: 'm3',
    projectId: 'p1',
    userId: 'u3',
    content: 'Will update the motion graphics section today',
    createdAt: addDays(0),
  },
  {
    id: 'm4',
    projectId: 'p2',
    userId: 'u2',
    content: 'Storyboard draft is ready for client review',
    createdAt: addDays(-2),
  },
  {
    id: 'm5',
    projectId: 'p3',
    userId: 'u4',
    content: 'Waiting for brand assets from LG team',
    createdAt: addDays(-1),
  },
];

export const mockFileGroups: FileGroup[] = [
  { id: 'fg1', projectId: 'p1', category: 'DECK', title: 'Campaign Presentations' },
  { id: 'fg2', projectId: 'p1', category: 'FINAL', title: 'Final Deliverables' },
  { id: 'fg3', projectId: 'p1', category: 'REFERENCE', title: 'Reference Materials' },
  { id: 'fg4', projectId: 'p2', category: 'DECK', title: 'Storyboards' },
  { id: 'fg5', projectId: 'p2', category: 'CONTRACT', title: 'Client Contracts' },
  { id: 'fg6', projectId: 'p3', category: 'REFERENCE', title: 'Brand Guidelines' },
];

export const mockFiles: FileItem[] = [
  {
    id: 'f1',
    fileGroupId: 'fg1',
    name: 'Samsung_Galaxy_S25_Campaign_v3.pdf',
    uploadedBy: 'u1',
    createdAt: addDays(-2),
    size: '4.2 MB',
    type: 'pdf',
  },
  {
    id: 'f2',
    fileGroupId: 'fg1',
    name: 'Campaign_Timeline_2024.xlsx',
    uploadedBy: 'u2',
    createdAt: addDays(-3),
    size: '1.1 MB',
    type: 'xlsx',
  },
  {
    id: 'f3',
    fileGroupId: 'fg2',
    name: 'Hero_Banner_Final.psd',
    uploadedBy: 'u3',
    createdAt: addDays(-1),
    size: '45.8 MB',
    type: 'psd',
  },
  {
    id: 'f4',
    fileGroupId: 'fg3',
    name: 'Competitor_Analysis.pdf',
    uploadedBy: 'u4',
    createdAt: addDays(-5),
    size: '2.3 MB',
    type: 'pdf',
  },
  {
    id: 'f5',
    fileGroupId: 'fg4',
    name: 'Hyundai_EV_Storyboard_v2.pdf',
    uploadedBy: 'u2',
    createdAt: addDays(-2),
    size: '8.7 MB',
    type: 'pdf',
  },
];

// Current logged in user (for demo)
export const currentUser = mockUsers[0];
