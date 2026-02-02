import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the reverse tunnel service
const mockGetAllTunnelStatuses = vi.fn();
const mockGetTunnelStatus = vi.fn();
const mockForceReconnect = vi.fn();

vi.mock('../services/reverse-tunnel.service.js', () => ({
  reverseTunnelService: {
    getAllTunnelStatuses: mockGetAllTunnelStatuses,
    getTunnelStatus: mockGetTunnelStatus,
    forceReconnect: mockForceReconnect,
  },
}));

describe('Tunnels Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockTunnelHealthy = {
    machineId: 'machine-1',
    machineName: 'Test Machine 1',
    healthState: 'healthy',
    remotePort: 3456,
    localPort: 3456,
    instanceCount: 2,
    lastSeenAt: '2024-01-01T00:00:00.000Z',
    lastHealthCheck: '2024-01-01T00:00:30.000Z',
    reconnectAttempts: 0,
    error: null,
  };

  const mockTunnelDegraded = {
    machineId: 'machine-2',
    machineName: 'Test Machine 2',
    healthState: 'degraded',
    remotePort: 3456,
    localPort: 3456,
    instanceCount: 1,
    lastSeenAt: '2024-01-01T00:00:00.000Z',
    lastHealthCheck: '2024-01-01T00:00:30.000Z',
    reconnectAttempts: 1,
    error: 'Connection timeout',
  };

  describe('GET /api/tunnels', () => {
    it('should return all tunnel statuses', async () => {
      mockGetAllTunnelStatuses.mockReturnValue([mockTunnelHealthy, mockTunnelDegraded]);

      const { default: router } = await import('../routes/tunnels.js');

      const mockReq = {} as any;
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;
      const mockNext = vi.fn();

      // Get the route handler for GET /
      const routes = (router as any).stack || [];
      const routeHandler = routes.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
      );

      if (routeHandler) {
        routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: [mockTunnelHealthy, mockTunnelDegraded],
        });
      }
    });

    it('should return empty array when no tunnels exist', async () => {
      mockGetAllTunnelStatuses.mockReturnValue([]);

      const { default: router } = await import('../routes/tunnels.js');

      const mockReq = {} as any;
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;
      const mockNext = vi.fn();

      const routes = (router as any).stack || [];
      const routeHandler = routes.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
      );

      if (routeHandler) {
        routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: [],
        });
      }
    });
  });

  describe('GET /api/tunnels/:machineId', () => {
    it('should return tunnel status for specific machine', async () => {
      mockGetTunnelStatus.mockReturnValue(mockTunnelHealthy);

      const { default: router } = await import('../routes/tunnels.js');

      const mockReq = { params: { machineId: 'machine-1' } } as any;
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;
      const mockNext = vi.fn();

      // Get the route handler for GET /:machineId
      const routes = (router as any).stack || [];
      const routeHandler = routes.find(
        (layer: any) => layer.route?.path === '/:machineId' && layer.route?.methods?.get
      );

      if (routeHandler) {
        routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: mockTunnelHealthy,
        });
      }
    });

    it('should return 404 when tunnel not found', async () => {
      mockGetTunnelStatus.mockReturnValue(null);

      const { default: router } = await import('../routes/tunnels.js');

      const mockReq = { params: { machineId: 'non-existent' } } as any;
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;
      const mockNext = vi.fn();

      const routes = (router as any).stack || [];
      const routeHandler = routes.find(
        (layer: any) => layer.route?.path === '/:machineId' && layer.route?.methods?.get
      );

      if (routeHandler) {
        routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'No tunnel found for this machine',
        });
      }
    });
  });

  describe('POST /api/tunnels/:machineId/reconnect', () => {
    it('should initiate reconnection successfully', async () => {
      mockForceReconnect.mockResolvedValue({ success: true });

      const { default: router } = await import('../routes/tunnels.js');

      const mockReq = { params: { machineId: 'machine-1' } } as any;
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;
      const mockNext = vi.fn();

      const routes = (router as any).stack || [];
      const routeHandler = routes.find(
        (layer: any) => layer.route?.path === '/:machineId/reconnect' && layer.route?.methods?.post
      );

      if (routeHandler) {
        await routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: 'Reconnection initiated',
        });
      }
    });

    it('should return error when tunnel not found', async () => {
      mockForceReconnect.mockResolvedValue({
        success: false,
        error: 'No tunnel found for this machine',
      });

      const { default: router } = await import('../routes/tunnels.js');

      const mockReq = { params: { machineId: 'non-existent' } } as any;
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;
      const mockNext = vi.fn();

      const routes = (router as any).stack || [];
      const routeHandler = routes.find(
        (layer: any) => layer.route?.path === '/:machineId/reconnect' && layer.route?.methods?.post
      );

      if (routeHandler) {
        await routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'No tunnel found for this machine',
        });
      }
    });

    it('should return error when reconnection already in progress', async () => {
      mockForceReconnect.mockResolvedValue({
        success: false,
        error: 'Reconnection already in progress',
      });

      const { default: router } = await import('../routes/tunnels.js');

      const mockReq = { params: { machineId: 'machine-1' } } as any;
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;
      const mockNext = vi.fn();

      const routes = (router as any).stack || [];
      const routeHandler = routes.find(
        (layer: any) => layer.route?.path === '/:machineId/reconnect' && layer.route?.methods?.post
      );

      if (routeHandler) {
        await routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Reconnection already in progress',
        });
      }
    });
  });
});
