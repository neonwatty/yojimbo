import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.getState().resetToDefaults();
    // Also reset non-persisted state
    useUIStore.setState({
      showShortcutsModal: false,
      showSettingsModal: false,
      showNewInstanceModal: false,
      showCommandPalette: false,
      pendingKeySequence: null,
      isConnected: false,
      reconnectAttempts: 0,
    });
  });

  describe('view management', () => {
    it('sets the current view', () => {
      useUIStore.getState().setCurrentView('instances');
      expect(useUIStore.getState().currentView).toBe('instances');
    });

    it('sets the layout', () => {
      useUIStore.getState().setLayout('list');
      expect(useUIStore.getState().layout).toBe('list');
    });
  });

  describe('sidebar toggles', () => {
    it('toggles left sidebar', () => {
      const initial = useUIStore.getState().leftSidebarOpen;
      useUIStore.getState().toggleLeftSidebar();
      expect(useUIStore.getState().leftSidebarOpen).toBe(!initial);
    });

    it('sets left sidebar open state directly', () => {
      useUIStore.getState().setLeftSidebarOpen(false);
      expect(useUIStore.getState().leftSidebarOpen).toBe(false);

      useUIStore.getState().setLeftSidebarOpen(true);
      expect(useUIStore.getState().leftSidebarOpen).toBe(true);
    });

    it('sets left sidebar width', () => {
      useUIStore.getState().setLeftSidebarWidth(300);
      expect(useUIStore.getState().leftSidebarWidth).toBe(300);
    });
  });

  describe('panel toggles', () => {
    it('toggles editor panel', () => {
      expect(useUIStore.getState().editorPanelOpen).toBe(false);
      useUIStore.getState().toggleEditorPanel();
      expect(useUIStore.getState().editorPanelOpen).toBe(true);
      useUIStore.getState().toggleEditorPanel();
      expect(useUIStore.getState().editorPanelOpen).toBe(false);
    });

    it('toggles mockups panel', () => {
      expect(useUIStore.getState().mockupsPanelOpen).toBe(false);
      useUIStore.getState().toggleMockupsPanel();
      expect(useUIStore.getState().mockupsPanelOpen).toBe(true);
    });

    it('toggles terminal panel', () => {
      expect(useUIStore.getState().terminalPanelOpen).toBe(true); // default is true
      useUIStore.getState().toggleTerminalPanel();
      expect(useUIStore.getState().terminalPanelOpen).toBe(false);
    });

    it('sets panel open state directly', () => {
      useUIStore.getState().setEditorPanelOpen(true);
      expect(useUIStore.getState().editorPanelOpen).toBe(true);

      useUIStore.getState().setMockupsPanelOpen(true);
      expect(useUIStore.getState().mockupsPanelOpen).toBe(true);

      useUIStore.getState().setTerminalPanelOpen(false);
      expect(useUIStore.getState().terminalPanelOpen).toBe(false);
    });
  });

  describe('dimension setters', () => {
    it('sets panel width', () => {
      useUIStore.getState().setPanelWidth(500);
      expect(useUIStore.getState().panelWidth).toBe(500);
    });

    it('sets mockups panel width', () => {
      useUIStore.getState().setMockupsPanelWidth(600);
      expect(useUIStore.getState().mockupsPanelWidth).toBe(600);
    });

    it('sets terminal height', () => {
      useUIStore.getState().setTerminalHeight(300);
      expect(useUIStore.getState().terminalHeight).toBe(300);
    });

    it('sets browser height', () => {
      useUIStore.getState().setBrowserHeight(250);
      expect(useUIStore.getState().browserHeight).toBe(250);
    });
  });

  describe('modal state', () => {
    it('sets shortcuts modal visibility', () => {
      useUIStore.getState().setShowShortcutsModal(true);
      expect(useUIStore.getState().showShortcutsModal).toBe(true);

      useUIStore.getState().setShowShortcutsModal(false);
      expect(useUIStore.getState().showShortcutsModal).toBe(false);
    });

    it('sets settings modal visibility', () => {
      useUIStore.getState().setShowSettingsModal(true);
      expect(useUIStore.getState().showSettingsModal).toBe(true);
    });

    it('sets new instance modal visibility', () => {
      useUIStore.getState().setShowNewInstanceModal(true);
      expect(useUIStore.getState().showNewInstanceModal).toBe(true);
    });
  });

  describe('file browser state', () => {
    it('sets plans browser width', () => {
      useUIStore.getState().setPlansBrowserWidth(250);
      expect(useUIStore.getState().plansBrowserWidth).toBe(250);
    });

    it('toggles plans browser collapsed', () => {
      expect(useUIStore.getState().plansBrowserCollapsed).toBe(false);
      useUIStore.getState().togglePlansBrowserCollapsed();
      expect(useUIStore.getState().plansBrowserCollapsed).toBe(true);
    });

    it('sets mockups browser width', () => {
      useUIStore.getState().setMockupsBrowserWidth(300);
      expect(useUIStore.getState().mockupsBrowserWidth).toBe(300);
    });

    it('toggles mockups browser collapsed', () => {
      expect(useUIStore.getState().mockupsBrowserCollapsed).toBe(false);
      useUIStore.getState().toggleMockupsBrowserCollapsed();
      expect(useUIStore.getState().mockupsBrowserCollapsed).toBe(true);
    });
  });

  describe('selected plan per instance', () => {
    it('sets selected plan for an instance', () => {
      useUIStore.getState().setSelectedPlanForInstance('inst-1', 'plan-abc');
      expect(useUIStore.getState().selectedPlanByInstance['inst-1']).toBe('plan-abc');
    });

    it('removes selected plan when set to null', () => {
      useUIStore.getState().setSelectedPlanForInstance('inst-1', 'plan-abc');
      useUIStore.getState().setSelectedPlanForInstance('inst-1', null);
      expect(useUIStore.getState().selectedPlanByInstance).not.toHaveProperty('inst-1');
    });

    it('preserves other instance selections', () => {
      useUIStore.getState().setSelectedPlanForInstance('inst-1', 'plan-a');
      useUIStore.getState().setSelectedPlanForInstance('inst-2', 'plan-b');

      expect(useUIStore.getState().selectedPlanByInstance['inst-1']).toBe('plan-a');
      expect(useUIStore.getState().selectedPlanByInstance['inst-2']).toBe('plan-b');
    });
  });

  describe('command palette', () => {
    it('sets command palette visibility', () => {
      useUIStore.getState().setShowCommandPalette(true);
      expect(useUIStore.getState().showCommandPalette).toBe(true);
    });

    it('sets pending key sequence', () => {
      useUIStore.getState().setPendingKeySequence('g');
      expect(useUIStore.getState().pendingKeySequence).toBe('g');

      useUIStore.getState().setPendingKeySequence(null);
      expect(useUIStore.getState().pendingKeySequence).toBeNull();
    });
  });

  describe('connection state', () => {
    it('sets connection state', () => {
      useUIStore.getState().setConnectionState(true, 0);
      expect(useUIStore.getState().isConnected).toBe(true);
      expect(useUIStore.getState().reconnectAttempts).toBe(0);
    });

    it('tracks reconnect attempts', () => {
      useUIStore.getState().setConnectionState(false, 3);
      expect(useUIStore.getState().isConnected).toBe(false);
      expect(useUIStore.getState().reconnectAttempts).toBe(3);
    });

    it('defaults reconnectAttempts to 0', () => {
      useUIStore.getState().setConnectionState(true);
      expect(useUIStore.getState().reconnectAttempts).toBe(0);
    });
  });

  describe('resetToDefaults', () => {
    it('resets all persisted state to defaults', () => {
      // Modify state
      useUIStore.getState().setCurrentView('instances');
      useUIStore.getState().setLayout('list');
      useUIStore.getState().setLeftSidebarOpen(false);
      useUIStore.getState().setPanelWidth(999);

      // Reset
      useUIStore.getState().resetToDefaults();

      // Verify defaults
      expect(useUIStore.getState().currentView).toBe('home');
      expect(useUIStore.getState().layout).toBe('cards');
      expect(useUIStore.getState().leftSidebarOpen).toBe(true);
      expect(useUIStore.getState().panelWidth).toBe(380);
    });
  });
});
