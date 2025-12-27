import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useUIStore } from '../store/uiStore';

// Create a DOM element to dispatch events from (so target has DOM methods)
let testElement: HTMLDivElement;

// Helper to dispatch keyboard events from a proper DOM element
function dispatchKeyDown(key: string, options: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  testElement.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Create a test element and add to document
    testElement = document.createElement('div');
    document.body.appendChild(testElement);
    // Reset UI store
    useUIStore.setState({
      pendingKeySequence: null,
      showCommandPalette: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.removeChild(testElement);
  });

  describe('modifier shortcuts', () => {
    it('calls onCommandPalette on Cmd+K', () => {
      const onCommandPalette = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCommandPalette }));

      dispatchKeyDown('k', { metaKey: true });

      expect(onCommandPalette).toHaveBeenCalledTimes(1);
    });

    it('calls onNewInstance on Cmd+N', () => {
      const onNewInstance = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onNewInstance }));

      dispatchKeyDown('n', { metaKey: true });

      expect(onNewInstance).toHaveBeenCalledTimes(1);
    });

    it('does not call onNewInstance on Cmd+Shift+N', () => {
      const onNewInstance = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onNewInstance }));

      dispatchKeyDown('n', { metaKey: true, shiftKey: true });

      expect(onNewInstance).not.toHaveBeenCalled();
    });

    it('calls onSwitchInstance with index on Cmd+1-9', () => {
      const onSwitchInstance = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onSwitchInstance }));

      dispatchKeyDown('1', { metaKey: true });
      expect(onSwitchInstance).toHaveBeenCalledWith(0);

      dispatchKeyDown('5', { metaKey: true });
      expect(onSwitchInstance).toHaveBeenCalledWith(4);

      dispatchKeyDown('9', { metaKey: true });
      expect(onSwitchInstance).toHaveBeenCalledWith(8);
    });

    it('calls onCycleInstance with prev on Cmd+[', () => {
      const onCycleInstance = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCycleInstance }));

      dispatchKeyDown('[', { metaKey: true });

      expect(onCycleInstance).toHaveBeenCalledWith('prev');
    });

    it('calls onCycleInstance with next on Cmd+]', () => {
      const onCycleInstance = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCycleInstance }));

      dispatchKeyDown(']', { metaKey: true });

      expect(onCycleInstance).toHaveBeenCalledWith('next');
    });

    it('calls onCloseInstance on Cmd+W', () => {
      const onCloseInstance = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCloseInstance }));

      dispatchKeyDown('w', { metaKey: true });

      expect(onCloseInstance).toHaveBeenCalledTimes(1);
    });

    it('calls onTogglePin on Cmd+P', () => {
      const onTogglePin = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onTogglePin }));

      dispatchKeyDown('p', { metaKey: true });

      expect(onTogglePin).toHaveBeenCalledTimes(1);
    });

    it('does not call onTogglePin on Cmd+Shift+P', () => {
      const onTogglePin = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onTogglePin }));

      dispatchKeyDown('p', { metaKey: true, shiftKey: true });

      expect(onTogglePin).not.toHaveBeenCalled();
    });
  });

  describe('F2 shortcut', () => {
    it('calls onRenameInstance on F2', () => {
      const onRenameInstance = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onRenameInstance }));

      dispatchKeyDown('F2');

      expect(onRenameInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('key sequences (g → x)', () => {
    it('navigates to home on g → h', async () => {
      const onNavigation = vi.fn();
      const { rerender } = renderHook(() => useKeyboardShortcuts({ onNavigation }));

      // Press 'g' to start sequence
      act(() => {
        dispatchKeyDown('g');
      });

      // Verify pending sequence is set
      expect(useUIStore.getState().pendingKeySequence).toBe('g');

      // Re-render to pick up the new pendingKeySequence value
      rerender();

      // Press 'h' to complete sequence
      act(() => {
        dispatchKeyDown('h');
      });

      expect(onNavigation).toHaveBeenCalledWith('home');
      expect(useUIStore.getState().pendingKeySequence).toBeNull();
    });

    it('navigates to instances on g → i', () => {
      const onNavigation = vi.fn();
      const { rerender } = renderHook(() => useKeyboardShortcuts({ onNavigation }));

      act(() => {
        dispatchKeyDown('g');
      });
      rerender();
      act(() => {
        dispatchKeyDown('i');
      });

      expect(onNavigation).toHaveBeenCalledWith('instances');
    });

    it('navigates to history on g → s', () => {
      const onNavigation = vi.fn();
      const { rerender } = renderHook(() => useKeyboardShortcuts({ onNavigation }));

      act(() => {
        dispatchKeyDown('g');
      });
      rerender();
      act(() => {
        dispatchKeyDown('s');
      });

      expect(onNavigation).toHaveBeenCalledWith('history');
    });

    it('clears pending sequence when completing navigation', () => {
      const onNavigation = vi.fn();
      const { rerender } = renderHook(() => useKeyboardShortcuts({ onNavigation }));

      act(() => {
        dispatchKeyDown('g');
      });
      rerender();
      act(() => {
        dispatchKeyDown('h');
      });

      expect(useUIStore.getState().pendingKeySequence).toBeNull();
    });
  });

  describe('enabled option', () => {
    it('does not respond to shortcuts when disabled', () => {
      const onCommandPalette = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCommandPalette, enabled: false }));

      dispatchKeyDown('k', { metaKey: true });

      expect(onCommandPalette).not.toHaveBeenCalled();
    });

    it('responds to shortcuts when enabled is true', () => {
      const onCommandPalette = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCommandPalette, enabled: true }));

      dispatchKeyDown('k', { metaKey: true });

      expect(onCommandPalette).toHaveBeenCalledTimes(1);
    });

    it('responds to shortcuts when enabled is undefined (default)', () => {
      const onCommandPalette = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCommandPalette }));

      dispatchKeyDown('k', { metaKey: true });

      expect(onCommandPalette).toHaveBeenCalledTimes(1);
    });
  });

  describe('input element detection', () => {
    it('skips non-modifier shortcuts when focus is in an input', () => {
      const onNavigation = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onNavigation }));

      // Create an input and dispatch from it
      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'g',
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);

      expect(useUIStore.getState().pendingKeySequence).toBeNull();

      document.body.removeChild(input);
    });

    it('processes modifier shortcuts even when focus is in an input', () => {
      const onCommandPalette = vi.fn();
      renderHook(() => useKeyboardShortcuts({ onCommandPalette }));

      // Create an input and dispatch from it
      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);

      expect(onCommandPalette).toHaveBeenCalledTimes(1);

      document.body.removeChild(input);
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const onCommandPalette = vi.fn();
      const { unmount } = renderHook(() => useKeyboardShortcuts({ onCommandPalette }));

      unmount();

      dispatchKeyDown('k', { metaKey: true });

      expect(onCommandPalette).not.toHaveBeenCalled();
    });
  });
});
