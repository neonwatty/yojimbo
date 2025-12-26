import { useEffect, useCallback } from 'react';
import { useInstancesStore } from '../store/instancesStore';
import { useFeedStore } from '../store/feedStore';
import { instancesApi, feedApi } from '../api/client';
import { useWebSocket } from './useWebSocket';
import { getWsUrl } from '../config';
import type { Instance, ActivityEvent } from '@cc-orchestrator/shared';

export function useInstances() {
  const { instances, setInstances, addInstance, updateInstance, removeInstance, setCurrentCwd } = useInstancesStore();
  const { addEvent, setStats } = useFeedStore();

  const { subscribe, isConnected } = useWebSocket(getWsUrl(), {
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

    // Feed events
    const unsubscribeFeedNew = subscribe('feed:new', (data: unknown) => {
      const { event } = data as { event: ActivityEvent };
      addEvent(event);
    });

    const unsubscribeFeedUpdated = subscribe('feed:updated', async () => {
      // Refresh feed stats when something changes
      try {
        const response = await feedApi.getStats();
        if (response.data) {
          setStats(response.data);
        }
      } catch {
        // Ignore errors
      }
    });

    // Re-fetch instances after WebSocket connects to catch any status updates
    // that occurred before we subscribed (fixes race condition)
    fetchInstances();

    // Also fetch initial feed stats
    feedApi.getStats().then((response) => {
      if (response.data) {
        setStats(response.data);
      }
    }).catch(() => {});

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeClosed();
      unsubscribeStatus();
      unsubscribeCwd();
      unsubscribeFeedNew();
      unsubscribeFeedUpdated();
    };
  }, [isConnected, subscribe, addInstance, updateInstance, removeInstance, setCurrentCwd, fetchInstances, addEvent, setStats]);

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
