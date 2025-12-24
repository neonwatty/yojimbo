import { create } from 'zustand';
import type { FileChangeEvent } from '@cc-orchestrator/shared';

export interface FileChangeInfo extends FileChangeEvent {
  dismissed: boolean;
}

interface FileChangesState {
  // Map of fileId -> change info
  changes: Map<string, FileChangeInfo>;
  // Set of file paths that were recently saved (to ignore file watcher events)
  recentlySaved: Set<string>;

  // Actions
  addChange: (event: FileChangeEvent) => void;
  dismissChange: (fileId: string) => void;
  clearChange: (fileId: string) => void;
  clearChangesForWorkingDir: (workingDir: string) => void;
  hasChange: (fileId: string) => boolean;
  getChange: (fileId: string) => FileChangeInfo | undefined;
  markAsSaved: (filePath: string) => void;
}

export const useFileChangesStore = create<FileChangesState>((set, get) => ({
  changes: new Map(),
  recentlySaved: new Set(),

  addChange: (event: FileChangeEvent) => {
    // Ignore file change events for files we just saved
    if (get().recentlySaved.has(event.filePath)) {
      return;
    }
    set((state) => {
      const newChanges = new Map(state.changes);
      newChanges.set(event.fileId, { ...event, dismissed: false });
      return { changes: newChanges };
    });
  },

  dismissChange: (fileId: string) => {
    set((state) => {
      const change = state.changes.get(fileId);
      if (change) {
        const newChanges = new Map(state.changes);
        newChanges.set(fileId, { ...change, dismissed: true });
        return { changes: newChanges };
      }
      return state;
    });
  },

  clearChange: (fileId: string) => {
    set((state) => {
      const newChanges = new Map(state.changes);
      newChanges.delete(fileId);
      return { changes: newChanges };
    });
  },

  clearChangesForWorkingDir: (workingDir: string) => {
    set((state) => {
      const newChanges = new Map(state.changes);
      for (const [fileId, change] of newChanges) {
        if (change.workingDir === workingDir) {
          newChanges.delete(fileId);
        }
      }
      return { changes: newChanges };
    });
  },

  hasChange: (fileId: string) => {
    const change = get().changes.get(fileId);
    return change !== undefined && !change.dismissed;
  },

  getChange: (fileId: string) => {
    return get().changes.get(fileId);
  },

  markAsSaved: (filePath: string) => {
    set((state) => {
      const newRecentlySaved = new Set(state.recentlySaved);
      newRecentlySaved.add(filePath);
      return { recentlySaved: newRecentlySaved };
    });
    // Remove from recentlySaved after 3 seconds (file watcher debounce is 500ms)
    setTimeout(() => {
      set((state) => {
        const newRecentlySaved = new Set(state.recentlySaved);
        newRecentlySaved.delete(filePath);
        return { recentlySaved: newRecentlySaved };
      });
    }, 3000);
  },
}));
