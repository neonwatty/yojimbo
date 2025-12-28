import { useState, useEffect, useCallback } from 'react';
import { machinesApi, sshApi } from '../api/client';
import { useWebSocket } from './useWebSocket';
import { getWsUrl } from '../config';
import type { RemoteMachine, SSHKey } from '@cc-orchestrator/shared';

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

  // Create machine
  const createMachine = useCallback(
    async (data: { name: string; hostname: string; port?: number; username: string; sshKeyPath?: string }) => {
      const response = await machinesApi.create(data);
      if (response.data) {
        // Will be added via WebSocket event
        return response.data;
      }
      throw new Error('Failed to create machine');
    },
    []
  );

  // Update machine
  const updateMachine = useCallback(
    async (
      id: string,
      data: { name?: string; hostname?: string; port?: number; username?: string; sshKeyPath?: string }
    ) => {
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
      return response.data;
    }
    throw new Error('Failed to test connection');
  }, []);

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
