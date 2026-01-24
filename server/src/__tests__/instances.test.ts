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

vi.mock('../services/hook-installer.service.js', () => ({
  hookInstallerService: {
    getHooksConfigForPreview: vi.fn().mockReturnValue({
      hooks: {
        UserPromptSubmit: [{ matcher: '.', hooks: [{ type: 'command', command: 'curl ...' }] }],
        Stop: [{ matcher: '.', hooks: [{ type: 'command', command: 'curl ...' }] }],
        Notification: [{ matcher: '.', hooks: [{ type: 'command', command: 'curl ...' }] }],
      },
    }),
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

vi.mock('../services/keychain-storage.service.js', () => ({
  keychainStorageService: {
    hasPassword: vi.fn().mockResolvedValue(false),
    getPassword: vi.fn().mockResolvedValue({ success: false }),
  },
}));

describe('Instances Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/instances/:id/reset-status', () => {
    it('should reset instance status to idle', async () => {
      // Mock instance exists
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'working',
        working_dir: '/test',
      });
      mockRun.mockReturnValue({ changes: 1 });

      // Import after mocks are set up
      const { default: router } = await import('../routes/instances.js');

      // Create mock request/response
      const mockReq = {
        params: { id: 'test-instance' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      // Find the reset-status route handler
      const routes = (router as any).stack || [];
      const resetRoute = routes.find(
        (r: any) => r.route?.path === '/:id/reset-status' && r.route?.methods?.post
      );

      if (resetRoute) {
        await resetRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: { status: 'idle' },
        });
      }
    });

    it('should return 404 for non-existent instance', async () => {
      mockGet.mockReturnValue(undefined);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'non-existent' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const resetRoute = routes.find(
        (r: any) => r.route?.path === '/:id/reset-status' && r.route?.methods?.post
      );

      if (resetRoute) {
        await resetRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Instance not found',
        });
      }
    });
  });

  describe('GET /api/instances/:id/hooks-config', () => {
    it('should return hooks configuration for preview', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
      });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        query: { orchestratorUrl: 'http://localhost:3456' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const configRoute = routes.find(
        (r: any) => r.route?.path === '/:id/hooks-config' && r.route?.methods?.get
      );

      if (configRoute) {
        await configRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              config: expect.any(Object),
              configJson: expect.any(String),
              instructions: expect.any(Array),
            }),
          })
        );
      }
    });

    it('should return 400 when orchestratorUrl is missing', async () => {
      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        query: {}, // Missing orchestratorUrl
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const configRoute = routes.find(
        (r: any) => r.route?.path === '/:id/hooks-config' && r.route?.methods?.get
      );

      if (configRoute) {
        await configRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'orchestratorUrl query parameter is required',
        });
      }
    });

    it('should return 404 for non-existent instance', async () => {
      mockGet.mockReturnValue(undefined);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'non-existent' },
        query: { orchestratorUrl: 'http://localhost:3456' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const configRoute = routes.find(
        (r: any) => r.route?.path === '/:id/hooks-config' && r.route?.methods?.get
      );

      if (configRoute) {
        await configRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Instance not found',
        });
      }
    });
  });
});
