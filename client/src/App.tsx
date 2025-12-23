import { useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useSettingsStore } from './store/settingsStore';
import { useUIStore } from './store/uiStore';
import { useInstancesStore } from './store/instancesStore';
import { useInstances } from './hooks/useInstances';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import MainLayout from './components/layout/MainLayout';
import HomePage from './pages/HomePage';
import InstancesPage from './pages/InstancesPage';
import HistoryPage from './pages/HistoryPage';
import { ShortcutsModal, SettingsModal } from './components/modals';
import { CommandPalette } from './components/common/CommandPalette';
import { instancesApi } from './api/client';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useSettingsStore();
  const { instances } = useInstancesStore();
  const {
    showShortcutsModal,
    showSettingsModal,
    showCommandPalette,
    setShowShortcutsModal,
    setShowSettingsModal,
    setShowCommandPalette,
    toggleLeftSidebar,
    toggleEditorPanel,
    toggleNotesPanel,
    toggleTerminalPanel,
  } = useUIStore();

  // Initialize instance fetching and WebSocket subscription
  useInstances();

  // Instance switching handlers
  const switchToInstance = useCallback((index: number) => {
    if (instances[index]) {
      navigate(`/instances/${instances[index].id}`);
    }
  }, [instances, navigate]);

  const cycleInstance = useCallback((direction: 'prev' | 'next') => {
    const match = location.pathname.match(/\/instances\/(.+)/);
    if (!match || instances.length === 0) return;

    const currentIndex = instances.findIndex(i => i.id === match[1]);
    if (currentIndex === -1) return;

    const newIndex = direction === 'next'
      ? (currentIndex + 1) % instances.length
      : (currentIndex - 1 + instances.length) % instances.length;

    navigate(`/instances/${instances[newIndex].id}`);
  }, [instances, location.pathname, navigate]);

  const handleNewInstance = useCallback(async () => {
    const response = await instancesApi.create({
      name: `instance-${instances.length + 1}`,
      workingDir: '~',
    });
    if (response.data) {
      navigate(`/instances/${response.data.id}`);
    }
  }, [instances.length, navigate]);

  // Use keyboard shortcuts hook for new shortcuts
  useKeyboardShortcuts({
    onCommandPalette: () => setShowCommandPalette(true),
    onNewInstance: handleNewInstance,
    onSwitchInstance: switchToInstance,
    onCycleInstance: cycleInstance,
    onNavigation: (page) => {
      switch (page) {
        case 'home': navigate('/'); break;
        case 'instances': navigate('/instances'); break;
        case 'history': navigate('/history'); break;
      }
    },
  });

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (theme === 'dark' || (theme === 'system' && mediaQuery.matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen for system theme changes when using 'system' mode
    if (theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + B: Toggle sidebar
      if (isMod && e.key === 'b') {
        e.preventDefault();
        toggleLeftSidebar();
        return;
      }

      // Cmd/Ctrl + E: Toggle plans panel
      if (isMod && e.key === 'e') {
        e.preventDefault();
        toggleEditorPanel();
        return;
      }

      // Cmd/Ctrl + Shift + N: Toggle notes panel
      if (isMod && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        toggleNotesPanel();
        return;
      }

      // Cmd/Ctrl + `: Toggle terminal panel
      if (isMod && e.key === '`') {
        e.preventDefault();
        toggleTerminalPanel();
        return;
      }

      // Cmd/Ctrl + /: Show shortcuts
      if (isMod && e.key === '/') {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // Cmd/Ctrl + ,: Show settings
      if (isMod && e.key === ',') {
        e.preventDefault();
        setShowSettingsModal(true);
        return;
      }

      // Escape: Close modals or go back
      if (e.key === 'Escape') {
        if (showCommandPalette) {
          setShowCommandPalette(false);
          return;
        }
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
          return;
        }
        if (showSettingsModal) {
          setShowSettingsModal(false);
          return;
        }
        // Navigate back to instances list
        if (window.location.pathname.startsWith('/instances/')) {
          navigate('/instances');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    navigate,
    showShortcutsModal,
    showSettingsModal,
    showCommandPalette,
    toggleLeftSidebar,
    toggleEditorPanel,
    toggleNotesPanel,
    toggleTerminalPanel,
    setShowShortcutsModal,
    setShowSettingsModal,
    setShowCommandPalette,
  ]);

  return (
    <>
      <MainLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/instances" element={<InstancesPage />} />
          <Route path="/instances/:id" element={<InstancesPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </MainLayout>

      {/* Global Modals */}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      <ShortcutsModal isOpen={showShortcutsModal} onClose={() => setShowShortcutsModal(false)} />
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </>
  );
}

export default App;
