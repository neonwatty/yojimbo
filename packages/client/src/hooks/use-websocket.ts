import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = 'ws://localhost:3001/ws';
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export type WSMessageType =
  | 'connected'
  | 'terminal-output'
  | 'terminal-exit'
  | 'instance-status'
  | 'vanilla-terminal-output'
  | 'error';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
}

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (message: WSMessage) => void;
  subscribe: (terminalId: string) => void;
  unsubscribe: (terminalId: string) => void;
  sendTerminalInput: (terminalId: string, data: string) => void;
  sendTerminalResize: (terminalId: string, cols: number, rows: number) => void;
  // Vanilla terminal methods
  subscribeVanillaTerminal: (workingDir: string) => void;
  unsubscribeVanillaTerminal: (workingDir: string) => void;
  sendVanillaTerminalInput: (workingDir: string, data: string) => void;
  sendVanillaTerminalResize: (workingDir: string, cols: number, rows: number) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { onMessage, onConnect, onDisconnect, autoConnect = true } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY);
  const mountedRef = useRef(true);

  const [isConnected, setIsConnected] = useState(false);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    clearReconnectTimeout();

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        reconnectDelayRef.current = RECONNECT_DELAY;
        onConnect?.();
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        onDisconnect?.();

        // Auto-reconnect with exponential backoff
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            reconnectDelayRef.current = Math.min(
              reconnectDelayRef.current * 2,
              MAX_RECONNECT_DELAY
            );
            connect();
          }
        }, reconnectDelayRef.current);
      };

      ws.onerror = () => {
        // Error will trigger onclose, which handles reconnection
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const message = JSON.parse(event.data) as WSMessage;
          onMessage?.(message);
        } catch {
          console.error('Failed to parse WebSocket message');
        }
      };

      wsRef.current = ws;
    } catch {
      // Connection failed, will retry
    }
  }, [clearReconnectTimeout, onConnect, onDisconnect, onMessage]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearReconnectTimeout]);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback(
    (terminalId: string) => {
      send({ type: 'terminal-subscribe' as WSMessageType, payload: { terminalId } });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (terminalId: string) => {
      send({ type: 'terminal-unsubscribe' as WSMessageType, payload: { terminalId } });
    },
    [send]
  );

  const sendTerminalInput = useCallback(
    (terminalId: string, data: string) => {
      send({ type: 'terminal-input' as WSMessageType, payload: { terminalId, data } });
    },
    [send]
  );

  const sendTerminalResize = useCallback(
    (terminalId: string, cols: number, rows: number) => {
      send({ type: 'terminal-resize' as WSMessageType, payload: { terminalId, cols, rows } });
    },
    [send]
  );

  // Vanilla terminal methods
  const subscribeVanillaTerminal = useCallback(
    (workingDir: string) => {
      send({ type: 'vanilla-terminal-subscribe' as WSMessageType, payload: { workingDir } });
    },
    [send]
  );

  const unsubscribeVanillaTerminal = useCallback(
    (workingDir: string) => {
      send({ type: 'vanilla-terminal-unsubscribe' as WSMessageType, payload: { workingDir } });
    },
    [send]
  );

  const sendVanillaTerminalInput = useCallback(
    (workingDir: string, data: string) => {
      send({ type: 'vanilla-terminal-input' as WSMessageType, payload: { workingDir, data } });
    },
    [send]
  );

  const sendVanillaTerminalResize = useCallback(
    (workingDir: string, cols: number, rows: number) => {
      send({ type: 'vanilla-terminal-resize' as WSMessageType, payload: { workingDir, cols, rows } });
    },
    [send]
  );

  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    send,
    subscribe,
    unsubscribe,
    sendTerminalInput,
    sendTerminalResize,
    subscribeVanillaTerminal,
    unsubscribeVanillaTerminal,
    sendVanillaTerminalInput,
    sendVanillaTerminalResize,
    connect,
    disconnect,
  };
}
