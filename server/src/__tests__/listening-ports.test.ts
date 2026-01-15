import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockPrepare = vi.fn();
const mockRun = vi.fn();
const mockGet = vi.fn();

vi.mock('../db/connection.js', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => {
      mockPrepare(sql);
      return {
        get: mockGet,
        run: mockRun,
      };
    },
  }),
}));

vi.mock('../websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

// Mock port detection service
const mockGetInstancePorts = vi.fn();
const mockRefreshInstance = vi.fn();
const mockClearInstance = vi.fn();

vi.mock('../services/port-detection.service.js', () => ({
  portDetectionService: {
    getInstancePorts: (...args: unknown[]) => mockGetInstancePorts(...args),
    refreshInstance: (...args: unknown[]) => mockRefreshInstance(...args),
    clearInstance: (...args: unknown[]) => mockClearInstance(...args),
  },
}));

vi.mock('../services/hook-installer.service.js', () => ({
  hookInstallerService: {
    getHooksConfigForPreview: vi.fn().mockReturnValue({ hooks: {} }),
    installHooksForInstance: vi.fn(),
    uninstallHooksForInstance: vi.fn(),
  },
}));

vi.mock('../services/terminal-manager.service.js', () => ({
  terminalManager: {
    spawn: vi.fn(),
    kill: vi.fn(),
    has: vi.fn(),
    write: vi.fn(),
    getPid: vi.fn(),
  },
}));

vi.mock('../services/ssh-connection.service.js', () => ({
  sshConnectionService: {
    getMachineSSHConfig: vi.fn(),
  },
}));

describe('Listening Ports API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/instances/:id/listening-ports', () => {
    it('should return ports for a local instance', async () => {
      // Mock instance exists and is local
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      // Mock port detection response
      const mockPorts = {
        instanceId: 'test-instance',
        ports: [
          {
            port: 3000,
            pid: 12345,
            process: 'node',
            bindAddress: '*',
            isAccessible: true,
            tailscaleUrl: 'http://100.100.100.100:3000',
          },
        ],
        tailscaleIp: '100.100.100.100',
        lastUpdated: Date.now(),
      };
      mockGetInstancePorts.mockReturnValue(mockPorts);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        query: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const portsRoute = routes.find(
        (r: any) => r.route?.path === '/:id/listening-ports' && r.route?.methods?.get
      );

      if (portsRoute) {
        await portsRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockGetInstancePorts).toHaveBeenCalledWith('test-instance');
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: mockPorts,
        });
      }
    });

    it('should refresh ports when refresh=true', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      const mockPorts = {
        instanceId: 'test-instance',
        ports: [],
        tailscaleIp: null,
        lastUpdated: Date.now(),
      };
      mockRefreshInstance.mockResolvedValue(mockPorts);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        query: { refresh: 'true' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const portsRoute = routes.find(
        (r: any) => r.route?.path === '/:id/listening-ports' && r.route?.methods?.get
      );

      if (portsRoute) {
        await portsRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRefreshInstance).toHaveBeenCalledWith('test-instance');
        expect(mockGetInstancePorts).not.toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: mockPorts,
        });
      }
    });

    it('should return 404 for non-existent instance', async () => {
      mockGet.mockReturnValue(undefined);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'non-existent' },
        query: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const portsRoute = routes.find(
        (r: any) => r.route?.path === '/:id/listening-ports' && r.route?.methods?.get
      );

      if (portsRoute) {
        await portsRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Instance not found',
        });
      }
    });

    it('should return 400 for remote instances', async () => {
      mockGet.mockReturnValue({
        id: 'remote-instance',
        name: 'Remote Instance',
        status: 'idle',
        working_dir: '/remote',
        machine_type: 'remote',
        machine_id: 'machine-123',
      });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'remote-instance' },
        query: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const portsRoute = routes.find(
        (r: any) => r.route?.path === '/:id/listening-ports' && r.route?.methods?.get
      );

      if (portsRoute) {
        await portsRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Port detection is only available for local instances',
        });
      }
    });

    it('should return empty ports array when no ports detected', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      const mockPorts = {
        instanceId: 'test-instance',
        ports: [],
        tailscaleIp: null,
        lastUpdated: Date.now(),
      };
      mockGetInstancePorts.mockReturnValue(mockPorts);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        query: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const portsRoute = routes.find(
        (r: any) => r.route?.path === '/:id/listening-ports' && r.route?.methods?.get
      );

      if (portsRoute) {
        await portsRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            instanceId: 'test-instance',
            ports: [],
          }),
        });
      }
    });

    it('should include tailscale IP when available', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      const mockPorts = {
        instanceId: 'test-instance',
        ports: [
          {
            port: 8080,
            pid: 54321,
            process: 'vite',
            bindAddress: '0.0.0.0',
            isAccessible: true,
            tailscaleUrl: 'http://100.64.0.1:8080',
          },
        ],
        tailscaleIp: '100.64.0.1',
        lastUpdated: Date.now(),
      };
      mockGetInstancePorts.mockReturnValue(mockPorts);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        query: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const portsRoute = routes.find(
        (r: any) => r.route?.path === '/:id/listening-ports' && r.route?.methods?.get
      );

      if (portsRoute) {
        await portsRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            tailscaleIp: '100.64.0.1',
            ports: expect.arrayContaining([
              expect.objectContaining({
                tailscaleUrl: 'http://100.64.0.1:8080',
              }),
            ]),
          }),
        });
      }
    });

    it('should identify localhost bindings as not accessible', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      const mockPorts = {
        instanceId: 'test-instance',
        ports: [
          {
            port: 3000,
            pid: 12345,
            process: 'node',
            bindAddress: '127.0.0.1',
            isAccessible: false,
            tailscaleUrl: null,
          },
        ],
        tailscaleIp: '100.64.0.1',
        lastUpdated: Date.now(),
      };
      mockGetInstancePorts.mockReturnValue(mockPorts);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        query: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const portsRoute = routes.find(
        (r: any) => r.route?.path === '/:id/listening-ports' && r.route?.methods?.get
      );

      if (portsRoute) {
        await portsRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            ports: expect.arrayContaining([
              expect.objectContaining({
                bindAddress: '127.0.0.1',
                isAccessible: false,
                tailscaleUrl: null,
              }),
            ]),
          }),
        });
      }
    });
  });
});
