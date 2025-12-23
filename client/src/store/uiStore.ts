import { create } from 'zustand';

type ViewType = 'home' | 'instances' | 'history';
type LayoutType = 'cards' | 'list';

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
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'home',
  layout: 'cards',
  leftSidebarOpen: true,
  editorPanelOpen: false,
  notesPanelOpen: false,
  terminalPanelOpen: true,
  panelWidth: 380,
  notesPanelWidth: 380,
  terminalHeight: 200,
  browserHeight: 180,
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
}));
