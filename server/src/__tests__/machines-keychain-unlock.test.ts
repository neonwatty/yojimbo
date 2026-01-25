import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockPrepare = vi.fn();
const mockGet = vi.fn();
const mockExecuteCommand = vi.fn();
const mockGetPassword = vi.fn();
const mockHasPassword = vi.fn();
const mockIsUnlocked = vi.fn();
const mockMarkUnlocked = vi.fn();

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

vi.mock('../services/hook-installer.service.js', () => ({
  hookInstallerService: {
    installHooksOnMachine: vi.fn(),
    checkHooksOnMachine: vi.fn(),
  },
}));

vi.mock('../services/keychain-storage.service.js', () => ({
  keychainStorageService: {
    getPassword: mockGetPassword,
    hasPassword: mockHasPassword,
    isUnlocked: mockIsUnlocked,
    markUnlocked: mockMarkUnlocked,
    markLocked: vi.fn(),
    storePassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

describe('Machines Routes - Keychain Unlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/machines/:id/unlock-keychain', () => {
    it('should return 404 when machine not found', async () => {
      mockGet.mockReturnValue(undefined);

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'non-existent' },
        body: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const unlockRoute = routes.find(
        (r: any) => r.route?.path === '/:id/unlock-keychain' && r.route?.methods?.post
      );

      if (unlockRoute) {
        await unlockRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Machine not found',
        });
      }
    });

    it('should return early if keychain already unlocked for this session', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockIsUnlocked.mockReturnValue(true);

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
        body: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const unlockRoute = routes.find(
        (r: any) => r.route?.path === '/:id/unlock-keychain' && r.route?.methods?.post
      );

      if (unlockRoute) {
        await unlockRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            alreadyUnlocked: true,
            message: 'Keychain already unlocked for this machine in this session',
          },
        });
        // Should not try to get password or execute command
        expect(mockGetPassword).not.toHaveBeenCalled();
        expect(mockExecuteCommand).not.toHaveBeenCalled();
      }
    });

    it('should return error when no password is stored', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockIsUnlocked.mockReturnValue(false);
      mockGetPassword.mockResolvedValue({ success: false });

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
        body: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const unlockRoute = routes.find(
        (r: any) => r.route?.path === '/:id/unlock-keychain' && r.route?.methods?.post
      );

      if (unlockRoute) {
        await unlockRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'No stored password found for this machine. Please save the keychain password first.',
        });
      }
    });

    it('should unlock keychain successfully and mark as unlocked', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockIsUnlocked.mockReturnValue(false);
      mockGetPassword.mockResolvedValue({ success: true, password: 'test-password' });
      mockExecuteCommand.mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
        code: 0,
      });

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
        body: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const unlockRoute = routes.find(
        (r: any) => r.route?.path === '/:id/unlock-keychain' && r.route?.methods?.post
      );

      if (unlockRoute) {
        await unlockRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockExecuteCommand).toHaveBeenCalledWith(
          'machine-1',
          expect.stringContaining('security unlock-keychain')
        );
        expect(mockMarkUnlocked).toHaveBeenCalledWith('machine-1');
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            unlocked: true,
            message: 'Keychain unlocked for Test Machine',
          },
        });
      }
    });

    it('should return error when unlock command fails with incorrect password', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockIsUnlocked.mockReturnValue(false);
      mockGetPassword.mockResolvedValue({ success: true, password: 'wrong-password' });
      mockExecuteCommand.mockResolvedValue({
        success: false,
        stdout: 'security: SecKeychainUnlock: The user name or passphrase you entered is not correct.',
        stderr: '',
        code: 1,
      });

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
        body: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const unlockRoute = routes.find(
        (r: any) => r.route?.path === '/:id/unlock-keychain' && r.route?.methods?.post
      );

      if (unlockRoute) {
        await unlockRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockMarkUnlocked).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('incorrect'),
        });
      }
    });

    it('should handle SSH connection errors', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockIsUnlocked.mockReturnValue(false);
      mockGetPassword.mockResolvedValue({ success: true, password: 'test-password' });
      mockExecuteCommand.mockRejectedValue(new Error('SSH connection failed'));

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
        body: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const unlockRoute = routes.find(
        (r: any) => r.route?.path === '/:id/unlock-keychain' && r.route?.methods?.post
      );

      if (unlockRoute) {
        await unlockRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to connect to remote machine to unlock keychain',
        });
      }
    });
  });

  describe('GET /api/machines/:id/keychain-status', () => {
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
      const statusRoute = routes.find(
        (r: any) => r.route?.path === '/:id/keychain-status' && r.route?.methods?.get
      );

      if (statusRoute) {
        await statusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Machine not found',
        });
      }
    });

    it('should return unlocked: true when keychain is unlocked', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockIsUnlocked.mockReturnValue(true);

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const statusRoute = routes.find(
        (r: any) => r.route?.path === '/:id/keychain-status' && r.route?.methods?.get
      );

      if (statusRoute) {
        await statusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            unlocked: true,
            message: 'Keychain is unlocked for this session',
          },
        });
      }
    });

    it('should return unlocked: false when keychain is not unlocked', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockIsUnlocked.mockReturnValue(false);

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const statusRoute = routes.find(
        (r: any) => r.route?.path === '/:id/keychain-status' && r.route?.methods?.get
      );

      if (statusRoute) {
        await statusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            unlocked: false,
            message: 'Keychain has not been unlocked in this session',
          },
        });
      }
    });
  });
});
