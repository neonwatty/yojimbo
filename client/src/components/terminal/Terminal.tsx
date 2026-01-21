import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getWsUrl, getApiUrl } from '../../config';
import '@xterm/xterm/css/xterm.css';

export interface TerminalRef {
  focus: () => void;
  fit: () => void;
  refresh: () => void;
}

interface TerminalProps {
  instanceId: string;
  theme?: 'light' | 'dark';
  onStatusChange?: (status: string) => void;
}

export const Terminal = forwardRef<TerminalRef, TerminalProps>(
  ({ instanceId, theme = 'dark', onStatusChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isSubscribedRef = useRef(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const { send, subscribe, isConnected } = useWebSocket(getWsUrl(), {
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

    // Drag and drop handlers for file path insertion
    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      // Only set to false if we're leaving the container entirely
      if (!containerRef.current?.contains(e.relatedTarget as Node)) {
        setIsDragOver(false);
      }
    }, []);

    const handleDrop = useCallback(
      async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        // Upload each file and paste paths
        for (const file of files) {
          try {
            const response = await fetch(`${getApiUrl()}/api/filesystem/upload`, {
              method: 'POST',
              headers: { 'X-Filename': file.name },
              body: file,
            });

            if (!response.ok) {
              console.error('Failed to upload file:', file.name);
              continue;
            }

            const result = await response.json();
            if (result.success && result.data?.path) {
              // Escape spaces in paths for shell compatibility
              const escapedPath = result.data.path.replace(/ /g, '\\ ');
              // Add space after path so multiple drops are separated
              send('terminal:input', { instanceId, data: escapedPath + ' ' });
            }
          } catch (error) {
            console.error('Error uploading file:', file.name, error);
          }
        }
      },
      [instanceId, send]
    );

    const { initTerminal, write, fit, focus, refresh } = useTerminal({
      onData: handleData,
      onResize: handleResize,
      theme,
    });

    // Expose focus, fit, and refresh methods to parent via ref
    useImperativeHandle(ref, () => ({
      focus,
      fit,
      refresh,
    }), [focus, fit, refresh]);

  // Initialize terminal when container is ready
  useEffect(() => {
    if (containerRef.current) {
      initTerminal(containerRef.current);
      focus();
    }
  }, [initTerminal, focus]);

  // Refit terminal when theme changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fit();
    }, 50);
    return () => clearTimeout(timer);
  }, [theme, fit]);

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
        className={`h-full w-full ${isDragOver ? 'ring-2 ring-accent ring-inset' : ''}`}
        style={{
          backgroundColor: theme === 'dark' ? '#292c33' : '#ffffff',
          touchAction: 'pan-y',
        }}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
    );
  }
);

Terminal.displayName = 'Terminal';
