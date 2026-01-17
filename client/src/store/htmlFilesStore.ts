import { create } from 'zustand';
import type { InstanceHtmlFiles } from '@cc-orchestrator/shared';

interface HtmlFilesState {
  // HTML files data keyed by instance ID
  instanceHtmlFiles: Record<string, InstanceHtmlFiles>;

  setInstanceHtmlFiles: (instanceId: string, data: InstanceHtmlFiles) => void;
  clearInstanceHtmlFiles: (instanceId: string) => void;
}

export const useHtmlFilesStore = create<HtmlFilesState>((set) => ({
  instanceHtmlFiles: {},

  setInstanceHtmlFiles: (instanceId, data) =>
    set((state) => ({
      instanceHtmlFiles: { ...state.instanceHtmlFiles, [instanceId]: data },
    })),

  clearInstanceHtmlFiles: (instanceId) =>
    set((state) => {
      const { [instanceId]: _, ...rest } = state.instanceHtmlFiles;
      return { instanceHtmlFiles: rest };
    }),
}));
