import { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useWebSocket, type WSMessage } from '../hooks/use-websocket';
import { useAppStore } from '../stores/app-store';
import 'xterm/css/xterm.css';

interface InstanceTerminalProps {
  instanceId: string;
  className?: string;
}

export function InstanceTerminal({ instanceId, className = '' }: InstanceTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const preferences = useAppStore((state) => state.preferences);

  const handleWebSocketMessage = useCallback(
    (message: WSMessage) => {
      if (!terminalRef.current) return;

      if (message.type === 'terminal-output') {
        const payload = message.payload as { terminalId: string; data: string };
        if (payload.terminalId === instanceId) {
          terminalRef.current.write(payload.data);
        }
      }
    },
    [instanceId]
  );

  const { isConnected, subscribe, unsubscribe, sendTerminalInput, sendTerminalResize } =
    useWebSocket({
      onMessage: handleWebSocketMessage,
    });

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return;

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
      sendTerminalInput(instanceId, data);
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [instanceId, preferences.terminalFontSize, preferences.terminalFontFamily, sendTerminalInput]);

  // Subscribe to terminal when connected
  useEffect(() => {
    if (isConnected) {
      subscribe(instanceId);
      return () => {
        unsubscribe(instanceId);
      };
    }
  }, [isConnected, instanceId, subscribe, unsubscribe]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        sendTerminalResize(instanceId, terminalRef.current.cols, terminalRef.current.rows);
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
  }, [instanceId, sendTerminalResize]);

  return (
    <div className={`relative w-full h-full min-h-0 ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-theme-muted text-sm">Connecting...</span>
        </div>
      )}
    </div>
  );
}
