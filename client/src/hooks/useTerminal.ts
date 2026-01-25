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
  fontSize?: number;
}

// Ghostty default dark theme colors
// Source: https://github.com/ghostty-org/ghostty/discussions/5390
//
// Note: Using color(srgb ...) syntax for explicit sRGB color space specification.
// This helps ensure consistent color rendering across devices with different
// display capabilities (sRGB vs Display P3 like iPhone).
// Fallback hex values are provided for browsers that don't support color().
//
// The color(srgb r g b) values are derived from hex by converting each channel
// from 0-255 to 0-1 (e.g., #29 = 41/255 = 0.161)
const darkTheme = {
  background: 'color(srgb 0.161 0.173 0.200)', // #292c33
  foreground: 'color(srgb 1 1 1)', // #ffffff
  cursor: 'color(srgb 1 1 1)', // #ffffff
  cursorAccent: 'color(srgb 0.212 0.227 0.263)', // #363a43
  selectionBackground: 'color(srgb 1 1 1)', // #ffffff
  selectionForeground: 'color(srgb 0.161 0.173 0.200)', // #292c33
  black: 'color(srgb 0.114 0.122 0.129)', // #1d1f21
  red: 'color(srgb 0.749 0.420 0.412)', // #bf6b69
  green: 'color(srgb 0.718 0.741 0.451)', // #b7bd73
  yellow: 'color(srgb 0.914 0.784 0.502)', // #e9c880
  blue: 'color(srgb 0.533 0.631 0.733)', // #88a1bb
  magenta: 'color(srgb 0.678 0.584 0.722)', // #ad95b8
  cyan: 'color(srgb 0.584 0.741 0.718)', // #95bdb7
  white: 'color(srgb 0.773 0.784 0.776)', // #c5c8c6
  brightBlack: 'color(srgb 0.400 0.400 0.400)', // #666666
  brightRed: 'color(srgb 0.773 0.341 0.341)', // #c55757
  brightGreen: 'color(srgb 0.737 0.788 0.373)', // #bcc95f
  brightYellow: 'color(srgb 0.882 0.776 0.369)', // #e1c65e
  brightBlue: 'color(srgb 0.514 0.647 0.839)', // #83a5d6
  brightMagenta: 'color(srgb 0.737 0.600 0.831)', // #bc99d4
  brightCyan: 'color(srgb 0.514 0.745 0.694)', // #83beb1
  brightWhite: 'color(srgb 0.918 0.918 0.918)', // #eaeaea
};

const lightTheme = {
  background: 'color(srgb 1 1 1)', // #ffffff
  foreground: 'color(srgb 0.216 0.376 0.749)', // #3760bf
  cursor: 'color(srgb 0.216 0.376 0.749)', // #3760bf
  cursorAccent: 'color(srgb 1 1 1)', // #ffffff
  selectionBackground: 'color(srgb 0.600 0.655 0.875)', // #99a7df
  black: 'color(srgb 0.914 0.914 0.929)', // #e9e9ed
  red: 'color(srgb 0.961 0.165 0.396)', // #f52a65
  green: 'color(srgb 0.345 0.459 0.224)', // #587539
  yellow: 'color(srgb 0.549 0.424 0.243)', // #8c6c3e
  blue: 'color(srgb 0.180 0.490 0.914)', // #2e7de9
  magenta: 'color(srgb 0.596 0.329 0.945)', // #9854f1
  cyan: 'color(srgb 0 0.443 0.592)', // #007197
  white: 'color(srgb 0.380 0.447 0.690)', // #6172b0
  brightBlack: 'color(srgb 0.631 0.651 0.773)', // #a1a6c5
  brightRed: 'color(srgb 0.961 0.165 0.396)', // #f52a65
  brightGreen: 'color(srgb 0.345 0.459 0.224)', // #587539
  brightYellow: 'color(srgb 0.549 0.424 0.243)', // #8c6c3e
  brightBlue: 'color(srgb 0.180 0.490 0.914)', // #2e7de9
  brightMagenta: 'color(srgb 0.596 0.329 0.945)', // #9854f1
  brightCyan: 'color(srgb 0 0.443 0.592)', // #007197
  brightWhite: 'color(srgb 0.216 0.376 0.749)', // #3760bf
};

export function useTerminal(options: UseTerminalOptions = {}) {
  const { onData, onResize, theme = 'dark', fontSize = 13 } = options;

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
        fontSize,
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

      // Send initial terminal size to server
      // This is important for SSH sessions where the remote needs accurate dimensions
      if (onResize) {
        onResize(terminal.cols, terminal.rows);
      }

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
        const lineHeight = fontSize * 1.2; // fontSize * lineHeight from terminal config
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
    [onData, onResize, theme, fontSize]
  );

  const write = useCallback((data: string) => {
    // Filter out Cursor Position Report (CPR) sequences that may leak through
    // CPR format: ESC[row;colR - these are terminal responses to DSR queries (ESC[6n)
    // Some may slip through server-side filtering due to TCP packet splitting
    //
    // CPR sequences can fragment in many ways when split across packets:
    // - Complete: \x1b[23;4R or [23;4R
    // - Partial with semicolon: [23; or [23;4 or ;4R
    // - Interleaved fragments: 23[4 (digit-bracket-digit from split sequences)
    //
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
    filtered = filtered.replace(/^[\d\[;\]R\s]+$/gm, '');
    // Clean up empty lines that resulted from filtering
    filtered = filtered.replace(/\n{3,}/g, '\n\n');

    // Debug: Detect potential blank line issues
    // Enable with localStorage.setItem('DEBUG_ANIMATION', '1')
    const DEBUG = localStorage.getItem('DEBUG_ANIMATION') === '1';
    if (DEBUG) {
      // eslint-disable-next-line no-control-regex
      const startCount = (filtered.match(/\x1b\[\?2026h/g) || []).length;
      // eslint-disable-next-line no-control-regex
      const endCount = (filtered.match(/\x1b\[\?2026l/g) || []).length;
      const hasEmptyLine = /\n\s*\n/.test(filtered);
      // eslint-disable-next-line no-control-regex
      const hasCursorUp = /\x1b\[\d*A/.test(filtered);

      if (startCount > 0 || endCount > 0 || hasEmptyLine) {
        console.log('[TERM] write:', {
          len: filtered.length,
          syncStart: startCount,
          syncEnd: endCount,
          balanced: startCount === endCount,
          hasEmptyLine,
          hasCursorUp,
          preview: JSON.stringify(filtered.slice(0, 150)),
        });

        // Alert on unbalanced sync frames (the bug we're looking for)
        if (startCount !== endCount) {
          console.warn('[TERM] UNBALANCED SYNC FRAME DETECTED!', {
            startCount,
            endCount,
            fullData: JSON.stringify(filtered),
          });
        }
      }
    }

    // Write filtered data to terminal - sync frame buffering is handled
    // at the server level in the SSH backend to ensure complete
    // frames are sent as atomic units over WebSocket
    terminalRef.current?.write(filtered);
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

  const refresh = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.refresh(0, terminalRef.current.rows - 1);
    }
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

  // Update font size when it changes
  useEffect(() => {
    if (terminalRef.current && isInitializedRef.current) {
      terminalRef.current.options.fontSize = fontSize;
      // Refit to recalculate columns/rows with new font size
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }
  }, [fontSize]);

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
    refresh,
    dispose,
    terminal: terminalRef.current,
  };
}
