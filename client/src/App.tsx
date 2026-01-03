import { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useSettingsStore } from './store/settingsStore';
import { useUIStore } from './store/uiStore';
import { useInstancesStore } from './store/instancesStore';
import { useInstances } from './hooks/useInstances';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useMobileLayout } from './hooks/useMobileLayout';
import MainLayout from './components/layout/MainLayout';
import { MobileLayout } from './components/mobile';
import HomePage from './pages/HomePage';
import InstancesPage from './pages/InstancesPage';
import HistoryPage from './pages/HistoryPage';
import ActivityPage from './pages/ActivityPage';
import { ShortcutsModal, SettingsModal, NewInstanceModal } from './components/modals';
import { CommandPalette } from './components/common/CommandPalette';
import { ToastContainer } from './components/common/Toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useSettingsStore();
  const { instances, setActiveInstanceId } = useInstancesStore();
  const { isMobile } = useMobileLayout();
  const {
    showShortcutsModal,
    showSettingsModal,
    showNewInstanceModal,
    showCommandPalette,
    setShowShortcutsModal,
    setShowSettingsModal,
    setShowNewInstanceModal,
    setShowCommandPalette,
    setShowTasksPanel,
    toggleLeftSidebar,
    toggleEditorPanel,
    toggleMockupsPanel,
    toggleTerminalPanel,
  } = useUIStore();

  // Initialize instance fetching and WebSocket subscription
  useInstances();

  // Instance switching handlers
  const switchToInstance = useCallback((index: number) => {
    if (instances[index]) {
      setActiveInstanceId(instances[index].id);
      navigate(`/instances/${instances[index].id}`);
    }
  }, [instances, navigate, setActiveInstanceId]);

  const cycleInstance = useCallback((direction: 'prev' | 'next') => {
    const match = location.pathname.match(/\/instances\/(.+)/);
    if (!match || instances.length === 0) return;

    const currentIndex = instances.findIndex(i => i.id === match[1]);
    if (currentIndex === -1) return;

    const newIndex = direction === 'next'
      ? (currentIndex + 1) % instances.length
      : (currentIndex - 1 + instances.length) % instances.length;

    setActiveInstanceId(instances[newIndex].id);
    navigate(`/instances/${instances[newIndex].id}`);
  }, [instances, location.pathname, navigate, setActiveInstanceId]);

  const handleNewInstance = useCallback(() => {
    setShowNewInstanceModal(true);
  }, [setShowNewInstanceModal]);

  // Use keyboard shortcuts hook for new shortcuts
  useKeyboardShortcuts({
    onCommandPalette: () => setShowCommandPalette(true),
    onNewInstance: handleNewInstance,
    onOpenTasks: () => setShowTasksPanel(true),
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

      // Cmd/Ctrl + M: Toggle mockups panel
      if (isMod && e.key === 'm') {
        e.preventDefault();
        toggleMockupsPanel();
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
        if (showNewInstanceModal) {
          setShowNewInstanceModal(false);
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
    showNewInstanceModal,
    showCommandPalette,
    toggleLeftSidebar,
    toggleEditorPanel,
    toggleMockupsPanel,
    toggleTerminalPanel,
    setShowShortcutsModal,
    setShowSettingsModal,
    setShowNewInstanceModal,
    setShowCommandPalette,
  ]);

  // Mobile layout - simplified full-screen terminal with gesture-based navigation
  if (isMobile) {
    return (
      <>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<MobileLayout />} />
            <Route path="/instances" element={<MobileLayout />} />
            <Route path="/instances/:id" element={<MobileLayout />} />
            <Route path="/history" element={<MobileLayout />} />
            <Route path="/activity" element={<MobileLayout />} />
            <Route path="/tasks" element={<MobileLayout />} />
            {/* Redirect other routes to instances on mobile */}
            <Route path="*" element={<Navigate to="/instances" replace />} />
          </Routes>
        </ErrorBoundary>

        {/* Global Modals - still needed on mobile */}
        <NewInstanceModal isOpen={showNewInstanceModal} onClose={() => setShowNewInstanceModal(false)} />
        <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

        {/* Toast Notifications */}
        <ToastContainer />
      </>
    );
  }

  // Desktop layout - full featured with sidebar and panels
  return (
    <>
      <ErrorBoundary>
        <MainLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/instances" element={<InstancesPage />} />
            <Route path="/instances/:id" element={<InstancesPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            {/* Catch-all: redirect unknown routes to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MainLayout>
      </ErrorBoundary>

      {/* Global Modals */}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      <NewInstanceModal isOpen={showNewInstanceModal} onClose={() => setShowNewInstanceModal(false)} />
      <ShortcutsModal isOpen={showShortcutsModal} onClose={() => setShowShortcutsModal(false)} />
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />

      {/* Toast Notifications */}
      <ToastContainer />
    </>
  );
}

export default App;
