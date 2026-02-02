import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockPrepare = vi.fn();
const mockGet = vi.fn();
const mockExecuteCommand = vi.fn();
const mockGetPassword = vi.fn();
const mockHasPassword = vi.fn();
const mockIsUnlocked = vi.fn();
const mockMarkUnlocked = vi.fn();
const mockMarkLocked = vi.fn();
const mockUnlockWithVerification = vi.fn();
const mockGetKeychainStatus = vi.fn();
const mockVerifyKeychainUnlocked = vi.fn();

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
    markLocked: mockMarkLocked,
    storePassword: vi.fn(),
    deletePassword: vi.fn(),
    unlockWithVerification: mockUnlockWithVerification,
    getKeychainStatus: mockGetKeychainStatus,
    verifyKeychainUnlocked: mockVerifyKeychainUnlocked,
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

    it('should unlock keychain successfully using unlockWithVerification', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockUnlockWithVerification.mockResolvedValue({
        success: true,
        machineId: 'machine-1',
        machineName: 'Test Machine',
        attempts: 1,
        verified: true,
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

        expect(mockUnlockWithVerification).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            unlocked: true,
            verified: true,
            attempts: 1,
            message: 'Keychain unlocked for Test Machine',
          },
        });
      }
    });

    it('should return error when unlock fails with incorrect password', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockUnlockWithVerification.mockResolvedValue({
        success: false,
        machineId: 'machine-1',
        machineName: 'Test Machine',
        attempts: 1,
        verified: false,
        error: 'Incorrect password - please update the stored password',
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

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Incorrect password - please update the stored password',
          attempts: 1,
        });
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
      mockUnlockWithVerification.mockResolvedValue({
        success: false,
        machineId: 'machine-1',
        machineName: 'Test Machine',
        attempts: 0,
        verified: false,
        error: 'No stored password found for this machine. Please save the keychain password first.',
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

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'No stored password found for this machine. Please save the keychain password first.',
          attempts: 0,
        });
      }
    });

    it('should return failure after max retry attempts', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockUnlockWithVerification.mockResolvedValue({
        success: false,
        machineId: 'machine-1',
        machineName: 'Test Machine',
        attempts: 3,
        verified: false,
        error: 'Failed to unlock keychain after 3 attempts',
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

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to unlock keychain after 3 attempts',
          attempts: 3,
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
        query: {},
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

    it('should return cached status when verify=false', async () => {
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
        query: { verify: 'false' },
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

        expect(mockGetKeychainStatus).not.toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            unlocked: true,
            verified: false,
            message: 'Keychain is unlocked for this session (cached)',
          },
        });
      }
    });

    it('should verify via SSH and return full status', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockGetKeychainStatus.mockResolvedValue({
        hasStoredPassword: true,
        sessionUnlocked: true,
        actuallyUnlocked: true,
        verificationError: undefined,
      });

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
        query: {},
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

        expect(mockGetKeychainStatus).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            hasStoredPassword: true,
            unlocked: true,
            verified: true,
            sessionCached: true,
            verificationError: undefined,
            message: 'Keychain is unlocked (verified via SSH)',
          },
        });
      }
    });

    it('should show locked status when verification shows locked', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockGetKeychainStatus.mockResolvedValue({
        hasStoredPassword: true,
        sessionUnlocked: false,
        actuallyUnlocked: false,
        verificationError: undefined,
      });

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
        query: {},
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
            hasStoredPassword: true,
            unlocked: false,
            verified: true,
            sessionCached: false,
            verificationError: undefined,
            message: 'Keychain is locked',
          },
        });
      }
    });

    it('should report verification error when SSH fails', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockGetKeychainStatus.mockResolvedValue({
        hasStoredPassword: true,
        sessionUnlocked: false,
        actuallyUnlocked: false,
        verificationError: 'Connection refused',
      });

      const { default: router } = await import('../routes/machines.js');

      const mockReq = {
        params: { id: 'machine-1' },
        query: {},
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
            hasStoredPassword: true,
            unlocked: false,
            verified: true,
            sessionCached: false,
            verificationError: 'Connection refused',
            message: 'Could not verify: Connection refused',
          },
        });
      }
    });
  });
});
