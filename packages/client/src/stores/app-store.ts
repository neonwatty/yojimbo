import { create } from 'zustand';
import type { InstanceStatus, UserPreferences } from '@cc-orchestrator/shared';

interface AppState {
  // Active instance
  activeInstanceId: string | null;
  setActiveInstance: (id: string | null) => void;

  // Layout
  layout: 'cards' | 'list';
  setLayout: (layout: 'cards' | 'list') => void;

  // Focus mode
  focusMode: boolean;
  focusedInstanceId: string | null;
  enterFocusMode: (instanceId: string) => void;
  exitFocusMode: () => void;

  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Preferences
  preferences: UserPreferences;
  setPreferences: (prefs: Partial<UserPreferences>) => void;

  // Modals
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;

  // Plans panel
  plansPanelOpen: boolean;
  togglePlansPanel: () => void;
  setPlansPanelOpen: (open: boolean) => void;
  selectedPlanId: string | null;
  setSelectedPlanId: (id: string | null) => void;

  // Vanilla terminal panel (bottom panel in focus mode)
  terminalPanelOpen: boolean;
  terminalPanelHeight: number;
  toggleTerminalPanel: () => void;
  setTerminalPanelOpen: (open: boolean) => void;
  setTerminalPanelHeight: (height: number) => void;

  // Instance status updates (from WebSocket)
  instanceStatuses: Map<string, InstanceStatus>;
  updateInstanceStatus: (id: string, status: InstanceStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Active instance
  activeInstanceId: null,
  setActiveInstance: (id) => set({ activeInstanceId: id }),

  // Layout
  layout: 'cards',
  setLayout: (layout) => set({ layout }),

  // Focus mode
  focusMode: false,
  focusedInstanceId: null,
  enterFocusMode: (instanceId) =>
    set({ focusMode: true, focusedInstanceId: instanceId, activeInstanceId: instanceId }),
  exitFocusMode: () => set({ focusMode: false, focusedInstanceId: null }),

  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // Theme
  theme: 'dark',
  setTheme: (theme) => set({ theme }),

  // Preferences
  preferences: {
    theme: 'dark',
    terminalFontSize: 14,
    terminalFontFamily: 'JetBrains Mono',
  },
  setPreferences: (prefs) =>
    set((state) => ({
      preferences: { ...state.preferences, ...prefs },
    })),

  // Modals
  showSettings: false,
  setShowSettings: (show) => set({ showSettings: show }),
  showShortcuts: false,
  setShowShortcuts: (show) => set({ showShortcuts: show }),

  // Plans panel
  plansPanelOpen: false,
  togglePlansPanel: () => set((state) => ({ plansPanelOpen: !state.plansPanelOpen })),
  setPlansPanelOpen: (open) => set({ plansPanelOpen: open }),
  selectedPlanId: null,
  setSelectedPlanId: (id) => set({ selectedPlanId: id }),

  // Vanilla terminal panel
  terminalPanelOpen: false,
  terminalPanelHeight: 200,
  toggleTerminalPanel: () => set((state) => ({ terminalPanelOpen: !state.terminalPanelOpen })),
  setTerminalPanelOpen: (open) => set({ terminalPanelOpen: open }),
  setTerminalPanelHeight: (height) => set({ terminalPanelHeight: Math.max(100, Math.min(500, height)) }),

  // Instance status updates
  instanceStatuses: new Map(),
  updateInstanceStatus: (id, status) =>
    set((state) => {
      const newStatuses = new Map(state.instanceStatuses);
      newStatuses.set(id, status);
      return { instanceStatuses: newStatuses };
    }),
}));

// Selectors for common patterns
export const selectActiveInstance = (state: AppState) => state.activeInstanceId;
export const selectLayout = (state: AppState) => state.layout;
export const selectTheme = (state: AppState) => state.theme;
export const selectSidebarOpen = (state: AppState) => state.sidebarOpen;
export const selectFocusMode = (state: AppState) => state.focusMode;
export const selectFocusedInstance = (state: AppState) => state.focusedInstanceId;
export const selectPlansPanelOpen = (state: AppState) => state.plansPanelOpen;
export const selectSelectedPlanId = (state: AppState) => state.selectedPlanId;
export const selectTerminalPanelOpen = (state: AppState) => state.terminalPanelOpen;
export const selectTerminalPanelHeight = (state: AppState) => state.terminalPanelHeight;
