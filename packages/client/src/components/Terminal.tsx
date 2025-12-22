import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalProps {
  terminalId: string;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  fontSize?: number;
  fontFamily?: string;
  className?: string;
}

export function Terminal({
  terminalId,
  onData,
  onResize,
  fontSize = 14,
  fontFamily = 'JetBrains Mono, monospace',
  className = '',
}: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Handle terminal data output
  const handleData = useCallback(
    (data: string) => {
      onData?.(data);
    },
    [onData]
  );

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new XTerm({
      fontSize,
      fontFamily,
      theme: {
        background: '#0a0a0b',
        foreground: '#ffffff',
        cursor: '#f59e0b',
        cursorAccent: '#0a0a0b',
        selectionBackground: 'rgba(245, 158, 11, 0.3)',
        black: '#0a0a0b',
        red: '#f43f5e',
        green: '#22c55e',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#ffffff',
        brightBlack: '#6b7280',
        brightRed: '#fb7185',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    // Handle user input
    terminal.onData(handleData);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Initial resize notification
    onResize?.(terminal.cols, terminal.rows);

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [fontSize, fontFamily, handleData, onResize]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        onResize?.(terminalRef.current.cols, terminalRef.current.rows);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [onResize]);

  return (
    <div
      ref={containerRef}
      className={`terminal-container w-full h-full min-h-0 ${className}`}
      data-terminal-id={terminalId}
    />
  );
}

// Expose method to write data to terminal
export function useTerminalWriter(terminalId: string) {
  const write = useCallback(
    (data: string) => {
      const container = document.querySelector(`[data-terminal-id="${terminalId}"]`);
      if (container) {
        // Access the terminal instance through a custom event
        container.dispatchEvent(new CustomEvent('terminal-write', { detail: data }));
      }
    },
    [terminalId]
  );

  return { write };
}
