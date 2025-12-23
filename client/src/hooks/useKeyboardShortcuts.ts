import { useEffect, useCallback, useRef } from 'react';
import { useUIStore } from '../store/uiStore';

interface UseKeyboardShortcutsOptions {
  onCommandPalette?: () => void;
  onNewInstance?: () => void;
  onSwitchInstance?: (index: number) => void;
  onCycleInstance?: (direction: 'prev' | 'next') => void;
  onNavigation?: (page: 'home' | 'instances' | 'history') => void;
  onCloseInstance?: () => void;
  onTogglePin?: () => void;
  onRenameInstance?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { pendingKeySequence, setPendingKeySequence } = useUIStore();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearKeySequence = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPendingKeySequence(null);
  }, [setPendingKeySequence]);

  useEffect(() => {
    if (options.enabled === false) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input/textarea
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const isTerminal = target.closest('.xterm');

      // For modifier shortcuts (Cmd+X), always process
      // For non-modifier sequences (G H), skip if in input or terminal
      const isMod = e.metaKey || e.ctrlKey;

      if (!isMod && (isInput || isTerminal)) {
        return;
      }

      // Handle key sequences (G then H/I/S)
      if (pendingKeySequence === 'g') {
        e.preventDefault();
        clearKeySequence();

        switch (e.key.toLowerCase()) {
          case 'h':
            options.onNavigation?.('home');
            break;
          case 'i':
            options.onNavigation?.('instances');
            break;
          case 's':
            options.onNavigation?.('history');
            break;
        }
        return;
      }

      // Start G sequence (only when not in terminal/input)
      if (!isMod && e.key.toLowerCase() === 'g' && !isInput && !isTerminal) {
        e.preventDefault();
        setPendingKeySequence('g');
        // Auto-clear after 1 second
        timeoutRef.current = setTimeout(clearKeySequence, 1000);
        return;
      }

      // Handle Cmd+K (Command Palette)
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        options.onCommandPalette?.();
        return;
      }

      // Handle Cmd+N (New Instance) - not Cmd+Shift+N (that's notes panel)
      if (isMod && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        options.onNewInstance?.();
        return;
      }

      // Handle Cmd+1-9 (Switch Instance)
      if (isMod && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        options.onSwitchInstance?.(parseInt(e.key) - 1);
        return;
      }

      // Handle Cmd+[ (Previous Instance)
      if (isMod && e.key === '[') {
        e.preventDefault();
        options.onCycleInstance?.('prev');
        return;
      }

      // Handle Cmd+] (Next Instance)
      if (isMod && e.key === ']') {
        e.preventDefault();
        options.onCycleInstance?.('next');
        return;
      }

      // Instance-specific shortcuts
      // Cmd+W (Close Instance)
      if (isMod && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        options.onCloseInstance?.();
        return;
      }

      // Cmd+P (Toggle Pin) - only when not printing
      if (isMod && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        options.onTogglePin?.();
        return;
      }

      // F2 (Rename Instance) - standard convention, avoids browser refresh conflict
      if (e.key === 'F2') {
        e.preventDefault();
        options.onRenameInstance?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [options, pendingKeySequence, setPendingKeySequence, clearKeySequence]);
}
