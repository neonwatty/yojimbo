import { useEffect, useRef, useCallback } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useWebSocket } from '../../hooks/useWebSocket';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  instanceId: string;
  theme?: 'light' | 'dark';
  onStatusChange?: (status: string) => void;
}

const WS_URL = `ws://${window.location.hostname}:3456`;

export function Terminal({ instanceId, theme = 'dark', onStatusChange }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSubscribedRef = useRef(false);

  const { send, subscribe, isConnected } = useWebSocket(WS_URL, {
    onOpen: () => {
      console.log('WebSocket connected');
    },
    onClose: () => {
      console.log('WebSocket disconnected');
    },
  });

  const handleData = useCallback(
    (data: string) => {
      send('terminal:input', { instanceId, data });
    },
    [instanceId, send]
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      send('terminal:resize', { instanceId, cols, rows });
    },
    [instanceId, send]
  );

  const { initTerminal, write, fit, focus } = useTerminal({
    onData: handleData,
    onResize: handleResize,
    theme,
  });

  // Initialize terminal when container is ready
  useEffect(() => {
    if (containerRef.current) {
      initTerminal(containerRef.current);
      focus();
    }
  }, [initTerminal, focus]);

  // Subscribe to terminal output
  useEffect(() => {
    if (!isConnected || isSubscribedRef.current) return;

    // Subscribe to this instance
    send('subscribe', { instanceId });
    isSubscribedRef.current = true;

    // Handle terminal output
    const unsubscribeOutput = subscribe('terminal:output', (data: unknown) => {
      const { instanceId: msgInstanceId, data: output } = data as {
        instanceId: string;
        data: string;
      };
      if (msgInstanceId === instanceId) {
        write(output);
      }
    });

    // Handle status changes
    const unsubscribeStatus = subscribe('status:changed', (data: unknown) => {
      const { instanceId: msgInstanceId, status } = data as {
        instanceId: string;
        status: string;
      };
      if (msgInstanceId === instanceId) {
        onStatusChange?.(status);
      }
    });

    return () => {
      unsubscribeOutput();
      unsubscribeStatus();
      send('unsubscribe', { instanceId });
      isSubscribedRef.current = false;
    };
  }, [isConnected, instanceId, send, subscribe, write, onStatusChange]);

  // Refit on visibility change (e.g., tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fit();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fit]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{ backgroundColor: theme === 'dark' ? '#1a1b26' : '#ffffff' }}
    />
  );
}
