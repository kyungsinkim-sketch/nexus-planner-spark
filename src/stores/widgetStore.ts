/**
 * Widget Store — manages tab state and widget layout configuration.
 *
 * - openTabs: list of open tabs (Dashboard is always present)
 * - activeTabId: currently visible tab
 * - dashboardWidgetLayout: widget positions for Dashboard tab
 * - projectWidgetLayout: widget positions shared across ALL project tabs
 *
 * Layouts are persisted:
 *   1. localStorage (fast, per-browser cache)
 *   2. Supabase profiles.widget_layouts (per-user, cross-device)
 * On login, DB layout is loaded and overrides localStorage.
 * On every layout change, both localStorage and DB are updated (DB debounced).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TabState, WidgetLayoutItem, WidgetType, WidgetContext } from '@/types/widget';
import { MAX_OPEN_TABS } from '@/types/widget';
import { WIDGET_DEFINITIONS as WIDGET_DEFINITIONS_IMPORT } from '@/components/widgets/widgetRegistry';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Default layout for Dashboard (12-col grid)
const DEFAULT_DASHBOARD_LAYOUT: WidgetLayoutItem[] = [
  { i: 'projects',        x: 0,  y: 0,  w: 5, h: 4, minW: 3, minH: 3 },
  { i: 'todaySchedule',   x: 5,  y: 0,  w: 4, h: 4, minW: 2, minH: 2 },
  { i: 'notifications',   x: 9,  y: 0,  w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'todos',           x: 9,  y: 3,  w: 3, h: 3, minW: 2, minH: 2 },
  { i: 'todayDate',       x: 0,  y: 4,  w: 2, h: 2, minW: 1, minH: 2 },
  { i: 'todayWeather',    x: 0,  y: 6,  w: 2, h: 2, minW: 1, minH: 2 },
  { i: 'attendance',      x: 2,  y: 4,  w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'files',           x: 4,  y: 4,  w: 2, h: 2, minW: 2, minH: 2 },
  { i: 'brainChat',       x: 6,  y: 4,  w: 3, h: 1, minW: 3, minH: 1 },
  { i: 'inspiration',     x: 0,  y: 6,  w: 6, h: 2, minW: 3, minH: 1 },
  { i: 'email',           x: 6,  y: 6,  w: 3, h: 4, minW: 3, minH: 3 },
  { i: 'voiceRecorder',   x: 0,  y: 8,  w: 4, h: 4, minW: 3, minH: 3 },
];

// Default layout for Project tabs (12-col grid)
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

// ─── Supabase sync helpers ───────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 2000;

/** Save current layouts to Supabase profiles.widget_layouts (debounced) */
function debouncedSaveToDB() {
  if (!isSupabaseConfigured()) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const state = useWidgetStore.getState();
      const payload = {
        dashboardWidgetLayout: state.dashboardWidgetLayout,
        projectWidgetLayout: state.projectWidgetLayout,
      };

      await supabase
        .from('profiles')
        .update({ widget_layouts: payload })
        .eq('id', user.id);
    } catch (err) {
      console.warn('[WidgetStore] Failed to save layout to DB (non-fatal):', err);
    }
  }, SAVE_DEBOUNCE_MS);
}

// ─── Store ───────────────────────────────────────────────────────

interface WidgetState {
  // Tab management
  openTabs: TabState[];
  activeTabId: string;

  // Layout configuration
  dashboardWidgetLayout: WidgetLayoutItem[];
  projectWidgetLayout: WidgetLayoutItem[];

  // DB sync flag
  _layoutLoadedFromDB: boolean;

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

  // DB sync
  loadLayoutFromDB: () => Promise<void>;
}

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set, get) => ({
      // Initial state
      openTabs: [DASHBOARD_TAB],
      activeTabId: 'dashboard',
      dashboardWidgetLayout: DEFAULT_DASHBOARD_LAYOUT,
      projectWidgetLayout: DEFAULT_PROJECT_LAYOUT,
      _layoutLoadedFromDB: false,

      // --- Tab actions ---

      openProjectTab: (projectId, label, keyColor) => {
        const { openTabs } = get();
        if (openTabs.some((t) => t.id === projectId)) {
          set({ activeTabId: projectId });
          return;
        }
        if (openTabs.filter((t) => t.type === 'project').length >= MAX_OPEN_TABS) {
          console.warn(`Max ${MAX_OPEN_TABS} project tabs allowed.`);
          return;
        }
        const newTab: TabState = { id: projectId, type: 'project', label, projectId, keyColor };
        set({ openTabs: [...openTabs, newTab], activeTabId: projectId });
      },

      closeProjectTab: (projectId) => {
        const { openTabs, activeTabId } = get();
        const filtered = openTabs.filter((t) => t.id !== projectId);
        const newActive = activeTabId === projectId ? 'dashboard' : activeTabId;
        set({ openTabs: filtered, activeTabId: newActive });
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      // --- Layout actions (save to both localStorage + DB) ---

      updateDashboardLayout: (layout) => {
        set({ dashboardWidgetLayout: layout });
        debouncedSaveToDB();
      },

      updateProjectLayout: (layout) => {
        set({ projectWidgetLayout: layout });
        debouncedSaveToDB();
      },

      // --- Widget management ---

      addWidget: (context, widgetType) => {
        const key = context === 'dashboard' ? 'dashboardWidgetLayout' : 'projectWidgetLayout';
        const current = get()[key];
        if (current.some((item) => item.i === widgetType)) return;
        const def = WIDGET_DEFINITIONS_IMPORT[widgetType];
        const maxY = current.reduce((max, item) => Math.max(max, item.y + item.h), 0);
        const newItem: WidgetLayoutItem = {
          i: widgetType, x: 0, y: maxY,
          w: def?.defaultSize?.w ?? 4, h: def?.defaultSize?.h ?? 3,
          minW: def?.minSize?.w ?? 2, minH: def?.minSize?.h ?? 2,
        };
        set({ [key]: [...current, newItem] });
        debouncedSaveToDB();
      },

      removeWidget: (context, widgetType) => {
        const key = context === 'dashboard' ? 'dashboardWidgetLayout' : 'projectWidgetLayout';
        set({ [key]: get()[key].filter((item) => item.i !== widgetType) });
        debouncedSaveToDB();
      },

      toggleWidgetCollapsed: (context, widgetType) => {
        const key = context === 'dashboard' ? 'dashboardWidgetLayout' : 'projectWidgetLayout';
        set({
          [key]: get()[key].map((item) =>
            item.i === widgetType ? { ...item, collapsed: !item.collapsed } : item,
          ),
        });
        debouncedSaveToDB();
      },

      // --- Reset ---

      resetLayout: (context) => {
        if (context === 'dashboard') {
          set({ dashboardWidgetLayout: DEFAULT_DASHBOARD_LAYOUT });
        } else {
          set({ projectWidgetLayout: DEFAULT_PROJECT_LAYOUT });
        }
        debouncedSaveToDB();
      },

      // --- DB sync: called after login to load user-specific layout ---

      loadLayoutFromDB: async () => {
        if (!isSupabaseConfigured()) return;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data, error } = await supabase
            .from('profiles')
            .select('widget_layouts')
            .eq('id', user.id)
            .single();

          if (error) {
            console.warn('[WidgetStore] Failed to load layout from DB:', error.message);
            return;
          }

          const layouts = data?.widget_layouts as {
            dashboardWidgetLayout?: WidgetLayoutItem[];
            projectWidgetLayout?: WidgetLayoutItem[];
          } | null;

          if (layouts) {
            const updates: Partial<WidgetState> = { _layoutLoadedFromDB: true };

            if (Array.isArray(layouts.dashboardWidgetLayout) && layouts.dashboardWidgetLayout.length > 0) {
              updates.dashboardWidgetLayout = layouts.dashboardWidgetLayout;
            }
            if (Array.isArray(layouts.projectWidgetLayout) && layouts.projectWidgetLayout.length > 0) {
              updates.projectWidgetLayout = layouts.projectWidgetLayout;
            }

            set(updates);
          } else {
            // No saved layout in DB yet — save current layout to DB for this user
            set({ _layoutLoadedFromDB: true });
            debouncedSaveToDB();
          }
        } catch (err) {
          console.warn('[WidgetStore] Failed to load layout from DB (non-fatal):', err);
        }
      },
    }),
    {
      name: 're-be-widget-layout',
      version: 17,
      migrate: () => ({
        // On version mismatch, reset to defaults (DB will override on next login)
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
