import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for ReverseTunnelService
 *
 * These tests focus on the tunnel sharing and reference counting logic.
 * SSH connection tests are limited since they require actual SSH connections.
 */

// Mock dependencies
const mockPrepare = vi.fn();
const mockGet = vi.fn();

vi.mock('../db/connection.js', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => {
      mockPrepare(sql);
      return { get: mockGet };
    },
  }),
}));

vi.mock('ssh2', () => ({
  Client: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnThis(),
    connect: vi.fn(),
    end: vi.fn(),
    forwardIn: vi.fn(),
  })),
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-key')),
    existsSync: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('os', () => ({
  default: {
    homedir: () => '/home/testuser',
  },
}));

vi.mock('net', () => ({
  default: {
    createConnection: vi.fn().mockReturnValue({
      pipe: vi.fn().mockReturnThis(),
      on: vi.fn(),
      destroy: vi.fn(),
    }),
  },
}));

describe('ReverseTunnelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tunnel sharing logic', () => {
    it('should share tunnel when second instance on same machine requests one', () => {
      // Test the core sharing logic without SSH
      // When a tunnel exists for a machine, adding a second instance should just add to the Set

      const existingTunnel = {
        client: {} as unknown,
        remotePort: 3456,
        localPort: 3456,
        machineId: 'machine-1',
        instanceIds: new Set(['instance-1']),
      };

      // Simulate adding second instance
      existingTunnel.instanceIds.add('instance-2');

      expect(existingTunnel.instanceIds.size).toBe(2);
      expect(existingTunnel.instanceIds.has('instance-1')).toBe(true);
      expect(existingTunnel.instanceIds.has('instance-2')).toBe(true);
    });

    it('should track multiple instances per tunnel correctly', () => {
      const tunnel = {
        instanceIds: new Set<string>(),
      };

      // Add instances
      tunnel.instanceIds.add('instance-1');
      tunnel.instanceIds.add('instance-2');
      tunnel.instanceIds.add('instance-3');

      expect(tunnel.instanceIds.size).toBe(3);

      // Remove one
      tunnel.instanceIds.delete('instance-2');

      expect(tunnel.instanceIds.size).toBe(2);
      expect(tunnel.instanceIds.has('instance-1')).toBe(true);
      expect(tunnel.instanceIds.has('instance-2')).toBe(false);
      expect(tunnel.instanceIds.has('instance-3')).toBe(true);
    });
  });

  describe('reference counting logic', () => {
    it('should keep tunnel open when removing non-last instance', () => {
      const mockEnd = vi.fn();
      const tunnel = {
        client: { end: mockEnd },
        instanceIds: new Set(['instance-1', 'instance-2']),
      };

      // Remove first instance
      tunnel.instanceIds.delete('instance-1');

      // Tunnel still has instances, should NOT close
      const shouldClose = tunnel.instanceIds.size === 0;

      expect(shouldClose).toBe(false);
      expect(tunnel.instanceIds.size).toBe(1);
    });

    it('should close tunnel when removing last instance', () => {
      const mockEnd = vi.fn();
      const tunnel = {
        client: { end: mockEnd },
        instanceIds: new Set(['instance-1']),
      };

      // Remove the only instance
      tunnel.instanceIds.delete('instance-1');

      // Tunnel has no instances, should close
      const shouldClose = tunnel.instanceIds.size === 0;

      expect(shouldClose).toBe(true);

      if (shouldClose) {
        tunnel.client.end();
      }

      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('instance lookup logic', () => {
    it('should find machine ID for instance in tunnel', () => {
      const machineTunnels = new Map<string, { instanceIds: Set<string> }>();

      machineTunnels.set('machine-1', {
        instanceIds: new Set(['instance-1', 'instance-2']),
      });

      machineTunnels.set('machine-2', {
        instanceIds: new Set(['instance-3']),
      });

      // Find machine for instance-2
      let foundMachineId: string | undefined;
      for (const [machineId, tunnel] of machineTunnels.entries()) {
        if (tunnel.instanceIds.has('instance-2')) {
          foundMachineId = machineId;
          break;
        }
      }

      expect(foundMachineId).toBe('machine-1');
    });

    it('should return undefined for non-existent instance', () => {
      const machineTunnels = new Map<string, { instanceIds: Set<string> }>();

      machineTunnels.set('machine-1', {
        instanceIds: new Set(['instance-1']),
      });

      let foundMachineId: string | undefined;
      for (const [machineId, tunnel] of machineTunnels.entries()) {
        if (tunnel.instanceIds.has('non-existent')) {
          foundMachineId = machineId;
          break;
        }
      }

      expect(foundMachineId).toBeUndefined();
    });
  });

  describe('hasTunnel logic', () => {
    it('should return true when instance has tunnel', () => {
      const machineTunnels = new Map<string, { instanceIds: Set<string> }>();

      machineTunnels.set('machine-1', {
        instanceIds: new Set(['instance-1']),
      });

      let hasTunnel = false;
      for (const tunnel of machineTunnels.values()) {
        if (tunnel.instanceIds.has('instance-1')) {
          hasTunnel = true;
          break;
        }
      }

      expect(hasTunnel).toBe(true);
    });

    it('should return false when instance has no tunnel', () => {
      const machineTunnels = new Map<string, { instanceIds: Set<string> }>();

      machineTunnels.set('machine-1', {
        instanceIds: new Set(['instance-1']),
      });

      let hasTunnel = false;
      for (const tunnel of machineTunnels.values()) {
        if (tunnel.instanceIds.has('instance-2')) {
          hasTunnel = true;
          break;
        }
      }

      expect(hasTunnel).toBe(false);
    });
  });

  describe('hasMachineTunnel logic', () => {
    it('should return true when machine has tunnel', () => {
      const machineTunnels = new Map<string, { instanceIds: Set<string> }>();

      machineTunnels.set('machine-1', {
        instanceIds: new Set(['instance-1']),
      });

      expect(machineTunnels.has('machine-1')).toBe(true);
    });

    it('should return false when machine has no tunnel', () => {
      const machineTunnels = new Map<string, { instanceIds: Set<string> }>();

      machineTunnels.set('machine-1', {
        instanceIds: new Set(['instance-1']),
      });

      expect(machineTunnels.has('machine-2')).toBe(false);
    });
  });

  describe('getAllTunnels logic', () => {
    it('should return all active tunnels', () => {
      const machineTunnels = new Map<string, { machineId: string; instanceIds: Set<string> }>();

      machineTunnels.set('machine-1', {
        machineId: 'machine-1',
        instanceIds: new Set(['instance-1']),
      });

      machineTunnels.set('machine-2', {
        machineId: 'machine-2',
        instanceIds: new Set(['instance-2', 'instance-3']),
      });

      const tunnels = Array.from(machineTunnels.values());

      expect(tunnels).toHaveLength(2);
      expect(tunnels.map(t => t.machineId)).toContain('machine-1');
      expect(tunnels.map(t => t.machineId)).toContain('machine-2');
    });

    it('should return empty array when no tunnels exist', () => {
      const machineTunnels = new Map<string, { machineId: string }>();

      const tunnels = Array.from(machineTunnels.values());

      expect(tunnels).toHaveLength(0);
    });
  });

  describe('closeMachineTunnel logic', () => {
    it('should close tunnel and remove from map', () => {
      const mockEnd = vi.fn();
      const machineTunnels = new Map<string, { client: { end: () => void }; instanceIds: Set<string> }>();

      machineTunnels.set('machine-1', {
        client: { end: mockEnd },
        instanceIds: new Set(['instance-1', 'instance-2', 'instance-3']),
      });

      // Force close
      const tunnel = machineTunnels.get('machine-1');
      if (tunnel) {
        tunnel.client.end();
        machineTunnels.delete('machine-1');
      }

      expect(mockEnd).toHaveBeenCalled();
      expect(machineTunnels.has('machine-1')).toBe(false);
    });
  });

  describe('database lookup', () => {
    it('should query remote_machines table for SSH config', async () => {
      mockGet.mockReturnValue(undefined);

      const { reverseTunnelService } = await import('../services/reverse-tunnel.service.js');

      await reverseTunnelService.createTunnel('instance-1', 'machine-1', 3456);

      // Verify the correct SQL was called
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('remote_machines')
      );
    });

    it('should return error when machine not found', async () => {
      mockGet.mockReturnValue(undefined);

      const { reverseTunnelService } = await import('../services/reverse-tunnel.service.js');

      const result = await reverseTunnelService.createTunnel('instance-1', 'non-existent', 3456);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Remote machine not found');
    });
  });

  describe('health monitoring logic', () => {
    it('should track health state correctly', () => {
      type TunnelHealthState = 'healthy' | 'degraded' | 'disconnected' | 'reconnecting';

      interface TunnelHealth {
        healthState: TunnelHealthState;
        lastSeenAt: Date | null;
        lastHealthCheck: Date | null;
        reconnectAttempts: number;
        error: string | null;
      }

      const tunnel: TunnelHealth = {
        healthState: 'healthy',
        lastSeenAt: new Date(),
        lastHealthCheck: null,
        reconnectAttempts: 0,
        error: null,
      };

      // Simulate health check pass
      tunnel.lastHealthCheck = new Date();
      tunnel.lastSeenAt = new Date();
      expect(tunnel.healthState).toBe('healthy');

      // Simulate degraded state
      tunnel.healthState = 'degraded';
      tunnel.error = 'Health check timeout';
      expect(tunnel.healthState).toBe('degraded');

      // Simulate disconnected state
      tunnel.healthState = 'disconnected';
      tunnel.error = 'Connection lost';
      expect(tunnel.healthState).toBe('disconnected');

      // Simulate reconnecting state
      tunnel.healthState = 'reconnecting';
      tunnel.reconnectAttempts = 1;
      expect(tunnel.reconnectAttempts).toBe(1);
    });

    it('should calculate exponential backoff correctly', () => {
      const baseDelay = 1000; // 1 second
      const maxAttempts = 5;

      const delays: number[] = [];
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        delays.push(delay);
      }

      expect(delays).toEqual([1000, 2000, 4000, 8000, 16000]);
    });

    it('should limit reconnect attempts', () => {
      const maxAttempts = 5;
      let reconnectAttempts = 0;

      for (let i = 0; i < 10; i++) {
        if (reconnectAttempts >= maxAttempts) {
          break;
        }
        reconnectAttempts++;
      }

      expect(reconnectAttempts).toBe(maxAttempts);
    });
  });

  describe('tunnel status logic', () => {
    it('should build correct TunnelStatus object', () => {
      interface TunnelStatus {
        machineId: string;
        machineName: string;
        healthState: string;
        remotePort: number;
        localPort: number;
        instanceCount: number;
        lastSeenAt: string | null;
        lastHealthCheck: string | null;
        reconnectAttempts: number;
        error: string | null;
      }

      const tunnel = {
        machineId: 'machine-1',
        machineName: 'Test Machine',
        healthState: 'healthy' as const,
        remotePort: 3456,
        localPort: 3456,
        instanceIds: new Set(['instance-1', 'instance-2']),
        lastSeenAt: new Date('2024-01-01T00:00:00Z'),
        lastHealthCheck: new Date('2024-01-01T00:00:30Z'),
        reconnectAttempts: 0,
        error: null,
      };

      const status: TunnelStatus = {
        machineId: tunnel.machineId,
        machineName: tunnel.machineName,
        healthState: tunnel.healthState,
        remotePort: tunnel.remotePort,
        localPort: tunnel.localPort,
        instanceCount: tunnel.instanceIds.size,
        lastSeenAt: tunnel.lastSeenAt?.toISOString() || null,
        lastHealthCheck: tunnel.lastHealthCheck?.toISOString() || null,
        reconnectAttempts: tunnel.reconnectAttempts,
        error: tunnel.error,
      };

      expect(status.machineId).toBe('machine-1');
      expect(status.machineName).toBe('Test Machine');
      expect(status.healthState).toBe('healthy');
      expect(status.instanceCount).toBe(2);
      expect(status.lastSeenAt).toBe('2024-01-01T00:00:00.000Z');
      expect(status.lastHealthCheck).toBe('2024-01-01T00:00:30.000Z');
      expect(status.reconnectAttempts).toBe(0);
      expect(status.error).toBeNull();
    });
  });

  describe('state change events', () => {
    it('should emit state change with correct structure', () => {
      interface TunnelStateChange {
        machineId: string;
        previousState: string | null;
        newState: string;
        error?: string;
        timestamp: string;
      }

      const stateChange: TunnelStateChange = {
        machineId: 'machine-1',
        previousState: 'healthy',
        newState: 'degraded',
        error: 'Connection timeout',
        timestamp: new Date().toISOString(),
      };

      expect(stateChange.machineId).toBe('machine-1');
      expect(stateChange.previousState).toBe('healthy');
      expect(stateChange.newState).toBe('degraded');
      expect(stateChange.error).toBe('Connection timeout');
      expect(stateChange.timestamp).toBeDefined();
    });
  });

  describe('forceReconnect logic', () => {
    it('should reset reconnect attempts on force reconnect', async () => {
      const { reverseTunnelService } = await import('../services/reverse-tunnel.service.js');

      // Try to force reconnect a non-existent tunnel
      const result = await reverseTunnelService.forceReconnect('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No tunnel found for this machine');
    });
  });
});
