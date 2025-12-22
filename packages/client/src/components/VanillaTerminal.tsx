import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useWebSocket, type WSMessage } from '../hooks/use-websocket';
import { useAppStore } from '../stores/app-store';
import 'xterm/css/xterm.css';

interface VanillaTerminalProps {
  workingDir: string;
  className?: string;
}

const API_BASE = 'http://localhost:3001';

export function VanillaTerminal({ workingDir, className = '' }: VanillaTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isSpawning, setIsSpawning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const preferences = useAppStore((state) => state.preferences);

  const handleWebSocketMessage = useCallback(
    (message: WSMessage) => {
      if (!terminalRef.current) return;

      if (message.type === 'vanilla-terminal-output') {
        const payload = message.payload as { workingDir: string; data: string };
        if (payload.workingDir === workingDir) {
          terminalRef.current.write(payload.data);
        }
      }
    },
    [workingDir]
  );

  const {
    isConnected,
    subscribeVanillaTerminal,
    unsubscribeVanillaTerminal,
    sendVanillaTerminalInput,
    sendVanillaTerminalResize,
  } = useWebSocket({
    onMessage: handleWebSocketMessage,
  });

  // Spawn vanilla terminal on mount
  useEffect(() => {
    const spawnTerminal = async () => {
      try {
        setIsSpawning(true);
        setError(null);
        const response = await fetch(`${API_BASE}/api/vanilla-terminal/spawn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workingDir }),
        });

        if (!response.ok) {
          throw new Error('Failed to spawn terminal');
        }

        setIsSpawning(false);
      } catch (err) {
        setError((err as Error).message);
        setIsSpawning(false);
      }
    };

    spawnTerminal();
  }, [workingDir]);

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || isSpawning) return;

    const terminal = new XTerm({
      fontSize: preferences.terminalFontSize,
      fontFamily: `${preferences.terminalFontFamily}, monospace`,
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

    // Handle user input - send to server
    terminal.onData((data) => {
      sendVanillaTerminalInput(workingDir, data);
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [
    workingDir,
    isSpawning,
    preferences.terminalFontSize,
    preferences.terminalFontFamily,
    sendVanillaTerminalInput,
  ]);

  // Subscribe to terminal when connected and spawned
  useEffect(() => {
    if (isConnected && !isSpawning) {
      subscribeVanillaTerminal(workingDir);
      return () => {
        unsubscribeVanillaTerminal(workingDir);
      };
    }
  }, [isConnected, isSpawning, workingDir, subscribeVanillaTerminal, unsubscribeVanillaTerminal]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        sendVanillaTerminalResize(workingDir, terminalRef.current.cols, terminalRef.current.rows);
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
  }, [workingDir, sendVanillaTerminalResize]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-surface-900 ${className}`}>
        <span className="text-red-400 text-sm">Error: {error}</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-0 ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {(isSpawning || !isConnected) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-theme-muted text-sm">
            {isSpawning ? 'Starting terminal...' : 'Connecting...'}
          </span>
        </div>
      )}
    </div>
  );
}
