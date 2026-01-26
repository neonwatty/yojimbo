import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const { mockRun, mockGet, mockAll, mockGetBackend } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockGet: vi.fn(),
  mockAll: vi.fn(),
  mockGetBackend: vi.fn(),
}));

vi.mock('../db/connection.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    }),
  })),
}));

vi.mock('../services/terminal-manager.service.js', () => ({
  terminalManager: {
    getBackend: mockGetBackend,
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

// Import after mocks
import { portForwardService } from '../services/port-forward.service.js';

describe('PortForwardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the internal state by creating fresh detected ports map
    // @ts-expect-error - accessing private property for testing
    portForwardService.detectedPorts = new Map();
  });

  describe('analyzeOutput', () => {
    it('should detect port from "listening on" pattern', () => {
      const output = 'Server listening on http://localhost:3000';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toContain(3000);
    });

    it('should detect port from "localhost:PORT" pattern', () => {
      const output = 'Access the app at localhost:8080';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toContain(8080);
    });

    it('should detect port from "127.0.0.1:PORT" pattern', () => {
      const output = 'Bound to 127.0.0.1:4000';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toContain(4000);
    });

    it('should detect port from Vite-style "Local:" pattern', () => {
      const output = 'Local:   http://localhost:5173/';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toContain(5173);
    });

    it('should detect port from "Network:" pattern', () => {
      const output = 'Network: http://192.168.1.100:5173/';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toContain(5173);
    });

    it('should detect port from "Running on" pattern', () => {
      const output = 'Running on http://0.0.0.0:8000';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toContain(8000);
    });

    it('should detect port from "Listening on port" pattern', () => {
      const output = 'Listening on port 9000';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toContain(9000);
    });

    it('should detect port from "Available on" pattern', () => {
      const output = 'Available on http://localhost:3001';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toContain(3001);
    });

    it('should detect multiple ports from output', () => {
      const output = `
        Frontend: http://localhost:3000
        Backend: http://localhost:8080
        Admin: http://localhost:9000
      `;
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toContain(3000);
      expect(ports).toContain(8080);
      expect(ports).toContain(9000);
      expect(ports).toHaveLength(3);
    });

    it('should not detect already detected ports for same instance', () => {
      const output1 = 'Server listening on http://localhost:3000';
      const output2 = 'Server still running on http://localhost:3000';

      const ports1 = portForwardService.analyzeOutput('instance-1', output1);
      const ports2 = portForwardService.analyzeOutput('instance-1', output2);

      expect(ports1).toContain(3000);
      expect(ports2).not.toContain(3000);
      expect(ports2).toHaveLength(0);
    });

    it('should detect same port for different instances', () => {
      const output = 'Server listening on http://localhost:3000';

      const ports1 = portForwardService.analyzeOutput('instance-1', output);
      const ports2 = portForwardService.analyzeOutput('instance-2', output);

      expect(ports1).toContain(3000);
      expect(ports2).toContain(3000);
    });

    it('should ignore system ports (22, 80, 443, etc.)', () => {
      const output = `
        SSH: 127.0.0.1:22
        HTTP: localhost:80
        HTTPS: localhost:443
        MySQL: localhost:3306
        Postgres: localhost:5432
        Redis: localhost:6379
        MongoDB: localhost:27017
      `;
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).not.toContain(22);
      expect(ports).not.toContain(80);
      expect(ports).not.toContain(443);
      expect(ports).not.toContain(3306);
      expect(ports).not.toContain(5432);
      expect(ports).not.toContain(6379);
      expect(ports).not.toContain(27017);
      expect(ports).toHaveLength(0);
    });

    it('should ignore ports below 1024', () => {
      const output = 'Service running on localhost:512';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).not.toContain(512);
      expect(ports).toHaveLength(0);
    });

    it('should ignore ports above 65535', () => {
      const output = 'Invalid port localhost:70000';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).not.toContain(70000);
      expect(ports).toHaveLength(0);
    });

    it('should return empty array for output without ports', () => {
      const output = 'Building project... Done!';
      const ports = portForwardService.analyzeOutput('instance-1', output);

      expect(ports).toHaveLength(0);
    });
  });

  describe('createForward', () => {
    it('should return null for non-SSH backends', async () => {
      mockGetBackend.mockReturnValue({ type: 'local' });

      const result = await portForwardService.createForward('instance-1', 3000);

      expect(result).toBeNull();
    });

    it('should return null when no backend found', async () => {
      mockGetBackend.mockReturnValue(null);

      const result = await portForwardService.createForward('instance-1', 3000);

      expect(result).toBeNull();
    });
  });

  describe('closeForward', () => {
    it('should return false when forward not found', async () => {
      mockGet.mockReturnValue(undefined);

      const result = await portForwardService.closeForward('non-existent');

      expect(result).toBe(false);
    });

    it('should update database status when forward exists', async () => {
      mockGet.mockReturnValue({
        id: 'forward-1',
        instance_id: 'instance-1',
        remote_port: 3000,
        local_port: 3000,
        status: 'active',
        created_at: '2024-01-01T00:00:00.000Z',
      });
      mockRun.mockReturnValue({ changes: 1 });

      const result = await portForwardService.closeForward('forward-1');

      expect(result).toBe(true);
    });
  });

  describe('getInstanceForwards', () => {
    it('should return empty array when no forwards exist', () => {
      mockAll.mockReturnValue([]);

      const forwards = portForwardService.getInstanceForwards('instance-1');

      expect(forwards).toEqual([]);
    });

    it('should return list of active forwards', () => {
      mockAll.mockReturnValue([
        {
          id: 'forward-1',
          instance_id: 'instance-1',
          remote_port: 3000,
          local_port: 3000,
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'forward-2',
          instance_id: 'instance-1',
          remote_port: 8080,
          local_port: 8080,
          status: 'active',
          created_at: '2024-01-01T00:01:00.000Z',
        },
      ]);

      const forwards = portForwardService.getInstanceForwards('instance-1');

      expect(forwards).toHaveLength(2);
      expect(forwards[0].remotePort).toBe(3000);
      expect(forwards[1].remotePort).toBe(8080);
    });

    it('should convert database rows to PortForward objects', () => {
      mockAll.mockReturnValue([
        {
          id: 'forward-1',
          instance_id: 'instance-1',
          remote_port: 3000,
          local_port: 3001,
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
          reconnect_attempts: 0,
          last_error: null,
        },
      ]);

      const forwards = portForwardService.getInstanceForwards('instance-1');

      expect(forwards[0]).toEqual({
        id: 'forward-1',
        instanceId: 'instance-1',
        remotePort: 3000,
        localPort: 3001,
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        reconnectAttempts: 0,
        lastError: null,
      });
    });
  });

  describe('closeInstanceForwards', () => {
    it('should update all instance forwards to closed status', async () => {
      mockRun.mockReturnValue({ changes: 3 });

      await portForwardService.closeInstanceForwards('instance-1');

      // Should have called the database update
      expect(mockRun).toHaveBeenCalled();
    });

    it('should clear detected ports for the instance', async () => {
      // First detect some ports
      portForwardService.analyzeOutput('instance-1', 'localhost:3000');

      await portForwardService.closeInstanceForwards('instance-1');

      // Now the same port should be detected again
      const ports = portForwardService.analyzeOutput('instance-1', 'localhost:3000');
      expect(ports).toContain(3000);
    });
  });
});
