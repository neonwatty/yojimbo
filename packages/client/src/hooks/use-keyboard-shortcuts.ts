import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/app-store';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const {
    toggleSidebar,
    setShowSettings,
    setShowShortcuts,
    showSettings,
    showShortcuts,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // Allow Escape to close modals
        if (e.key !== 'Escape') return;
      }

      const isMeta = e.metaKey || e.ctrlKey;

      // Escape - close modals
      if (e.key === 'Escape') {
        if (showSettings) {
          e.preventDefault();
          setShowSettings(false);
          return;
        }
        if (showShortcuts) {
          e.preventDefault();
          setShowShortcuts(false);
          return;
        }
      }

      // ⌘B - Toggle sidebar
      if (isMeta && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // ⌘, - Open settings
      if (isMeta && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
        return;
      }

      // ⌘? or ⌘/ - Open shortcuts modal
      if (isMeta && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // ⌘1 - Go to home
      if (isMeta && e.key === '1') {
        e.preventDefault();
        navigate('/');
        return;
      }

      // ⌘2 - Go to instances
      if (isMeta && e.key === '2') {
        e.preventDefault();
        navigate('/instances');
        return;
      }

      // ⌘3 - Go to history
      if (isMeta && e.key === '3') {
        e.preventDefault();
        navigate('/history');
        return;
      }

      // ⌘N - New instance (when on instances page)
      if (isMeta && e.key === 'n') {
        e.preventDefault();
        navigate('/instances?action=new');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    navigate,
    toggleSidebar,
    setShowSettings,
    setShowShortcuts,
    showSettings,
    showShortcuts,
  ]);
}
