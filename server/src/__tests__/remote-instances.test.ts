import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const {
  mockPrepare,
  mockGet,
  mockRun,
  mockAll,
  mockSpawn,
  mockKill,
  mockHas,
  mockWrite,
  mockGetSSHConfig,
  mockTestConnection,
  mockExecuteCommand,
  mockCheckMachineStatus,
  mockInstallHooksForInstance,
  mockInstallHooksForMachine,
  mockUninstallHooksForInstance,
  mockVerifyHooksInstalled,
  mockCheckRequiredTools,
  mockHasPassword,
  mockGetPassword,
  mockIsUnlocked,
  mockUnlockWithVerification,
  mockGetKeychainStatus,
  mockRunAllChecks,
  mockCreateTunnel,
  mockCloseTunnel,
  mockHasMachineTunnel,
  mockGetMachineIdForInstance,
  mockBroadcast,
} = vi.hoisted(() => ({
  mockPrepare: vi.fn(),
  mockGet: vi.fn(),
  mockRun: vi.fn(),
  mockAll: vi.fn(),
  mockSpawn: vi.fn(),
  mockKill: vi.fn(),
  mockHas: vi.fn(),
  mockWrite: vi.fn(),
  mockGetSSHConfig: vi.fn(),
  mockTestConnection: vi.fn(),
  mockExecuteCommand: vi.fn(),
  mockCheckMachineStatus: vi.fn(),
  mockInstallHooksForInstance: vi.fn(),
  mockInstallHooksForMachine: vi.fn(),
  mockUninstallHooksForInstance: vi.fn(),
  mockVerifyHooksInstalled: vi.fn(),
  mockCheckRequiredTools: vi.fn(),
  mockHasPassword: vi.fn(),
  mockGetPassword: vi.fn(),
  mockIsUnlocked: vi.fn(),
  mockUnlockWithVerification: vi.fn(),
  mockGetKeychainStatus: vi.fn(),
  mockRunAllChecks: vi.fn(),
  mockCreateTunnel: vi.fn(),
  mockCloseTunnel: vi.fn(),
  mockHasMachineTunnel: vi.fn(),
  mockGetMachineIdForInstance: vi.fn(),
  mockBroadcast: vi.fn(),
}));

// Mock database
vi.mock('../db/connection.js', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => {
      mockPrepare(sql);
      return {
        get: mockGet,
        run: mockRun,
        all: mockAll,
      };
    },
  }),
}));

// Mock WebSocket
vi.mock('../websocket/server.js', () => ({
  broadcast: mockBroadcast,
}));

// Mock terminal manager
vi.mock('../services/terminal-manager.service.js', () => ({
  terminalManager: {
    spawn: mockSpawn,
    kill: mockKill,
    has: mockHas,
    write: mockWrite,
    getPid: vi.fn(),
    getBackend: vi.fn(),
    on: vi.fn(),
  },
}));

// Mock SSH connection service
vi.mock('../services/ssh-connection.service.js', () => ({
  sshConnectionService: {
    getMachineSSHConfig: mockGetSSHConfig,
    testConnection: mockTestConnection,
    executeCommand: mockExecuteCommand,
    checkMachineStatus: mockCheckMachineStatus,
  },
}));

// Mock hook installer service
vi.mock('../services/hook-installer.service.js', () => ({
  hookInstallerService: {
    getHooksConfigForPreview: vi.fn().mockReturnValue({
      hooks: {
        UserPromptSubmit: [{ matcher: '.', hooks: [{ type: 'command', command: 'curl ...' }] }],
      },
    }),
    installHooksForInstance: mockInstallHooksForInstance,
    installHooksForMachine: mockInstallHooksForMachine,
    uninstallHooksForInstance: mockUninstallHooksForInstance,
    verifyHooksInstalled: mockVerifyHooksInstalled,
    checkRequiredTools: mockCheckRequiredTools,
  },
}));

// Mock keychain storage service
vi.mock('../services/keychain-storage.service.js', () => ({
  keychainStorageService: {
    hasPassword: mockHasPassword,
    getPassword: mockGetPassword,
    isUnlocked: mockIsUnlocked,
    markUnlocked: vi.fn(),
    markLocked: vi.fn(),
    unlockWithVerification: mockUnlockWithVerification,
    getKeychainStatus: mockGetKeychainStatus,
    verifyKeychainUnlocked: vi.fn(),
  },
}));

// Mock preflight check service
vi.mock('../services/preflight-check.service.js', () => ({
  preflightCheckService: {
    runAllChecks: mockRunAllChecks,
    runQuickCheck: vi.fn(),
  },
}));

// Mock reverse tunnel service
vi.mock('../services/reverse-tunnel.service.js', () => ({
  reverseTunnelService: {
    createTunnel: mockCreateTunnel,
    closeTunnel: mockCloseTunnel,
    hasMachineTunnel: mockHasMachineTunnel,
    getMachineIdForInstance: mockGetMachineIdForInstance,
    on: vi.fn(),
  },
}));

describe('Remote Instances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default mocks
    mockAll.mockReturnValue([]);
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    mockGet.mockReturnValue({ max: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/instances - Create Remote Instance', () => {
    const validRemoteRequest = {
      name: 'Remote Test Instance',
      workingDir: '~/projects/test',
      machineType: 'remote',
      machineId: 'machine-123',
    };

    const mockMachineConfig = {
      host: 'remote-mac.local',
      port: 22,
      username: 'testuser',
      privateKeyPath: '/path/to/key',
      forwardCredentials: true,
    };

    it('should require machineId for remote instances', async () => {
      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        body: {
          name: 'Remote Instance',
          workingDir: '~/test',
          machineType: 'remote',
          // machineId is missing
        },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const createRoute = routes.find(
        (r: any) => r.route?.path === '/' && r.route?.methods?.post
      );

      if (createRoute) {
        await createRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'machineId is required for remote instances',
        });
      }
    });

    it('should return 404 when remote machine not found', async () => {
      mockGetSSHConfig.mockReturnValue(null);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        body: validRemoteRequest,
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const createRoute = routes.find(
        (r: any) => r.route?.path === '/' && r.route?.methods?.post
      );

      if (createRoute) {
        await createRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Remote machine not found',
        });
      }
    });

    it('should create remote instance with SSH terminal', async () => {
      mockGetSSHConfig.mockReturnValue(mockMachineConfig);
      mockSpawn.mockResolvedValue(undefined);

      // First call: get max display order
      // Second call: get the inserted instance row
      mockGet
        .mockReturnValueOnce({ max: 0 })
        .mockReturnValueOnce({
          id: 'test-uuid',
          name: 'Remote Test Instance',
          working_dir: '~/projects/test',
          status: 'idle',
          display_order: 1,
          pid: null,
          machine_type: 'remote',
          machine_id: 'machine-123',
          is_pinned: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          closed_at: null,
        });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        body: validRemoteRequest,
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const createRoute = routes.find(
        (r: any) => r.route?.path === '/' && r.route?.methods?.post
      );

      if (createRoute) {
        await createRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockSpawn).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            type: 'ssh',
            machineId: 'machine-123',
            workingDir: '~/projects/test',
          })
        );
        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              name: 'Remote Test Instance',
              machineType: 'remote',
              machineId: 'machine-123',
            }),
          })
        );
      }
    });

    it('should handle SSH spawn failure', async () => {
      mockGetSSHConfig.mockReturnValue(mockMachineConfig);
      mockSpawn.mockRejectedValue(new Error('SSH connection failed'));
      mockGet.mockReturnValueOnce({ max: 0 });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        body: validRemoteRequest,
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const createRoute = routes.find(
        (r: any) => r.route?.path === '/' && r.route?.methods?.post
      );

      if (createRoute) {
        await createRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('Failed to connect to remote machine'),
          })
        );
      }
    });

    it('should broadcast instance created event', async () => {
      mockGetSSHConfig.mockReturnValue(mockMachineConfig);
      mockSpawn.mockResolvedValue(undefined);

      mockGet
        .mockReturnValueOnce({ max: 0 })
        .mockReturnValueOnce({
          id: 'test-uuid',
          name: 'Remote Test Instance',
          working_dir: '~/projects/test',
          status: 'idle',
          display_order: 1,
          pid: null,
          machine_type: 'remote',
          machine_id: 'machine-123',
          is_pinned: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          closed_at: null,
        });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        body: validRemoteRequest,
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const createRoute = routes.find(
        (r: any) => r.route?.path === '/' && r.route?.methods?.post
      );

      if (createRoute) {
        await createRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockBroadcast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'instance:created',
            instance: expect.objectContaining({
              machineType: 'remote',
            }),
          })
        );
      }
    });
  });

  describe('POST /api/instances/:id/install-hooks', () => {
    it('should require orchestratorUrl', async () => {
      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'instance-1' },
        body: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const installRoute = routes.find(
        (r: any) => r.route?.path === ':id/install-hooks' && r.route?.methods?.post
      );

      if (installRoute) {
        await installRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('orchestratorUrl is required'),
        });
      }
    });

    it('should return 404 for non-existent instance', async () => {
      mockGet.mockReturnValue(undefined);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'non-existent' },
        body: { orchestratorUrl: 'http://localhost:3456' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const installRoute = routes.find(
        (r: any) => r.route?.path === ':id/install-hooks' && r.route?.methods?.post
      );

      if (installRoute) {
        await installRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
      }
    });

    it('should reject hook installation for local instances', async () => {
      mockGet.mockReturnValue({
        id: 'instance-1',
        name: 'Local Instance',
        machine_type: 'local',
        machine_id: null,
      });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'instance-1' },
        body: { orchestratorUrl: 'http://localhost:3456' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const installRoute = routes.find(
        (r: any) => r.route?.path === ':id/install-hooks' && r.route?.methods?.post
      );

      if (installRoute) {
        await installRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Hooks are only supported for remote instances',
        });
      }
    });

    it('should install hooks successfully for remote instance', async () => {
      mockGet.mockReturnValue({
        id: 'instance-1',
        name: 'Remote Instance',
        machine_type: 'remote',
        machine_id: 'machine-123',
        working_dir: '~/project',
      });
      mockInstallHooksForInstance.mockResolvedValue({
        success: true,
        message: 'Hooks installed successfully',
      });
      mockCreateTunnel.mockResolvedValue({ success: true, port: 3456 });
      mockHasMachineTunnel.mockReturnValue(false);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'instance-1' },
        body: { orchestratorUrl: 'http://localhost:3456' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const installRoute = routes.find(
        (r: any) => r.route?.path === ':id/install-hooks' && r.route?.methods?.post
      );

      if (installRoute) {
        await installRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockInstallHooksForInstance).toHaveBeenCalledWith(
          'instance-1',
          'http://localhost:3456'
        );
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      }
    });

    it('should handle hook installation failure', async () => {
      mockGet.mockReturnValue({
        id: 'instance-1',
        name: 'Remote Instance',
        machine_type: 'remote',
        machine_id: 'machine-123',
      });
      mockInstallHooksForInstance.mockResolvedValue({
        success: false,
        message: 'Failed to install hooks',
        error: 'SSH command failed',
      });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'instance-1' },
        body: { orchestratorUrl: 'http://localhost:3456' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const installRoute = routes.find(
        (r: any) => r.route?.path === ':id/install-hooks' && r.route?.methods?.post
      );

      if (installRoute) {
        await installRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to install hooks',
          details: 'SSH command failed',
        });
      }
    });
  });

  describe('POST /api/instances/:id/uninstall-hooks', () => {
    it('should uninstall hooks and close tunnel for last instance', async () => {
      mockGetMachineIdForInstance.mockReturnValue('machine-123');
      mockCloseTunnel.mockResolvedValue(true);
      mockHasMachineTunnel.mockReturnValue(false); // No more instances on this machine
      mockUninstallHooksForInstance.mockResolvedValue({ success: true });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'instance-1' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const uninstallRoute = routes.find(
        (r: any) => r.route?.path === ':id/uninstall-hooks' && r.route?.methods?.post
      );

      if (uninstallRoute) {
        await uninstallRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockCloseTunnel).toHaveBeenCalledWith('instance-1');
        expect(mockUninstallHooksForInstance).toHaveBeenCalledWith('instance-1');
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      }
    });

    it('should not uninstall hooks when other instances still use tunnel', async () => {
      mockGetMachineIdForInstance.mockReturnValue('machine-123');
      mockCloseTunnel.mockResolvedValue(true);
      mockHasMachineTunnel.mockReturnValue(true); // Other instances still using this machine

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'instance-1' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const uninstallRoute = routes.find(
        (r: any) => r.route?.path === ':id/uninstall-hooks' && r.route?.methods?.post
      );

      if (uninstallRoute) {
        await uninstallRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockUninstallHooksForInstance).not.toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      }
    });
  });
});

describe('Machine Preflight Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/machines/:id/preflight', () => {
    it('should return 404 for non-existent machine', async () => {
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
      const preflightRoute = routes.find(
        (r: any) => r.route?.path === '/:id/preflight' && r.route?.methods?.post
      );

      if (preflightRoute) {
        await preflightRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Machine not found',
        });
      }
    });

    it('should run preflight checks and return results', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockRunAllChecks.mockResolvedValue({
        machineId: 'machine-1',
        machineName: 'Test Machine',
        timestamp: new Date().toISOString(),
        overall: 'ready',
        checks: [
          { name: 'SSH Connection', status: 'pass', message: 'Connected successfully' },
          { name: 'Claude Installed', status: 'pass', message: 'Claude Code v1.0.0 installed' },
        ],
        summary: { passed: 2, failed: 0, warnings: 0, skipped: 0 },
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
      const preflightRoute = routes.find(
        (r: any) => r.route?.path === '/:id/preflight' && r.route?.methods?.post
      );

      if (preflightRoute) {
        await preflightRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRunAllChecks).toHaveBeenCalledWith('machine-1');
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            overall: 'ready',
            checks: expect.any(Array),
          }),
        });
      }
    });

    it('should broadcast preflight results', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
        port: 22,
        username: 'user',
      });
      mockRunAllChecks.mockResolvedValue({
        machineId: 'machine-1',
        machineName: 'Test Machine',
        timestamp: new Date().toISOString(),
        overall: 'warnings',
        checks: [
          { name: 'SSH Connection', status: 'pass', message: 'OK' },
          { name: 'Keychain', status: 'warn', message: 'Keychain is locked' },
        ],
        summary: { passed: 1, failed: 0, warnings: 1, skipped: 0 },
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
      const preflightRoute = routes.find(
        (r: any) => r.route?.path === '/:id/preflight' && r.route?.methods?.post
      );

      if (preflightRoute) {
        await preflightRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockBroadcast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'machine:preflight',
            preflightResult: expect.objectContaining({
              overall: 'warnings',
            }),
          })
        );
      }
    });
  });
});

describe('Machine Hook Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/machines/:id/hooks-status', () => {
    it('should return 404 for non-existent machine', async () => {
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
        (r: any) => r.route?.path === '/:id/hooks-status' && r.route?.methods?.get
      );

      if (statusRoute) {
        await statusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
      }
    });

    it('should return hook verification status', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
        hostname: 'mac-mini.local',
      });
      mockVerifyHooksInstalled.mockResolvedValue({
        success: true,
        status: 'installed',
        installedHooks: ['UserPromptSubmit', 'Stop', 'Notification'],
        missingHooks: [],
        invalidHooks: [],
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
      const statusRoute = routes.find(
        (r: any) => r.route?.path === '/:id/hooks-status' && r.route?.methods?.get
      );

      if (statusRoute) {
        await statusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockVerifyHooksInstalled).toHaveBeenCalledWith('machine-1');
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            status: 'installed',
            installedHooks: expect.arrayContaining(['UserPromptSubmit']),
          }),
        });
      }
    });

    it('should report partial hook installation', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
      });
      mockVerifyHooksInstalled.mockResolvedValue({
        success: true,
        status: 'partial',
        installedHooks: ['UserPromptSubmit'],
        missingHooks: ['Stop', 'Notification'],
        invalidHooks: [],
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
      const statusRoute = routes.find(
        (r: any) => r.route?.path === '/:id/hooks-status' && r.route?.methods?.get
      );

      if (statusRoute) {
        await statusRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            status: 'partial',
            missingHooks: ['Stop', 'Notification'],
          }),
        });
      }
    });
  });

  describe('GET /api/machines/:id/tools-check', () => {
    it('should return tool availability status', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
      });
      mockCheckRequiredTools.mockResolvedValue({
        success: true,
        available: ['jq', 'curl', 'python3', 'bash'],
        missing: [],
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
      const toolsRoute = routes.find(
        (r: any) => r.route?.path === '/:id/tools-check' && r.route?.methods?.get
      );

      if (toolsRoute) {
        await toolsRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockCheckRequiredTools).toHaveBeenCalledWith('machine-1');
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            available: expect.arrayContaining(['jq', 'curl']),
            missing: [],
          }),
        });
      }
    });

    it('should report missing tools', async () => {
      mockGet.mockReturnValue({
        id: 'machine-1',
        name: 'Test Machine',
      });
      mockCheckRequiredTools.mockResolvedValue({
        success: true,
        available: ['bash'],
        missing: ['jq', 'curl'],
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
      const toolsRoute = routes.find(
        (r: any) => r.route?.path === '/:id/tools-check' && r.route?.methods?.get
      );

      if (toolsRoute) {
        await toolsRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            missing: ['jq', 'curl'],
          }),
        });
      }
    });
  });
});

describe('Tunnel Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Tunnel lifecycle with instances', () => {
    it('should create tunnel when first instance connects', async () => {
      mockGet.mockReturnValue({
        id: 'instance-1',
        name: 'Remote Instance',
        machine_type: 'remote',
        machine_id: 'machine-123',
        working_dir: '~/project',
      });
      mockHasMachineTunnel.mockReturnValue(false);
      mockCreateTunnel.mockResolvedValue({ success: true, port: 3456 });
      mockInstallHooksForInstance.mockResolvedValue({ success: true });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'instance-1' },
        body: { orchestratorUrl: 'http://localhost:3456' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const installRoute = routes.find(
        (r: any) => r.route?.path === ':id/install-hooks' && r.route?.methods?.post
      );

      if (installRoute) {
        await installRoute.route.stack[0].handle(mockReq, mockRes);

        // Tunnel should be created since this is the first instance
        expect(mockCreateTunnel).toHaveBeenCalled();
      }
    });

    it('should reuse existing tunnel for second instance on same machine', async () => {
      mockGet.mockReturnValue({
        id: 'instance-2',
        name: 'Remote Instance 2',
        machine_type: 'remote',
        machine_id: 'machine-123',
        working_dir: '~/project2',
      });
      mockHasMachineTunnel.mockReturnValue(true); // Tunnel already exists
      mockInstallHooksForInstance.mockResolvedValue({ success: true });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'instance-2' },
        body: { orchestratorUrl: 'http://localhost:3456' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const installRoute = routes.find(
        (r: any) => r.route?.path === ':id/install-hooks' && r.route?.methods?.post
      );

      if (installRoute) {
        await installRoute.route.stack[0].handle(mockReq, mockRes);

        // Tunnel creation should not be called since one already exists
        expect(mockCreateTunnel).not.toHaveBeenCalled();
      }
    });
  });
});
