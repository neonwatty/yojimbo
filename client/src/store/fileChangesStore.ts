import { create } from 'zustand';
import type { FileChangeEvent } from '@cc-orchestrator/shared';

export interface FileChangeInfo extends FileChangeEvent {
  dismissed: boolean;
}

interface FileChangesState {
  // Map of fileId -> change info
  changes: Map<string, FileChangeInfo>;

  // Actions
  addChange: (event: FileChangeEvent) => void;
  dismissChange: (fileId: string) => void;
  clearChange: (fileId: string) => void;
  clearChangesForWorkingDir: (workingDir: string) => void;
  hasChange: (fileId: string) => boolean;
  getChange: (fileId: string) => FileChangeInfo | undefined;
}

export const useFileChangesStore = create<FileChangesState>((set, get) => ({
  changes: new Map(),

  addChange: (event: FileChangeEvent) => {
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
}));
