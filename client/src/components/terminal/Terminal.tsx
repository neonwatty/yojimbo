import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useInstancesStore } from '../../store/instancesStore';
import { toast } from '../../store/toastStore';
import { getWsUrl } from '../../config';
import '@xterm/xterm/css/xterm.css';

export interface TerminalRef {
  focus: () => void;
  fit: () => void;
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
    const inputLockStatus = useInstancesStore((state) => state.inputLockStatus);
    const setInputLockStatus = useInstancesStore((state) => state.setInputLockStatus);
    const clearInputLockStatus = useInstancesStore((state) => state.clearInputLockStatus);

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
        const lockStatus = inputLockStatus[instanceId];
        // If we don't have the lock (and lock status exists), show toast and discard input
        if (lockStatus && !lockStatus.hasLock) {
          toast.info(`Input locked by ${lockStatus.lockHolder || 'another device'}`);
          return;
        }
        send('terminal:input', { instanceId, data });
      },
      [instanceId, send, inputLockStatus]
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

    // Expose focus and fit methods to parent via ref
    useImperativeHandle(ref, () => ({
      focus,
      fit,
    }), [focus, fit]);

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

    // Handle lock events - these come from this WebSocket's subscribe
    const unsubscribeLockGranted = subscribe('input:lockGranted', (data: unknown) => {
      const { instanceId: msgInstanceId } = data as { instanceId: string };
      if (msgInstanceId === instanceId) {
        setInputLockStatus(instanceId, true);
      }
    });

    const unsubscribeLockReleased = subscribe('input:lockReleased', (data: unknown) => {
      const { instanceId: msgInstanceId } = data as { instanceId: string };
      if (msgInstanceId === instanceId) {
        clearInputLockStatus(instanceId);
      }
    });

    const unsubscribeLockStatus = subscribe('input:lockStatus', (data: unknown) => {
      const { instanceId: msgInstanceId, hasLock, lockHolder } = data as {
        instanceId: string;
        hasLock: boolean;
        lockHolder?: string;
      };
      if (msgInstanceId === instanceId) {
        setInputLockStatus(instanceId, hasLock, lockHolder);
      }
    });

    const unsubscribeLockDenied = subscribe('input:lockDenied', (data: unknown) => {
      const { instanceId: msgInstanceId, lockHolder } = data as {
        instanceId: string;
        lockHolder?: string;
      };
      if (msgInstanceId === instanceId) {
        toast.info(`Input locked by ${lockHolder || 'another device'}`);
      }
    });

    return () => {
      unsubscribeOutput();
      unsubscribeStatus();
      unsubscribeLockGranted();
      unsubscribeLockReleased();
      unsubscribeLockStatus();
      unsubscribeLockDenied();
      send('unsubscribe', { instanceId });
      isSubscribedRef.current = false;
    };
  }, [isConnected, instanceId, send, subscribe, write, onStatusChange, setInputLockStatus, clearInputLockStatus]);

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
);

Terminal.displayName = 'Terminal';
