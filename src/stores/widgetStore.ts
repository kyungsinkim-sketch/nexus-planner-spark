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

// Default layout for Dashboard (12-col grid)
const DEFAULT_DASHBOARD_LAYOUT: WidgetLayoutItem[] = [
  { i: 'calendar',       x: 0,  y: 0,  w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'notifications',  x: 6,  y: 0,  w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'chat',           x: 9,  y: 0,  w: 3, h: 5, minW: 3, minH: 3 },
  { i: 'todos',          x: 6,  y: 2,  w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'files',          x: 0,  y: 4,  w: 6, h: 3, minW: 3, minH: 2 },
  { i: 'projects',       x: 6,  y: 5,  w: 6, h: 4, minW: 3, minH: 3 },
];

// Default layout for Project tabs (12-col grid)
const DEFAULT_PROJECT_LAYOUT: WidgetLayoutItem[] = [
  { i: 'calendar',       x: 0,  y: 0,  w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'notifications',  x: 6,  y: 0,  w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'chat',           x: 9,  y: 0,  w: 3, h: 5, minW: 3, minH: 3 },
  { i: 'todos',          x: 6,  y: 2,  w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'files',          x: 0,  y: 4,  w: 6, h: 3, minW: 3, minH: 2 },
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
        // Add at bottom
        const maxY = current.reduce((max, item) => Math.max(max, item.y + item.h), 0);
        const newItem: WidgetLayoutItem = {
          i: widgetType,
          x: 0,
          y: maxY,
          w: 4,
          h: 3,
          minW: 2,
          minH: 2,
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
      partialize: (state) => ({
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        dashboardWidgetLayout: state.dashboardWidgetLayout,
        projectWidgetLayout: state.projectWidgetLayout,
      }),
    },
  ),
);
