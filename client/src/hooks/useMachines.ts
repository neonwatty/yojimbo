import { useState, useEffect, useCallback, useRef } from 'react';
import { machinesApi, sshApi } from '../api/client';
import { useWebSocket } from './useWebSocket';
import { getWsUrl } from '../config';
import type { RemoteMachine, SSHKey, UpdateMachineRequest } from '@cc-orchestrator/shared';

export function useMachines() {
  const [machines, setMachines] = useState<RemoteMachine[]>([]);
  const [sshKeys, setSSHKeys] = useState<SSHKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { subscribe, isConnected } = useWebSocket(getWsUrl());

  // Fetch machines
  const fetchMachines = useCallback(async () => {
    try {
      const response = await machinesApi.list();
      if (response.data) {
        setMachines(response.data);
      }
    } catch (err) {
      setError('Failed to load machines');
      console.error('Failed to load machines:', err);
    }
  }, []);

  // Fetch SSH keys
  const fetchSSHKeys = useCallback(async () => {
    try {
      const response = await sshApi.listKeys();
      if (response.data) {
        setSSHKeys(response.data);
      }
    } catch (err) {
      console.error('Failed to load SSH keys:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchMachines(), fetchSSHKeys()]);
      setLoading(false);
    };
    load();
  }, [fetchMachines, fetchSSHKeys]);

  // Ref to hold current machines for health check (avoids stale closure)
  const machinesRef = useRef<RemoteMachine[]>([]);
  machinesRef.current = machines;

  // Periodic health check for all machines (every 60 seconds)
  useEffect(() => {
    const checkHealth = async () => {
      const currentMachines = machinesRef.current;
      if (currentMachines.length === 0) return;

      for (const machine of currentMachines) {
        try {
          // Use silent mode to avoid toast spam during background health checks
          await machinesApi.testConnection(machine.id, { silent: true });
        } catch {
          // Ignore errors - status will be updated in DB
        }
      }
      await fetchMachines();
    };

    // Run health check every 60 seconds
    const interval = setInterval(checkHealth, 60000);

    return () => clearInterval(interval);
  }, [fetchMachines]);

  // Handle WebSocket messages for machine updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeCreated = subscribe('machine:created', (data: unknown) => {
      const { machine } = data as { machine: RemoteMachine };
      if (machine) {
        setMachines((prev) => [...prev, machine]);
      }
    });

    const unsubscribeUpdated = subscribe('machine:updated', (data: unknown) => {
      const { machine } = data as { machine: RemoteMachine };
      if (machine) {
        setMachines((prev) => prev.map((m) => (m.id === machine.id ? machine : m)));
      }
    });

    const unsubscribeDeleted = subscribe('machine:deleted', (data: unknown) => {
      const { machineId } = data as { machineId: string };
      if (machineId) {
        setMachines((prev) => prev.filter((m) => m.id !== machineId));
      }
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, [isConnected, subscribe]);

  // Create machine (and auto-test connection)
  const createMachine = useCallback(
    async (data: { name: string; hostname: string; port?: number; username: string; sshKeyPath?: string }) => {
      const response = await machinesApi.create(data);
      if (response.data) {
        // Auto-test connection after creation
        try {
          await machinesApi.testConnection(response.data.id);
          await fetchMachines(); // Refetch to get updated status
        } catch {
          // Test failed, but machine was created - status will show as offline
          await fetchMachines();
        }
        return response.data;
      }
      throw new Error('Failed to create machine');
    },
    [fetchMachines]
  );

  // Update machine
  const updateMachine = useCallback(
    async (id: string, data: UpdateMachineRequest) => {
      const response = await machinesApi.update(id, data);
      if (response.data) {
        // Will be updated via WebSocket event
        return response.data;
      }
      throw new Error('Failed to update machine');
    },
    []
  );

  // Delete machine
  const deleteMachine = useCallback(async (id: string) => {
    await machinesApi.delete(id);
    // Will be removed via WebSocket event
  }, []);

  // Test connection
  const testConnection = useCallback(async (id: string) => {
    const response = await machinesApi.testConnection(id);
    if (response.data) {
      // Refetch to get updated status
      await fetchMachines();
      return response.data;
    }
    throw new Error('Failed to test connection');
  }, [fetchMachines]);

  return {
    machines,
    sshKeys,
    loading,
    error,
    createMachine,
    updateMachine,
    deleteMachine,
    testConnection,
    refetch: fetchMachines,
  };
}
