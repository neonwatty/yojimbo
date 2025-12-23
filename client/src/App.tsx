import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useSettingsStore } from './store/settingsStore';
import { useUIStore } from './store/uiStore';
import { useInstances } from './hooks/useInstances';
import MainLayout from './components/layout/MainLayout';
import HomePage from './pages/HomePage';
import InstancesPage from './pages/InstancesPage';
import HistoryPage from './pages/HistoryPage';
import { ShortcutsModal, SettingsModal } from './components/modals';

function App() {
  const navigate = useNavigate();
  const { theme } = useSettingsStore();
  const {
    showShortcutsModal,
    showSettingsModal,
    setShowShortcutsModal,
    setShowSettingsModal,
    toggleLeftSidebar,
    toggleEditorPanel,
    toggleNotesPanel,
    toggleTerminalPanel,
  } = useUIStore();

  // Initialize instance fetching and WebSocket subscription
  useInstances();

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
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
    toggleLeftSidebar,
    toggleEditorPanel,
    toggleNotesPanel,
    toggleTerminalPanel,
    setShowShortcutsModal,
    setShowSettingsModal,
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
      <ShortcutsModal isOpen={showShortcutsModal} onClose={() => setShowShortcutsModal(false)} />
      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </>
  );
}

export default App;
