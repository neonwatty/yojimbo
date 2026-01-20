import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewType = 'home' | 'instances' | 'history' | 'queue';
type LayoutType = 'cards' | 'list';

// Default values for all persisted UI state
const DEFAULT_UI_STATE = {
  currentView: 'home' as ViewType,
  layout: 'cards' as LayoutType,
  leftSidebarOpen: true,
  leftSidebarWidth: 224, // w-56 equivalent
  editorPanelOpen: false,
  mockupsPanelOpen: false,
  terminalPanelOpen: true,
  portsPanelOpen: false,
  htmlFilesPanelOpen: false,
  panelWidth: 380,
  mockupsPanelWidth: 480,
  portsPanelWidth: 320,
  htmlFilesPanelWidth: 480,
  terminalHeight: 200,
  browserHeight: 180,
  plansBrowserWidth: 192,
  plansBrowserCollapsed: false,
  mockupsBrowserWidth: 192,
  mockupsBrowserCollapsed: false,
  // Selected plan per instance (plan ID keyed by instance ID)
  selectedPlanByInstance: {} as Record<string, string>,
};

interface UIState {
  currentView: ViewType;
  layout: LayoutType;
  leftSidebarOpen: boolean;
  leftSidebarWidth: number;
  editorPanelOpen: boolean;
  mockupsPanelOpen: boolean;
  terminalPanelOpen: boolean;
  portsPanelOpen: boolean;
  htmlFilesPanelOpen: boolean;
  panelWidth: number;
  mockupsPanelWidth: number;
  portsPanelWidth: number;
  htmlFilesPanelWidth: number;
  terminalHeight: number;
  browserHeight: number;
  showShortcutsModal: boolean;
  showSettingsModal: boolean;
  showNewInstanceModal: boolean;
  newInstanceDefaultMode: 'terminal' | 'claude-code' | null;
  newInstanceSuggestedName: string | null;
  showTasksPanel: boolean;
  // Local keychain unlock modal state
  showLocalKeychainModal: boolean;
  localKeychainError: string | null;
  // File browser state for Plans panel
  plansBrowserWidth: number;
  plansBrowserCollapsed: boolean;
  // File browser state for Mockups panel
  mockupsBrowserWidth: number;
  mockupsBrowserCollapsed: boolean;
  // Selected plan per instance
  selectedPlanByInstance: Record<string, string>;
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
  setLeftSidebarWidth: (width: number) => void;
  toggleEditorPanel: () => void;
  setEditorPanelOpen: (open: boolean) => void;
  toggleMockupsPanel: () => void;
  setMockupsPanelOpen: (open: boolean) => void;
  toggleTerminalPanel: () => void;
  setTerminalPanelOpen: (open: boolean) => void;
  togglePortsPanel: () => void;
  setPortsPanelOpen: (open: boolean) => void;
  toggleHtmlFilesPanel: () => void;
  setHtmlFilesPanelOpen: (open: boolean) => void;
  setPanelWidth: (width: number) => void;
  setMockupsPanelWidth: (width: number) => void;
  setPortsPanelWidth: (width: number) => void;
  setHtmlFilesPanelWidth: (width: number) => void;
  setTerminalHeight: (height: number) => void;
  setBrowserHeight: (height: number) => void;
  setShowShortcutsModal: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  setShowNewInstanceModal: (show: boolean) => void;
  setNewInstanceDefaultMode: (mode: 'terminal' | 'claude-code' | null) => void;
  setNewInstanceSuggestedName: (name: string | null) => void;
  openNewInstanceModal: (options?: { defaultMode?: 'terminal' | 'claude-code'; suggestedName?: string }) => void;
  setShowTasksPanel: (show: boolean) => void;
  // Local keychain modal
  setShowLocalKeychainModal: (show: boolean) => void;
  showLocalKeychainUnlockPrompt: (error?: string) => void;
  // File browser setters
  setPlansBrowserWidth: (width: number) => void;
  togglePlansBrowserCollapsed: () => void;
  setMockupsBrowserWidth: (width: number) => void;
  toggleMockupsBrowserCollapsed: () => void;
  // Selected plan per instance
  setSelectedPlanForInstance: (instanceId: string, planId: string | null) => void;
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
      showNewInstanceModal: false,
      newInstanceDefaultMode: null,
      newInstanceSuggestedName: null,
      showTasksPanel: false,
      // Local keychain modal state (not persisted)
      showLocalKeychainModal: false,
      localKeychainError: null,
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
      setLeftSidebarWidth: (leftSidebarWidth) => set({ leftSidebarWidth }),
      toggleEditorPanel: () => set((state) => ({ editorPanelOpen: !state.editorPanelOpen })),
      setEditorPanelOpen: (editorPanelOpen) => set({ editorPanelOpen }),
      toggleMockupsPanel: () => set((state) => ({ mockupsPanelOpen: !state.mockupsPanelOpen })),
      setMockupsPanelOpen: (mockupsPanelOpen) => set({ mockupsPanelOpen }),
      toggleTerminalPanel: () => set((state) => ({ terminalPanelOpen: !state.terminalPanelOpen })),
      setTerminalPanelOpen: (terminalPanelOpen) => set({ terminalPanelOpen }),
      togglePortsPanel: () => set((state) => ({ portsPanelOpen: !state.portsPanelOpen })),
      setPortsPanelOpen: (portsPanelOpen) => set({ portsPanelOpen }),
      toggleHtmlFilesPanel: () => set((state) => ({ htmlFilesPanelOpen: !state.htmlFilesPanelOpen })),
      setHtmlFilesPanelOpen: (htmlFilesPanelOpen) => set({ htmlFilesPanelOpen }),
      setPanelWidth: (panelWidth) => set({ panelWidth }),
      setMockupsPanelWidth: (mockupsPanelWidth) => set({ mockupsPanelWidth }),
      setPortsPanelWidth: (portsPanelWidth) => set({ portsPanelWidth }),
      setHtmlFilesPanelWidth: (htmlFilesPanelWidth) => set({ htmlFilesPanelWidth }),
      setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
      setBrowserHeight: (browserHeight) => set({ browserHeight }),
      setShowShortcutsModal: (showShortcutsModal) => set({ showShortcutsModal }),
      setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),
      setShowNewInstanceModal: (showNewInstanceModal) => set({ showNewInstanceModal }),
      setNewInstanceDefaultMode: (newInstanceDefaultMode) => set({ newInstanceDefaultMode }),
      setNewInstanceSuggestedName: (newInstanceSuggestedName) => set({ newInstanceSuggestedName }),
      openNewInstanceModal: (options) => set({
        showNewInstanceModal: true,
        newInstanceDefaultMode: options?.defaultMode || null,
        newInstanceSuggestedName: options?.suggestedName || null
      }),
      setShowTasksPanel: (showTasksPanel) => set({ showTasksPanel }),
      setShowLocalKeychainModal: (showLocalKeychainModal) => set({ showLocalKeychainModal, localKeychainError: showLocalKeychainModal ? null : null }),
      showLocalKeychainUnlockPrompt: (error) => set({ showLocalKeychainModal: true, localKeychainError: error || null }),
      setPlansBrowserWidth: (plansBrowserWidth) => set({ plansBrowserWidth }),
      togglePlansBrowserCollapsed: () => set((state) => ({ plansBrowserCollapsed: !state.plansBrowserCollapsed })),
      setMockupsBrowserWidth: (mockupsBrowserWidth) => set({ mockupsBrowserWidth }),
      toggleMockupsBrowserCollapsed: () => set((state) => ({ mockupsBrowserCollapsed: !state.mockupsBrowserCollapsed })),
      setSelectedPlanForInstance: (instanceId: string, planId: string | null) => set((state) => {
        const updated = { ...state.selectedPlanByInstance };
        if (planId === null) {
          delete updated[instanceId];
        } else {
          updated[instanceId] = planId;
        }
        return { selectedPlanByInstance: updated };
      }),
      setShowCommandPalette: (showCommandPalette: boolean) => set({ showCommandPalette }),
      setPendingKeySequence: (pendingKeySequence: string | null) => set({ pendingKeySequence }),
      setConnectionState: (isConnected: boolean, reconnectAttempts = 0) => set({ isConnected, reconnectAttempts }),
      resetToDefaults: () => set(DEFAULT_UI_STATE),
    }),
    {
      name: 'yojimbo-ui',
      version: UI_STORE_VERSION,
      // Only persist layout state, not modal states
      partialize: (state) => ({
        currentView: state.currentView,
        layout: state.layout,
        leftSidebarOpen: state.leftSidebarOpen,
        leftSidebarWidth: state.leftSidebarWidth,
        editorPanelOpen: state.editorPanelOpen,
        mockupsPanelOpen: state.mockupsPanelOpen,
        terminalPanelOpen: state.terminalPanelOpen,
        portsPanelOpen: state.portsPanelOpen,
        htmlFilesPanelOpen: state.htmlFilesPanelOpen,
        panelWidth: state.panelWidth,
        mockupsPanelWidth: state.mockupsPanelWidth,
        portsPanelWidth: state.portsPanelWidth,
        htmlFilesPanelWidth: state.htmlFilesPanelWidth,
        terminalHeight: state.terminalHeight,
        browserHeight: state.browserHeight,
        plansBrowserWidth: state.plansBrowserWidth,
        plansBrowserCollapsed: state.plansBrowserCollapsed,
        mockupsBrowserWidth: state.mockupsBrowserWidth,
        mockupsBrowserCollapsed: state.mockupsBrowserCollapsed,
        selectedPlanByInstance: state.selectedPlanByInstance,
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
