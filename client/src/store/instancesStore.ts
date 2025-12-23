import { create } from 'zustand';
import type { Instance } from '@cc-orchestrator/shared';

interface InstancesState {
  instances: Instance[];
  activeInstanceId: string | null;
  expandedInstanceId: string | null;
  currentCwds: Record<string, string>; // instanceId -> current working directory

  setInstances: (instances: Instance[]) => void;
  addInstance: (instance: Instance) => void;
  updateInstance: (id: string, updates: Partial<Instance>) => void;
  removeInstance: (id: string) => void;
  setActiveInstanceId: (id: string | null) => void;
  setExpandedInstanceId: (id: string | null) => void;
  reorderInstances: (instanceIds: string[]) => void;
  setCurrentCwd: (instanceId: string, cwd: string) => void;
}

export const useInstancesStore = create<InstancesState>((set) => ({
  instances: [],
  activeInstanceId: null,
  expandedInstanceId: null,
  currentCwds: {},

  setInstances: (instances) => set({ instances }),

  addInstance: (instance) =>
    set((state) => ({
      instances: [...state.instances, instance],
    })),

  updateInstance: (id, updates) =>
    set((state) => ({
      instances: state.instances.map((inst) =>
        inst.id === id ? { ...inst, ...updates } : inst
      ),
    })),

  removeInstance: (id) =>
    set((state) => {
      const { [id]: _, ...remainingCwds } = state.currentCwds;
      return {
        instances: state.instances.filter((inst) => inst.id !== id),
        activeInstanceId: state.activeInstanceId === id ? null : state.activeInstanceId,
        expandedInstanceId: state.expandedInstanceId === id ? null : state.expandedInstanceId,
        currentCwds: remainingCwds,
      };
    }),

  setActiveInstanceId: (activeInstanceId) => set({ activeInstanceId }),

  setExpandedInstanceId: (expandedInstanceId) => set({ expandedInstanceId }),

  reorderInstances: (instanceIds) =>
    set((state) => {
      const instanceMap = new Map(state.instances.map((inst) => [inst.id, inst]));
      const reordered = instanceIds
        .map((id) => instanceMap.get(id))
        .filter((inst): inst is Instance => inst !== undefined);
      return { instances: reordered };
    }),

  setCurrentCwd: (instanceId, cwd) =>
    set((state) => ({
      currentCwds: { ...state.currentCwds, [instanceId]: cwd },
    })),
}));
