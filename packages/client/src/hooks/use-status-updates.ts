import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket, type WSMessage } from './use-websocket';
import { useAppStore } from '../stores/app-store';
import { instanceKeys } from './use-instances';
import type { InstanceStatus } from '@cc-orchestrator/shared';

interface StatusUpdatePayload {
  instanceId: string;
  status: InstanceStatus;
  message?: string;
  hookType?: string;
  toolName?: string;
  timestamp: string;
}

export function useStatusUpdates() {
  const queryClient = useQueryClient();
  const updateInstanceStatus = useAppStore((state) => state.updateInstanceStatus);

  const handleMessage = useCallback(
    (message: WSMessage) => {
      if (message.type === 'instance-status') {
        const payload = message.payload as StatusUpdatePayload;

        // Update local status cache in Zustand
        updateInstanceStatus(payload.instanceId, payload.status);

        // Invalidate React Query cache to refetch instances
        queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
        queryClient.invalidateQueries({ queryKey: instanceKeys.detail(payload.instanceId) });
      }
    },
    [queryClient, updateInstanceStatus]
  );

  const { isConnected } = useWebSocket({
    onMessage: handleMessage,
  });

  return { isConnected };
}

// Hook to get real-time status for a specific instance
export function useInstanceStatus(instanceId: string): InstanceStatus | undefined {
  const instanceStatuses = useAppStore((state) => state.instanceStatuses);
  return instanceStatuses.get(instanceId);
}
