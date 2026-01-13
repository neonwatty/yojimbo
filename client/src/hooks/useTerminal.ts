import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

// Debounce helper
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

interface UseTerminalOptions {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  theme?: 'light' | 'dark';
}

// Ghostty default dark theme colors
// Source: https://github.com/ghostty-org/ghostty/discussions/5390
const darkTheme = {
  background: '#292c33',
  foreground: '#ffffff',
  cursor: '#ffffff',
  cursorAccent: '#363a43',
  selectionBackground: '#ffffff',
  selectionForeground: '#292c33',
  black: '#1d1f21',
  red: '#bf6b69',
  green: '#b7bd73',
  yellow: '#e9c880',
  blue: '#88a1bb',
  magenta: '#ad95b8',
  cyan: '#95bdb7',
  white: '#c5c8c6',
  brightBlack: '#666666',
  brightRed: '#c55757',
  brightGreen: '#bcc95f',
  brightYellow: '#e1c65e',
  brightBlue: '#83a5d6',
  brightMagenta: '#bc99d4',
  brightCyan: '#83beb1',
  brightWhite: '#eaeaea',
};

const lightTheme = {
  background: '#ffffff',
  foreground: '#3760bf',
  cursor: '#3760bf',
  cursorAccent: '#ffffff',
  selectionBackground: '#99a7df',
  black: '#e9e9ed',
  red: '#f52a65',
  green: '#587539',
  yellow: '#8c6c3e',
  blue: '#2e7de9',
  magenta: '#9854f1',
  cyan: '#007197',
  white: '#6172b0',
  brightBlack: '#a1a6c5',
  brightRed: '#f52a65',
  brightGreen: '#587539',
  brightYellow: '#8c6c3e',
  brightBlue: '#2e7de9',
  brightMagenta: '#9854f1',
  brightCyan: '#007197',
  brightWhite: '#3760bf',
};

export function useTerminal(options: UseTerminalOptions = {}) {
  const { onData, onResize, theme = 'dark' } = options;

  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const isInitializedRef = useRef<boolean>(false);


  const initTerminal = useCallback(
    (container: HTMLDivElement) => {
      if (terminalRef.current) return;

      containerRef.current = container;

      const terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        cursorInactiveStyle: 'outline',
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        theme: theme === 'dark' ? darkTheme : lightTheme,
        allowProposedApi: true,
        scrollback: 10000,
        // Convert bare \n to \r\n - helps with SSH connections where
        // the remote shell may output \n without \r
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      terminal.open(container);
      fitAddon.fit();

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Mobile touch scrolling support
      // xterm.js doesn't natively support touch scrolling, so we implement it manually
      // See: https://github.com/xtermjs/xterm.js/issues/5377
      let touchStartY = 0;
      let lastTouchY = 0;
      let isTouchScrolling = false;

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          touchStartY = e.touches[0].clientY;
          lastTouchY = touchStartY;
          isTouchScrolling = true;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isTouchScrolling || e.touches.length !== 1) return;

        const currentY = e.touches[0].clientY;
        const deltaY = lastTouchY - currentY;
        lastTouchY = currentY;

        // Calculate lines to scroll based on delta
        // Use line height (fontSize * lineHeight) to determine scroll amount
        const lineHeight = 13 * 1.2; // fontSize * lineHeight from terminal config
        const linesToScroll = Math.round(deltaY / lineHeight);

        if (linesToScroll !== 0 && terminalRef.current) {
          terminalRef.current.scrollLines(linesToScroll);
          // Prevent default to stop page scrolling while scrolling terminal
          e.preventDefault();
        }
      };

      const handleTouchEnd = () => {
        isTouchScrolling = false;
      };

      // Add touch event listeners to the terminal's element
      const terminalElement = container.querySelector('.xterm-screen');
      if (terminalElement) {
        terminalElement.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true });
        terminalElement.addEventListener('touchmove', handleTouchMove as EventListener, { passive: false });
        terminalElement.addEventListener('touchend', handleTouchEnd as EventListener, { passive: true });
      }

      // Handle data input
      if (onData) {
        terminal.onData(onData);
      }

      // Handle resize with debounce to prevent text corruption during rapid resizing
      const debouncedResize = debounce(() => {
        if (fitAddonRef.current && terminalRef.current) {
          fitAddonRef.current.fit();
          if (onResize) {
            onResize(terminalRef.current.cols, terminalRef.current.rows);
          }
        }
      }, 100);

      resizeObserverRef.current = new ResizeObserver(debouncedResize);
      resizeObserverRef.current.observe(container);

      isInitializedRef.current = true;
    },
    [onData, onResize, theme]
  );

  const write = useCallback((data: string) => {
    // Debug: Detect potential blank line issues
    // Enable with localStorage.setItem('DEBUG_ANIMATION', '1')
    const DEBUG = localStorage.getItem('DEBUG_ANIMATION') === '1';
    if (DEBUG) {
      // eslint-disable-next-line no-control-regex
      const startCount = (data.match(/\x1b\[\?2026h/g) || []).length;
      // eslint-disable-next-line no-control-regex
      const endCount = (data.match(/\x1b\[\?2026l/g) || []).length;
      const hasEmptyLine = /\n\s*\n/.test(data);
      // eslint-disable-next-line no-control-regex
      const hasCursorUp = /\x1b\[\d*A/.test(data);

      if (startCount > 0 || endCount > 0 || hasEmptyLine) {
        console.log('[TERM] write:', {
          len: data.length,
          syncStart: startCount,
          syncEnd: endCount,
          balanced: startCount === endCount,
          hasEmptyLine,
          hasCursorUp,
          preview: JSON.stringify(data.slice(0, 150)),
        });

        // Alert on unbalanced sync frames (the bug we're looking for)
        if (startCount !== endCount) {
          console.warn('[TERM] UNBALANCED SYNC FRAME DETECTED!', {
            startCount,
            endCount,
            fullData: JSON.stringify(data),
          });
        }
      }
    }

    // Write directly to terminal - sync frame buffering is handled
    // at the server level in the SSH backend to ensure complete
    // frames are sent as atomic units over WebSocket
    terminalRef.current?.write(data);
  }, []);

  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const fit = useCallback(() => {
    fitAddonRef.current?.fit();
  }, []);

  const dispose = useCallback(() => {
    resizeObserverRef.current?.disconnect();
    terminalRef.current?.dispose();
    terminalRef.current = null;
    fitAddonRef.current = null;
  }, []);

  // Update theme when it changes
  useEffect(() => {
    if (terminalRef.current && isInitializedRef.current) {
      terminalRef.current.options.theme = theme === 'dark' ? darkTheme : lightTheme;
      terminalRef.current.refresh(0, terminalRef.current.rows - 1);
    }
  }, [theme]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  return {
    initTerminal,
    write,
    clear,
    focus,
    fit,
    dispose,
    terminal: terminalRef.current,
  };
}
