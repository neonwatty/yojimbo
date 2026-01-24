import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
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
  fontSize?: number;
  onStatusChange?: (status: string) => void;
}

export const Terminal = forwardRef<TerminalRef, TerminalProps>(
  ({ instanceId, theme = 'dark', fontSize = 13, onStatusChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
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

    const handleData = (data: string) => {
      send('terminal:input', { instanceId, data });
    };

    const handleResize = (cols: number, rows: number) => {
      send('terminal:resize', { instanceId, cols, rows });
    };

    // Native DOM drag and drop handlers (bypasses React's synthetic event system)
    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      let dragCounter = 0;

      const handleDragEnter = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        if (dragCounter === 1) {
          setIsDragOver(true);
        }
      };

      const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
      };

      const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter === 0) {
          setIsDragOver(false);
        }
      };

      const handleDrop = async (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        setIsDragOver(false);

        const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
        if (files.length === 0) return;

        // Upload each file and paste paths
        for (const file of files) {
          try {
            const url = `${getApiUrl()}/api/filesystem/upload`;

            const response = await fetch(url, {
              method: 'POST',
              headers: { 'X-Filename': encodeURIComponent(file.name) },
              body: file,
            });

            if (!response.ok) {
              console.error('Failed to upload file:', file.name, response.status);
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
      };

      // Use capture phase to intercept events before xterm.js can handle them
      wrapper.addEventListener('dragenter', handleDragEnter, true);
      wrapper.addEventListener('dragover', handleDragOver, true);
      wrapper.addEventListener('dragleave', handleDragLeave, true);
      wrapper.addEventListener('drop', handleDrop, true);

      return () => {
        wrapper.removeEventListener('dragenter', handleDragEnter, true);
        wrapper.removeEventListener('dragover', handleDragOver, true);
        wrapper.removeEventListener('dragleave', handleDragLeave, true);
        wrapper.removeEventListener('drop', handleDrop, true);
      };
    }, [instanceId, send]);

    const { initTerminal, write, fit, focus, refresh } = useTerminal({
      onData: handleData,
      onResize: handleResize,
      theme,
      fontSize,
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
        ref={wrapperRef}
        className="relative h-full w-full"
      >
        <div
          ref={containerRef}
          className="h-full w-full"
          style={{
            // Use explicit sRGB color space for consistent rendering across display types (sRGB vs Display P3)
            backgroundColor: theme === 'dark' ? 'color(srgb 0.161 0.173 0.200)' : 'color(srgb 1 1 1)',
            touchAction: 'pan-y',
          }}
        />
        {/* Overlay that appears during drag to show visual feedback */}
        {isDragOver && (
          <div
            className="absolute inset-0 bg-accent/10 ring-2 ring-accent ring-inset flex items-center justify-center pointer-events-none"
          >
            <div className="text-accent font-medium">
              Drop file to paste path
            </div>
          </div>
        )}
      </div>
    );
  }
);

Terminal.displayName = 'Terminal';
