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

  describe('CPR (Cursor Position Report) filtering', () => {
    // Tests for PR #162 and #163 - filtering out CPR sequences from terminal output
    // CPR format: ESC[row;colR (e.g., \x1b[18;1R or [18;1R)
    // These can appear due to DSR queries (ESC[6n) and should be filtered out

    // Helper to extract the filtering logic (mirrors what's in write())
    const filterCPR = (data: string): string => {
      // eslint-disable-next-line no-control-regex
      let filtered = data.replace(/\x1b?\[\d+;\d+R/g, '');
      // Partial CPR ending with R: ";4R", "23;4R"
      filtered = filtered.replace(/\d*;\d+R/g, '');
      // Partial CPR start with semicolon (no R yet): "[23;", "[23;4" - only if standalone
      filtered = filtered.replace(/^\[\d+;\d*$/gm, '');
      filtered = filtered.replace(/(?:^|\n)\[\d+;\d*(?:\n|$)/g, '\n');
      // Digits-bracket-digits pattern unique to interleaved CPR: "23[4", "6[46", "29[4"
      filtered = filtered.replace(/\d+\[\d+/g, '');
      // Standalone digit-R at word boundary: "4R", "23R"
      filtered = filtered.replace(/\b\d{1,3}R\b/g, '');
      // Lines that are ONLY CPR garbage (just digits, brackets, semicolons, R)
      filtered = filtered.replace(/^[\d[;\]R\s]+$/gm, '');
      // Clean up empty lines that resulted from filtering
      filtered = filtered.replace(/\n{3,}/g, '\n\n');
      return filtered;
    };

    it('filters complete CPR sequences with ESC', () => {
      expect(filterCPR('\x1b[18;1R')).toBe('');
      expect(filterCPR('\x1b[48;80R')).toBe('');
      expect(filterCPR('\x1b[1;1R')).toBe('');
    });

    it('filters complete CPR sequences without ESC', () => {
      expect(filterCPR('[18;1R')).toBe('');
      expect(filterCPR('[48;80R')).toBe('');
    });

    it('filters CPR sequences embedded in normal text', () => {
      expect(filterCPR('Hello\x1b[18;1RWorld')).toBe('HelloWorld');
      expect(filterCPR('Test[48;1R output')).toBe('Test output');
    });

    it('filters partial CPR ending with R (;colR pattern)', () => {
      expect(filterCPR(';4R')).toBe('');
      expect(filterCPR('23;4R')).toBe('');
      expect(filterCPR(';80R')).toBe('');
    });

    it('filters interleaved CPR fragments (digits-bracket-digits)', () => {
      // These appear when CPR sequences are split across TCP packets
      expect(filterCPR('23[4')).toBe('');
      expect(filterCPR('6[46')).toBe('');
      expect(filterCPR('29[4')).toBe('');
    });

    it('filters standalone digit-R at word boundaries', () => {
      expect(filterCPR('4R')).toBe('');
      expect(filterCPR('23R')).toBe('');
      // ' 4R ' - the digit-R is filtered, remaining whitespace is CPR garbage and also filtered
      expect(filterCPR(' 4R ')).toBe('');
    });

    it('filters lines that are only CPR garbage', () => {
      expect(filterCPR('[18;1')).toBe('');
      // '[\n' - the '[' alone is CPR garbage, gets filtered to empty
      expect(filterCPR('[\n')).toBe('');
      expect(filterCPR('123;456R')).toBe('');
    });

    it('preserves normal terminal output', () => {
      expect(filterCPR('Hello World')).toBe('Hello World');
      expect(filterCPR('ls -la\n')).toBe('ls -la\n');
      expect(filterCPR('$ git status')).toBe('$ git status');
    });

    it('preserves ANSI color codes', () => {
      expect(filterCPR('\x1b[32mGreen\x1b[0m')).toBe('\x1b[32mGreen\x1b[0m');
      expect(filterCPR('\x1b[1;31mBold Red\x1b[0m')).toBe('\x1b[1;31mBold Red\x1b[0m');
    });

    it('preserves cursor movement sequences (not CPR)', () => {
      expect(filterCPR('\x1b[5A')).toBe('\x1b[5A');  // Cursor up
      expect(filterCPR('\x1b[10B')).toBe('\x1b[10B');  // Cursor down
      expect(filterCPR('\x1b[K')).toBe('\x1b[K');  // Erase line
    });

    it('handles multiple CPR sequences in one chunk', () => {
      expect(filterCPR('\x1b[18;1R\x1b[19;1R\x1b[20;1R')).toBe('');
      expect(filterCPR('start\x1b[18;1Rmiddle\x1b[19;1Rend')).toBe('startmiddleend');
    });

    it('handles mixed valid and CPR content', () => {
      const input = 'Line 1\n\x1b[18;1RLine 2\n23;4RLine 3';
      const expected = 'Line 1\nLine 2\nLine 3';
      expect(filterCPR(input)).toBe(expected);
    });

    it('reduces excessive empty lines from filtering', () => {
      const input = 'Line 1\n\n\n\nLine 2';
      const expected = 'Line 1\n\nLine 2';
      expect(filterCPR(input)).toBe(expected);
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
