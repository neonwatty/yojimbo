import { create } from 'zustand';
import type { InstanceStatus, UserPreferences } from '@cc-orchestrator/shared';

interface AppState {
  // Active instance
  activeInstanceId: string | null;
  setActiveInstance: (id: string | null) => void;

  // Layout
  layout: 'tabs' | 'cards' | 'list';
  setLayout: (layout: 'tabs' | 'cards' | 'list') => void;

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

  // Instance status updates (from WebSocket)
  instanceStatuses: Map<string, InstanceStatus>;
  updateInstanceStatus: (id: string, status: InstanceStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Active instance
  activeInstanceId: null,
  setActiveInstance: (id) => set({ activeInstanceId: id }),

  // Layout
  layout: 'tabs',
  setLayout: (layout) => set({ layout }),

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
