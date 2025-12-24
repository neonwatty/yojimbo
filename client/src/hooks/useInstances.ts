import { useEffect, useCallback } from 'react';
import { useInstancesStore } from '../store/instancesStore';
import { instancesApi } from '../api/client';
import { useWebSocket } from './useWebSocket';
import type { Instance } from '@cc-orchestrator/shared';

const WS_URL = `ws://${window.location.hostname}:3456/ws`;

export function useInstances() {
  const { instances, setInstances, addInstance, updateInstance, removeInstance, setCurrentCwd } = useInstancesStore();

  const { subscribe, isConnected } = useWebSocket(WS_URL, {
    onOpen: () => {
      console.log('WebSocket connected for instance updates');
    },
  });

  // Fetch instances on mount
  const fetchInstances = useCallback(async () => {
    try {
      const response = await instancesApi.list();
      if (response.data) {
        setInstances(response.data);
      }
    } catch {
      // Error toast shown by API layer
    }
  }, [setInstances]);

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeCreated = subscribe('instance:created', (data: unknown) => {
      const { instance } = data as { instance: Instance };
      addInstance(instance);
    });

    const unsubscribeUpdated = subscribe('instance:updated', (data: unknown) => {
      const { instance } = data as { instance: Instance };
      updateInstance(instance.id, instance);
    });

    const unsubscribeClosed = subscribe('instance:closed', (data: unknown) => {
      const { instanceId } = data as { instanceId: string };
      removeInstance(instanceId);
    });

    const unsubscribeStatus = subscribe('status:changed', (data: unknown) => {
      const { instanceId, status } = data as { instanceId: string; status: Instance['status'] };
      updateInstance(instanceId, { status });
    });

    const unsubscribeCwd = subscribe('cwd:changed', (data: unknown) => {
      const { instanceId, cwd } = data as { instanceId: string; cwd: string };
      setCurrentCwd(instanceId, cwd);
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeClosed();
      unsubscribeStatus();
      unsubscribeCwd();
    };
  }, [isConnected, subscribe, addInstance, updateInstance, removeInstance, setCurrentCwd]);

  // Fetch instances on mount
  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  return {
    instances,
    refetch: fetchInstances,
    isConnected,
  };
}
