/**
 * Widget Store — manages tab state and widget layout configuration.
 *
 * - openTabs: list of open tabs (Dashboard is always present)
 * - activeTabId: currently visible tab
 * - dashboardWidgetLayout: widget positions for Dashboard tab
 * - projectWidgetLayout: widget positions shared across ALL project tabs
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TabState, WidgetLayoutItem, WidgetType, WidgetContext } from '@/types/widget';
import { MAX_OPEN_TABS } from '@/types/widget';
import { WIDGET_DEFINITIONS as WIDGET_DEFINITIONS_IMPORT } from '@/components/widgets/widgetRegistry';

// Default layout for Dashboard (12-col grid)
// Matches mockup: Projects top-left, Progress chart, Activity chart,
// Score cards, Notifications right, Todos right, Files bottom
const DEFAULT_DASHBOARD_LAYOUT: WidgetLayoutItem[] = [
  { i: 'projects',        x: 0,  y: 0,  w: 5, h: 4, minW: 3, minH: 3 },
  { i: 'todaySchedule',   x: 5,  y: 0,  w: 4, h: 4, minW: 2, minH: 2 },
  { i: 'notifications',   x: 9,  y: 0,  w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'todos',           x: 9,  y: 3,  w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'todayWeather',    x: 0,  y: 4,  w: 2, h: 2, minW: 1, minH: 2 },
  { i: 'attendance',      x: 2,  y: 4,  w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'files',           x: 4,  y: 4,  w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'brainChat',       x: 6,  y: 4,  w: 3, h: 1, minW: 3, minH: 1 },
  { i: 'inspiration',     x: 0,  y: 6,  w: 6, h: 2, minW: 3, minH: 1 },
];

// Default layout for Project tabs (12-col grid)
// Based on ark.works production layout:
// Row 0: Health | Budget | Brain Chat | Chat (right full-height)
// Row 1-7: Calendar (big-left) | Notifications, Todos, Actions (stacked right-center)
// Row 8-9: Files | Brain Insights | Team Load
const DEFAULT_PROJECT_LAYOUT: WidgetLayoutItem[] = [
  { i: 'health',         x: 0,  y: 0,  w: 3, h: 1, minW: 2, minH: 1 },
  { i: 'budget',         x: 3,  y: 0,  w: 3, h: 1, minW: 2, minH: 1 },
  { i: 'brainChat',      x: 6,  y: 0,  w: 3, h: 1, minW: 3, minH: 1 },
  { i: 'calendar',       x: 0,  y: 1,  w: 7, h: 7, minW: 3, minH: 3 },
  { i: 'notifications',  x: 7,  y: 1,  w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'chat',           x: 9,  y: 0,  w: 3, h: 10, minW: 2, minH: 3 },
  { i: 'todos',          x: 7,  y: 4,  w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'actions',        x: 7,  y: 6,  w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'importantNotes', x: 7,  y: 8,  w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'files',          x: 0,  y: 10, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'brainInsights',  x: 3,  y: 10, w: 3, h: 2, minW: 3, minH: 2 },
  { i: 'teamLoad',       x: 6,  y: 10, w: 3, h: 2, minW: 3, minH: 2 },
];

// Dashboard tab is always present
const DASHBOARD_TAB: TabState = {
  id: 'dashboard',
  type: 'dashboard',
  label: 'Dashboard',
};

interface WidgetState {
  // Tab management
  openTabs: TabState[];
  activeTabId: string;

  // Layout configuration
  dashboardWidgetLayout: WidgetLayoutItem[];
  projectWidgetLayout: WidgetLayoutItem[];

  // Tab actions
  openProjectTab: (projectId: string, label: string, keyColor?: string) => void;
  closeProjectTab: (projectId: string) => void;
  setActiveTab: (tabId: string) => void;

  // Layout actions
  updateDashboardLayout: (layout: WidgetLayoutItem[]) => void;
  updateProjectLayout: (layout: WidgetLayoutItem[]) => void;

  // Widget management
  addWidget: (context: WidgetContext, widgetType: WidgetType) => void;
  removeWidget: (context: WidgetContext, widgetType: WidgetType) => void;
  toggleWidgetCollapsed: (context: WidgetContext, widgetType: WidgetType) => void;

  // Reset
  resetLayout: (context: WidgetContext) => void;
}

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set, get) => ({
      // Initial state
      openTabs: [DASHBOARD_TAB],
      activeTabId: 'dashboard',
      dashboardWidgetLayout: DEFAULT_DASHBOARD_LAYOUT,
      projectWidgetLayout: DEFAULT_PROJECT_LAYOUT,

      // --- Tab actions ---

      openProjectTab: (projectId, label, keyColor) => {
        const { openTabs } = get();
        // Already open? Just activate
        if (openTabs.some((t) => t.id === projectId)) {
          set({ activeTabId: projectId });
          return;
        }
        // Enforce max tabs
        if (openTabs.filter((t) => t.type === 'project').length >= MAX_OPEN_TABS) {
          console.warn(`Max ${MAX_OPEN_TABS} project tabs allowed.`);
          return;
        }
        const newTab: TabState = {
          id: projectId,
          type: 'project',
          label,
          projectId,
          keyColor,
        };
        set({
          openTabs: [...openTabs, newTab],
          activeTabId: projectId,
        });
      },

      closeProjectTab: (projectId) => {
        const { openTabs, activeTabId } = get();
        const filtered = openTabs.filter((t) => t.id !== projectId);
        // If closing active tab, switch to dashboard
        const newActive = activeTabId === projectId ? 'dashboard' : activeTabId;
        set({ openTabs: filtered, activeTabId: newActive });
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId });
      },

      // --- Layout actions ---

      updateDashboardLayout: (layout) => {
        set({ dashboardWidgetLayout: layout });
      },

      updateProjectLayout: (layout) => {
        set({ projectWidgetLayout: layout });
      },

      // --- Widget management ---

      addWidget: (context, widgetType) => {
        const key = context === 'dashboard' ? 'dashboardWidgetLayout' : 'projectWidgetLayout';
        const current = get()[key];
        // Already exists?
        if (current.some((item) => item.i === widgetType)) return;
        // Add at bottom with definition defaults
        const def = WIDGET_DEFINITIONS_IMPORT[widgetType];
        const maxY = current.reduce((max, item) => Math.max(max, item.y + item.h), 0);
        const newItem: WidgetLayoutItem = {
          i: widgetType,
          x: 0,
          y: maxY,
          w: def?.defaultSize?.w ?? 4,
          h: def?.defaultSize?.h ?? 3,
          minW: def?.minSize?.w ?? 2,
          minH: def?.minSize?.h ?? 2,
        };
        set({ [key]: [...current, newItem] });
      },

      removeWidget: (context, widgetType) => {
        const key = context === 'dashboard' ? 'dashboardWidgetLayout' : 'projectWidgetLayout';
        const current = get()[key];
        set({ [key]: current.filter((item) => item.i !== widgetType) });
      },

      toggleWidgetCollapsed: (context, widgetType) => {
        const key = context === 'dashboard' ? 'dashboardWidgetLayout' : 'projectWidgetLayout';
        const current = get()[key];
        set({
          [key]: current.map((item) =>
            item.i === widgetType ? { ...item, collapsed: !item.collapsed } : item,
          ),
        });
      },

      // --- Reset ---

      resetLayout: (context) => {
        if (context === 'dashboard') {
          set({ dashboardWidgetLayout: DEFAULT_DASHBOARD_LAYOUT });
        } else {
          set({ projectWidgetLayout: DEFAULT_PROJECT_LAYOUT });
        }
      },
    }),
    {
      name: 're-be-widget-layout',
      version: 14, // bump — todayWeather minW:1, unread chat notifications
      migrate: () => ({
        // On version mismatch, reset everything to defaults
        openTabs: [DASHBOARD_TAB],
        activeTabId: 'dashboard',
        dashboardWidgetLayout: DEFAULT_DASHBOARD_LAYOUT,
        projectWidgetLayout: DEFAULT_PROJECT_LAYOUT,
      }),
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        dashboardWidgetLayout: state.dashboardWidgetLayout,
        projectWidgetLayout: state.projectWidgetLayout,
      }),
    },
  ),
);
