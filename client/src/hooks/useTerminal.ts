import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

interface UseTerminalOptions {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  theme?: 'light' | 'dark';
}

const darkTheme = {
  background: '#1a1b26',
  foreground: '#a9b1d6',
  cursor: '#c0caf5',
  cursorAccent: '#1a1b26',
  selectionBackground: '#33467c',
  black: '#32344a',
  red: '#f7768e',
  green: '#9ece6a',
  yellow: '#e0af68',
  blue: '#7aa2f7',
  magenta: '#ad8ee6',
  cyan: '#449dab',
  white: '#787c99',
  brightBlack: '#444b6a',
  brightRed: '#ff7a93',
  brightGreen: '#b9f27c',
  brightYellow: '#ff9e64',
  brightBlue: '#7da6ff',
  brightMagenta: '#bb9af7',
  brightCyan: '#0db9d7',
  brightWhite: '#acb0d0',
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
  const isInitializedRef = useRef(false);

  const initTerminal = useCallback(
    (container: HTMLDivElement) => {
      if (terminalRef.current) return;

      containerRef.current = container;

      const terminal = new Terminal({
        cursorBlink: true,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.2,
        theme: theme === 'dark' ? darkTheme : lightTheme,
        allowProposedApi: true,
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      terminal.open(container);
      fitAddon.fit();

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Handle data input
      if (onData) {
        terminal.onData(onData);
      }

      // Handle resize
      resizeObserverRef.current = new ResizeObserver(() => {
        if (fitAddonRef.current && terminalRef.current) {
          fitAddonRef.current.fit();
          if (onResize) {
            onResize(terminalRef.current.cols, terminalRef.current.rows);
          }
        }
      });
      resizeObserverRef.current.observe(container);

      isInitializedRef.current = true;
    },
    [onData, onResize, theme]
  );

  const write = useCallback((data: string) => {
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
      terminalRef.current.refresh();
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
