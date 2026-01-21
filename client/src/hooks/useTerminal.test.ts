import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock ResizeObserver which is not available in jsdom
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Store mock functions for assertions - these need to be at module scope
// but defined BEFORE the vi.mock calls since mocks are hoisted
const mockScrollLines = vi.fn();
const mockWrite = vi.fn();
const mockFocus = vi.fn();
const mockClear = vi.fn();
const mockDispose = vi.fn();
const mockLoadAddon = vi.fn();
const mockOpen = vi.fn();
const mockOnData = vi.fn();
const mockRefresh = vi.fn();
const mockFit = vi.fn();

// Mock xterm modules - factory must be self-contained since it's hoisted
vi.mock('@xterm/xterm', () => {
  return {
    Terminal: class {
      scrollLines = mockScrollLines;
      write = mockWrite;
      focus = mockFocus;
      clear = mockClear;
      dispose = mockDispose;
      loadAddon = mockLoadAddon;
      open = mockOpen;
      onData = mockOnData;
      refresh = mockRefresh;
      cols = 80;
      rows = 24;
      options = {};
    },
  };
});

vi.mock('@xterm/addon-fit', () => {
  return {
    FitAddon: class {
      fit = mockFit;
    },
  };
});

vi.mock('@xterm/addon-web-links', () => {
  return {
    WebLinksAddon: class {},
  };
});

// Import after mocks are set up
import { useTerminal } from './useTerminal';

describe('useTerminal', () => {
  let mockContainer: HTMLDivElement;
  let mockXtermScreen: HTMLDivElement;
  let addedEventListeners: Map<string, EventListener>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockScrollLines.mockReset();
    mockWrite.mockReset();
    mockFocus.mockReset();
    mockClear.mockReset();
    mockDispose.mockReset();
    mockLoadAddon.mockReset();
    mockOpen.mockReset();
    mockOnData.mockReset();
    mockRefresh.mockReset();
    mockFit.mockReset();

    addedEventListeners = new Map();

    // Create mock xterm-screen element
    mockXtermScreen = document.createElement('div');
    mockXtermScreen.className = 'xterm-screen';
    const originalAddEventListener = mockXtermScreen.addEventListener.bind(mockXtermScreen);
    mockXtermScreen.addEventListener = vi.fn((event: string, handler: EventListener, options?: AddEventListenerOptions | boolean) => {
      addedEventListeners.set(event, handler);
      originalAddEventListener(event, handler, options);
    });

    // Create mock container
    mockContainer = document.createElement('div');
    mockContainer.querySelector = vi.fn().mockReturnValue(mockXtermScreen);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('touch scrolling', () => {
    it('adds touch event listeners to xterm-screen element on initialization', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      // Verify touch event listeners were added
      expect(mockXtermScreen.addEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        { passive: true }
      );
      expect(mockXtermScreen.addEventListener).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function),
        { passive: false }
      );
      expect(mockXtermScreen.addEventListener).toHaveBeenCalledWith(
        'touchend',
        expect.any(Function),
        { passive: true }
      );
    });

    it('calls scrollLines when touchmove occurs with sufficient delta', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      // Get the touch event handlers
      const touchStartHandler = addedEventListeners.get('touchstart');
      const touchMoveHandler = addedEventListeners.get('touchmove');

      expect(touchStartHandler).toBeDefined();
      expect(touchMoveHandler).toBeDefined();

      // Simulate touchstart
      const touchStartEvent = {
        touches: [{ clientY: 300 }],
      } as unknown as TouchEvent;

      touchStartHandler!(touchStartEvent);

      // Simulate touchmove with a significant delta (move finger up = scroll down)
      // Line height is 13 * 1.2 = 15.6, so a delta of 32 should scroll ~2 lines
      const touchMoveEvent = {
        touches: [{ clientY: 268 }], // 300 - 268 = 32px delta
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      touchMoveHandler!(touchMoveEvent);

      expect(mockScrollLines).toHaveBeenCalledWith(2); // ~32px / 15.6 line height
      expect(touchMoveEvent.preventDefault).toHaveBeenCalled();
    });

    it('does not scroll when touchmove delta is too small', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      const touchStartHandler = addedEventListeners.get('touchstart');
      const touchMoveHandler = addedEventListeners.get('touchmove');

      // Simulate touchstart
      const touchStartEvent = {
        touches: [{ clientY: 300 }],
      } as unknown as TouchEvent;

      touchStartHandler!(touchStartEvent);

      // Simulate touchmove with a small delta (less than one line height)
      const touchMoveEvent = {
        touches: [{ clientY: 295 }], // Only 5px delta
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      touchMoveHandler!(touchMoveEvent);

      // Should not scroll because delta is too small
      expect(mockScrollLines).not.toHaveBeenCalled();
      expect(touchMoveEvent.preventDefault).not.toHaveBeenCalled();
    });

    it('scrolls up (negative lines) when finger moves down', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      const touchStartHandler = addedEventListeners.get('touchstart');
      const touchMoveHandler = addedEventListeners.get('touchmove');

      // Simulate touchstart
      const touchStartEvent = {
        touches: [{ clientY: 300 }],
      } as unknown as TouchEvent;

      touchStartHandler!(touchStartEvent);

      // Simulate touchmove with finger moving down (scroll up/back in history)
      const touchMoveEvent = {
        touches: [{ clientY: 332 }], // 300 + 32 = finger moved down
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      touchMoveHandler!(touchMoveEvent);

      expect(mockScrollLines).toHaveBeenCalledWith(-2); // Negative = scroll up
    });

    it('ignores multi-touch gestures', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      const touchStartHandler = addedEventListeners.get('touchstart');
      const touchMoveHandler = addedEventListeners.get('touchmove');

      // Simulate touchstart with multiple touches (pinch gesture)
      const touchStartEvent = {
        touches: [{ clientY: 300 }, { clientY: 350 }],
      } as unknown as TouchEvent;

      touchStartHandler!(touchStartEvent);

      // Simulate touchmove with multiple touches
      const touchMoveEvent = {
        touches: [{ clientY: 268 }, { clientY: 318 }],
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      touchMoveHandler!(touchMoveEvent);

      // Should not scroll during multi-touch
      expect(mockScrollLines).not.toHaveBeenCalled();
    });

    it('stops scrolling after touchend', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      const touchStartHandler = addedEventListeners.get('touchstart');
      const touchMoveHandler = addedEventListeners.get('touchmove');
      const touchEndHandler = addedEventListeners.get('touchend');

      // Start touch
      touchStartHandler!({ touches: [{ clientY: 300 }] } as unknown as TouchEvent);

      // End touch
      touchEndHandler!({} as TouchEvent);

      // Try to move after touchend
      const touchMoveEvent = {
        touches: [{ clientY: 268 }],
        preventDefault: vi.fn(),
      } as unknown as TouchEvent;

      touchMoveHandler!(touchMoveEvent);

      // Should not scroll after touchend
      expect(mockScrollLines).not.toHaveBeenCalled();
    });

    it('accumulates scroll during continuous touch movement', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      const touchStartHandler = addedEventListeners.get('touchstart');
      const touchMoveHandler = addedEventListeners.get('touchmove');

      // Start at Y=300
      touchStartHandler!({ touches: [{ clientY: 300 }] } as unknown as TouchEvent);

      // Move up 16px (1 line) - Y=284
      touchMoveHandler!({
        touches: [{ clientY: 284 }],
        preventDefault: vi.fn(),
      } as unknown as TouchEvent);

      expect(mockScrollLines).toHaveBeenCalledWith(1);

      // Move up another 16px - Y=268
      touchMoveHandler!({
        touches: [{ clientY: 268 }],
        preventDefault: vi.fn(),
      } as unknown as TouchEvent);

      expect(mockScrollLines).toHaveBeenCalledTimes(2);
      expect(mockScrollLines).toHaveBeenLastCalledWith(1);
    });
  });

  describe('basic terminal operations', () => {
    it('initializes terminal and opens it in the container', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      expect(mockOpen).toHaveBeenCalledWith(mockContainer);
    });

    it('provides write function that writes to terminal', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      act(() => {
        result.current.write('Hello, World!');
      });

      expect(mockWrite).toHaveBeenCalledWith('Hello, World!');
    });

    it('provides focus function that focuses terminal', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      act(() => {
        result.current.focus();
      });

      expect(mockFocus).toHaveBeenCalled();
    });

    it('provides clear function that clears terminal', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      act(() => {
        result.current.clear();
      });

      expect(mockClear).toHaveBeenCalled();
    });

    it('provides fit function that fits terminal to container', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      mockFit.mockClear();

      act(() => {
        result.current.fit();
      });

      expect(mockFit).toHaveBeenCalled();
    });
  });

  describe('refresh method (terminal rendering fix)', () => {
    it('provides refresh function in hook return value', () => {
      const { result } = renderHook(() => useTerminal());

      expect(typeof result.current.refresh).toBe('function');
    });

    it('refresh calls terminal.refresh with correct arguments to refresh all visible lines', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      mockRefresh.mockClear();

      act(() => {
        result.current.refresh();
      });

      // refresh(0, rows - 1) refreshes all visible lines
      // rows = 24, so it should call refresh(0, 23)
      expect(mockRefresh).toHaveBeenCalledWith(0, 23);
    });

    it('refresh does nothing if terminal is not initialized', () => {
      const { result } = renderHook(() => useTerminal());

      // Call refresh without initializing terminal
      act(() => {
        result.current.refresh();
      });

      // Should not throw and should not call refresh
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('refresh can be called multiple times', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      mockRefresh.mockClear();

      act(() => {
        result.current.refresh();
        result.current.refresh();
        result.current.refresh();
      });

      // Should be callable multiple times (important for the queue mode fix)
      expect(mockRefresh).toHaveBeenCalledTimes(3);
    });

    it('refresh is idempotent after dispose', () => {
      const { result } = renderHook(() => useTerminal());

      act(() => {
        result.current.initTerminal(mockContainer);
      });

      act(() => {
        result.current.dispose();
      });

      mockRefresh.mockClear();

      // Should not throw when called after dispose
      act(() => {
        result.current.refresh();
      });

      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });
});
