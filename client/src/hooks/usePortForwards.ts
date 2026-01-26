import { useState, useEffect, useCallback } from 'react';
import { portForwardsApi } from '../api/client';
import { useWebSocket } from './useWebSocket';
import { getWsUrl } from '../config';
import type { PortForward } from '@cc-orchestrator/shared';

export function usePortForwards(instanceId: string) {
  const [portForwards, setPortForwards] = useState<PortForward[]>([]);
  const [loading, setLoading] = useState(true);

  const { subscribe, isConnected } = useWebSocket(getWsUrl());

  // Fetch port forwards
  const fetchPortForwards = useCallback(async () => {
    if (!instanceId) return;
    try {
      const response = await portForwardsApi.list(instanceId);
      if (response.data) {
        setPortForwards(response.data);
      }
    } catch (err) {
      console.error('Failed to load port forwards:', err);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  // Initial load
  useEffect(() => {
    fetchPortForwards();
  }, [fetchPortForwards]);

  // Handle WebSocket messages for port forward updates
  useEffect(() => {
    if (!isConnected || !instanceId) return;

    const unsubscribeForwarded = subscribe('port:forwarded', (data: unknown) => {
      const { portForward } = data as { portForward: PortForward };
      if (portForward && portForward.instanceId === instanceId) {
        setPortForwards((prev) => {
          // Update existing or add new
          const existing = prev.find((p) => p.id === portForward.id);
          if (existing) {
            return prev.map((p) => (p.id === portForward.id ? portForward : p));
          }
          return [...prev, portForward];
        });
      }
    });

    const unsubscribeClosed = subscribe('port:closed', (data: unknown) => {
      const { portForward } = data as { portForward: { id: string } };
      if (portForward) {
        setPortForwards((prev) => prev.filter((p) => p.id !== portForward.id));
      }
    });

    const unsubscribeDetected = subscribe('port:detected', (data: unknown) => {
      // Port detected but not yet forwarded - could show notification
      console.log('Port detected:', data);
    });

    // Handle forward status updates (reconnecting, failed, etc.)
    const unsubscribeUpdated = subscribe('forward:updated', (data: unknown) => {
      const portForward = data as PortForward;
      if (portForward && portForward.instanceId === instanceId) {
        setPortForwards((prev) =>
          prev.map((p) => (p.id === portForward.id ? portForward : p))
        );
      }
    });

    return () => {
      unsubscribeForwarded();
      unsubscribeClosed();
      unsubscribeDetected();
      unsubscribeUpdated();
    };
  }, [isConnected, instanceId, subscribe]);

  // Create port forward
  const createPortForward = useCallback(
    async (remotePort: number, localPort?: number) => {
      const response = await portForwardsApi.create(instanceId, { remotePort, localPort });
      if (response.data) {
        // Will be added via WebSocket event
        return response.data;
      }
      throw new Error('Failed to create port forward');
    },
    [instanceId]
  );

  // Close port forward
  const closePortForward = useCallback(
    async (portId: string) => {
      await portForwardsApi.close(instanceId, portId);
      // Will be removed via WebSocket event
    },
    [instanceId]
  );

  // Reconnect port forward
  const reconnectPortForward = useCallback(
    async (portId: string) => {
      const response = await portForwardsApi.reconnect(instanceId, portId);
      if (response.data) {
        // Will be updated via WebSocket event
        return response.data;
      }
      throw new Error('Failed to reconnect port forward');
    },
    [instanceId]
  );

  return {
    portForwards,
    loading,
    createPortForward,
    closePortForward,
    reconnectPortForward,
    refetch: fetchPortForwards,
  };
}
