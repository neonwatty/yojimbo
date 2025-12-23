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
  notesPanelOpen: false,
  terminalPanelOpen: true,
  panelWidth: 380,
  notesPanelWidth: 380,
  terminalHeight: 200,
  browserHeight: 180,
  plansBrowserWidth: 192,
  notesBrowserWidth: 192,
  plansBrowserCollapsed: false,
  notesBrowserCollapsed: false,
};

interface UIState {
  currentView: ViewType;
  layout: LayoutType;
  leftSidebarOpen: boolean;
  editorPanelOpen: boolean;
  notesPanelOpen: boolean;
  terminalPanelOpen: boolean;
  panelWidth: number;
  notesPanelWidth: number;
  terminalHeight: number;
  browserHeight: number;
  showShortcutsModal: boolean;
  showSettingsModal: boolean;
  // File browser state for Plans/Notes panels
  plansBrowserWidth: number;
  notesBrowserWidth: number;
  plansBrowserCollapsed: boolean;
  notesBrowserCollapsed: boolean;

  setCurrentView: (view: ViewType) => void;
  setLayout: (layout: LayoutType) => void;
  toggleLeftSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  toggleEditorPanel: () => void;
  setEditorPanelOpen: (open: boolean) => void;
  toggleNotesPanel: () => void;
  setNotesPanelOpen: (open: boolean) => void;
  toggleTerminalPanel: () => void;
  setTerminalPanelOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;
  setNotesPanelWidth: (width: number) => void;
  setTerminalHeight: (height: number) => void;
  setBrowserHeight: (height: number) => void;
  setShowShortcutsModal: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  // File browser setters
  setPlansBrowserWidth: (width: number) => void;
  setNotesBrowserWidth: (width: number) => void;
  togglePlansBrowserCollapsed: () => void;
  toggleNotesBrowserCollapsed: () => void;
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

      setCurrentView: (currentView) => set({ currentView }),
      setLayout: (layout) => set({ layout }),
      toggleLeftSidebar: () => set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
      setLeftSidebarOpen: (leftSidebarOpen) => set({ leftSidebarOpen }),
      toggleEditorPanel: () => set((state) => ({ editorPanelOpen: !state.editorPanelOpen })),
      setEditorPanelOpen: (editorPanelOpen) => set({ editorPanelOpen }),
      toggleNotesPanel: () => set((state) => ({ notesPanelOpen: !state.notesPanelOpen })),
      setNotesPanelOpen: (notesPanelOpen) => set({ notesPanelOpen }),
      toggleTerminalPanel: () => set((state) => ({ terminalPanelOpen: !state.terminalPanelOpen })),
      setTerminalPanelOpen: (terminalPanelOpen) => set({ terminalPanelOpen }),
      setPanelWidth: (panelWidth) => set({ panelWidth }),
      setNotesPanelWidth: (notesPanelWidth) => set({ notesPanelWidth }),
      setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
      setBrowserHeight: (browserHeight) => set({ browserHeight }),
      setShowShortcutsModal: (showShortcutsModal) => set({ showShortcutsModal }),
      setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),
      setPlansBrowserWidth: (plansBrowserWidth) => set({ plansBrowserWidth }),
      setNotesBrowserWidth: (notesBrowserWidth) => set({ notesBrowserWidth }),
      togglePlansBrowserCollapsed: () => set((state) => ({ plansBrowserCollapsed: !state.plansBrowserCollapsed })),
      toggleNotesBrowserCollapsed: () => set((state) => ({ notesBrowserCollapsed: !state.notesBrowserCollapsed })),
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
        notesPanelOpen: state.notesPanelOpen,
        terminalPanelOpen: state.terminalPanelOpen,
        panelWidth: state.panelWidth,
        notesPanelWidth: state.notesPanelWidth,
        terminalHeight: state.terminalHeight,
        browserHeight: state.browserHeight,
        plansBrowserWidth: state.plansBrowserWidth,
        notesBrowserWidth: state.notesBrowserWidth,
        plansBrowserCollapsed: state.plansBrowserCollapsed,
        notesBrowserCollapsed: state.notesBrowserCollapsed,
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
