import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewType = 'home' | 'instances' | 'history';
type LayoutType = 'cards' | 'list';

// Default values for all persisted UI state
const DEFAULT_UI_STATE = {
  currentView: 'home' as ViewType,
  layout: 'cards' as LayoutType,
  leftSidebarOpen: true,
  editorPanelOpen: false,
  terminalPanelOpen: true,
  panelWidth: 380,
  terminalHeight: 200,
  browserHeight: 180,
  plansBrowserWidth: 192,
  plansBrowserCollapsed: false,
};

interface UIState {
  currentView: ViewType;
  layout: LayoutType;
  leftSidebarOpen: boolean;
  editorPanelOpen: boolean;
  terminalPanelOpen: boolean;
  panelWidth: number;
  terminalHeight: number;
  browserHeight: number;
  showShortcutsModal: boolean;
  showSettingsModal: boolean;
  // File browser state for Plans panel
  plansBrowserWidth: number;
  plansBrowserCollapsed: boolean;
  // Command palette state (not persisted)
  showCommandPalette: boolean;
  pendingKeySequence: string | null;
  // Connection state (not persisted)
  isConnected: boolean;
  reconnectAttempts: number;

  setCurrentView: (view: ViewType) => void;
  setLayout: (layout: LayoutType) => void;
  toggleLeftSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  toggleEditorPanel: () => void;
  setEditorPanelOpen: (open: boolean) => void;
  toggleTerminalPanel: () => void;
  setTerminalPanelOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;
  setTerminalHeight: (height: number) => void;
  setBrowserHeight: (height: number) => void;
  setShowShortcutsModal: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  // File browser setters
  setPlansBrowserWidth: (width: number) => void;
  togglePlansBrowserCollapsed: () => void;
  // Command palette actions
  setShowCommandPalette: (show: boolean) => void;
  setPendingKeySequence: (key: string | null) => void;
  // Connection state actions
  setConnectionState: (connected: boolean, attempts?: number) => void;
  // Reset to defaults
  resetToDefaults: () => void;
}

const UI_STORE_VERSION = 1;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      ...DEFAULT_UI_STATE,
      // Modal states always start closed (not persisted)
      showShortcutsModal: false,
      showSettingsModal: false,
      // Command palette state (not persisted)
      showCommandPalette: false,
      pendingKeySequence: null,
      // Connection state (not persisted)
      isConnected: false,
      reconnectAttempts: 0,

      setCurrentView: (currentView) => set({ currentView }),
      setLayout: (layout) => set({ layout }),
      toggleLeftSidebar: () => set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
      setLeftSidebarOpen: (leftSidebarOpen) => set({ leftSidebarOpen }),
      toggleEditorPanel: () => set((state) => ({ editorPanelOpen: !state.editorPanelOpen })),
      setEditorPanelOpen: (editorPanelOpen) => set({ editorPanelOpen }),
      toggleTerminalPanel: () => set((state) => ({ terminalPanelOpen: !state.terminalPanelOpen })),
      setTerminalPanelOpen: (terminalPanelOpen) => set({ terminalPanelOpen }),
      setPanelWidth: (panelWidth) => set({ panelWidth }),
      setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
      setBrowserHeight: (browserHeight) => set({ browserHeight }),
      setShowShortcutsModal: (showShortcutsModal) => set({ showShortcutsModal }),
      setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),
      setPlansBrowserWidth: (plansBrowserWidth) => set({ plansBrowserWidth }),
      togglePlansBrowserCollapsed: () => set((state) => ({ plansBrowserCollapsed: !state.plansBrowserCollapsed })),
      setShowCommandPalette: (showCommandPalette) => set({ showCommandPalette }),
      setPendingKeySequence: (pendingKeySequence) => set({ pendingKeySequence }),
      setConnectionState: (isConnected, reconnectAttempts = 0) => set({ isConnected, reconnectAttempts }),
      resetToDefaults: () => set(DEFAULT_UI_STATE),
    }),
    {
      name: 'cc-orchestrator-ui',
      version: UI_STORE_VERSION,
      // Only persist layout state, not modal states
      partialize: (state) => ({
        currentView: state.currentView,
        layout: state.layout,
        leftSidebarOpen: state.leftSidebarOpen,
        editorPanelOpen: state.editorPanelOpen,
        terminalPanelOpen: state.terminalPanelOpen,
        panelWidth: state.panelWidth,
        terminalHeight: state.terminalHeight,
        browserHeight: state.browserHeight,
        plansBrowserWidth: state.plansBrowserWidth,
        plansBrowserCollapsed: state.plansBrowserCollapsed,
      }),
      // Migration for future state shape changes
      migrate: (persistedState, version) => {
        if (version === 0) {
          // First migration - merge with defaults for any missing fields
          return { ...DEFAULT_UI_STATE, ...(persistedState as object) };
        }
        return persistedState as UIState;
      },
    }
  )
);
