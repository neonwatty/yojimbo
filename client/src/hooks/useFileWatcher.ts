import { useEffect } from 'react';
import { useFileChangesStore } from '../store/fileChangesStore';
import { useWebSocket } from './useWebSocket';
import { getWsUrl } from '../config';
import type { FileChangeEvent } from '@cc-orchestrator/shared';

export function useFileWatcher() {
  const { addChange, dismissChange, clearChange, hasChange, getChange } = useFileChangesStore();

  const { subscribe, isConnected } = useWebSocket(getWsUrl(), {
    onOpen: () => {
      console.log('File watcher connected');
    },
  });

  // Subscribe to file change events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeChanged = subscribe('file:changed', (data: unknown) => {
      const { fileChange } = data as { fileChange: FileChangeEvent };
      addChange(fileChange);
    });

    const unsubscribeDeleted = subscribe('file:deleted', (data: unknown) => {
      const { fileChange } = data as { fileChange: FileChangeEvent };
      addChange(fileChange);
    });

    return () => {
      unsubscribeChanged();
      unsubscribeDeleted();
    };
  }, [isConnected, subscribe, addChange]);

  return {
    hasChange,
    getChange,
    dismissChange,
    clearChange,
    isConnected,
  };
}
