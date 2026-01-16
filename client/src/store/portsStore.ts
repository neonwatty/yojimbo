import { create } from 'zustand';
import type { InstancePorts } from '@cc-orchestrator/shared';

interface PortsState {
  // Port data keyed by instance ID
  instancePorts: Record<string, InstancePorts>;

  setInstancePorts: (instanceId: string, ports: InstancePorts) => void;
  clearInstancePorts: (instanceId: string) => void;
}

export const usePortsStore = create<PortsState>((set) => ({
  instancePorts: {},

  setInstancePorts: (instanceId, ports) =>
    set((state) => ({
      instancePorts: { ...state.instancePorts, [instanceId]: ports },
    })),

  clearInstancePorts: (instanceId) =>
    set((state) => {
      const { [instanceId]: _, ...rest } = state.instancePorts;
      return { instancePorts: rest };
    }),
}));
