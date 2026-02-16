/**
 * Widget system type definitions for the tab-based widget layout.
 *
 * Each tab (Dashboard or Project) displays a grid of draggable/resizable widgets.
 * Widget layout is stored in Zustand and persisted to localStorage.
 */

import type { LucideIcon } from 'lucide-react';

// All available widget types
export type WidgetType =
  | 'calendar'
  | 'chat'
  | 'todos'
  | 'files'
  | 'budget'
  | 'health'
  | 'actions'
  | 'teamLoad'
  | 'progressChart'
  | 'activityChart'
  | 'attendance'
  | 'notifications'
  | 'projects'
  | 'brainChat'
  | 'brainInsights';

// Widget context — determines which data scope a widget uses
export type WidgetContext = 'dashboard' | 'project';

export interface WidgetDataContext {
  type: WidgetContext;
  projectId?: string;
}

// Widget definition (metadata for registry)
export interface WidgetDefinition {
  type: WidgetType;
  titleKey: string;       // i18n key
  icon: LucideIcon;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  contexts: WidgetContext[];   // where this widget can be used
  adminOnly?: boolean;
}

// react-grid-layout compatible layout item
export interface WidgetLayoutItem {
  i: string;       // widget type ID (matches WidgetType)
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  collapsed?: boolean;
}

// Tab state for bottom tab bar
export interface TabState {
  id: string;                      // 'dashboard' or project UUID
  type: 'dashboard' | 'project';
  label: string;                   // display name
  projectId?: string;              // set for project tabs
  keyColor?: string;               // project accent color
}

// Max concurrent open tabs
export const MAX_OPEN_TABS = 8;

// Grid configuration
export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
export const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
export const GRID_ROW_HEIGHT = 60;
export const GRID_MARGIN: [number, number] = [12, 12];
