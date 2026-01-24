import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockPrepare = vi.fn();
const mockGet = vi.fn();
const mockExecuteCommand = vi.fn();

vi.mock('../db/connection.js', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => {
      mockPrepare(sql);
      return {
        get: mockGet,
        all: vi.fn().mockReturnValue([]),
        run: vi.fn(),
      };
    },
  }),
}));

vi.mock('../websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../services/ssh-connection.service.js', () => ({
  sshConnectionService: {
    getMachineSSHConfig: vi.fn(),
    testConnection: vi.fn(),
    listDirectories: vi.fn(),
    executeCommand: mockExecuteCommand,
  },
}));

vi.mock('../services/reverse-tunnel.service.js', () => ({
  reverseTunnelService: {
    hasMachineTunnel: vi.fn(),
  },
}));

describe('Machines Routes - Claude Status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/machines/:id/claude-status', () => {
    it('should return 404 when machine not found', async () => {
      mockGet.mockReturnValue(undefined);

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'non-existent' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const claudeStatusRoute = routes.find(
        (r: any) => r.route?.path === '/:id/claude-status' && r.route?.methods?.get
      );

      if (claudeStatusRoute) {
        await claudeStatusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Machine not found',
        });
      }
    });

    it('should return installed: true when Claude is found', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });

      mockExecuteCommand.mockResolvedValue({
        success: true,
        stdout: '/usr/local/bin/claude\nv1.2.3',
        stderr: '',
        code: 0,
      });

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const claudeStatusRoute = routes.find(
        (r: any) => r.route?.path === '/:id/claude-status' && r.route?.methods?.get
      );

      if (claudeStatusRoute) {
        await claudeStatusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            installed: true,
            path: '/usr/local/bin/claude',
            version: 'v1.2.3',
          },
        });
      }
    });

    it('should return installed: false when Claude is not found', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });

      mockExecuteCommand.mockRejectedValue(new Error('Command failed'));

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const claudeStatusRoute = routes.find(
        (r: any) => r.route?.path === '/:id/claude-status' && r.route?.methods?.get
      );

      if (claudeStatusRoute) {
        await claudeStatusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            installed: false,
            path: null,
            version: null,
          },
        });
      }
    });

    it('should parse version from output correctly', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });

      mockExecuteCommand.mockResolvedValue({
        success: true,
        stdout: '/opt/homebrew/bin/claude\nclaude version v0.1.45',
        stderr: '',
        code: 0,
      });

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const claudeStatusRoute = routes.find(
        (r: any) => r.route?.path === '/:id/claude-status' && r.route?.methods?.get
      );

      if (claudeStatusRoute) {
        await claudeStatusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            installed: true,
            path: '/opt/homebrew/bin/claude',
            version: 'v0.1.45',
          },
        });
      }
    });
  });
});
