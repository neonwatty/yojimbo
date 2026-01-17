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
        all: vi.fn().mockReturnValue([]),
      };
    },
  }),
}));

vi.mock('../websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

// Mock port detection service
vi.mock('../services/port-detection.service.js', () => ({
  portDetectionService: {
    getInstancePorts: vi.fn(),
    refreshInstance: vi.fn(),
    clearInstance: vi.fn(),
  },
}));

// Mock HTML files service
const mockAddFile = vi.fn();
const mockAddFileWithContent = vi.fn();
const mockRemoveFile = vi.fn();
const mockGetFiles = vi.fn();
const mockGetFile = vi.fn();
const mockGetFileContent = vi.fn();
const mockGetUploadedContent = vi.fn();
const mockClearInstance = vi.fn();

vi.mock('../services/html-files.service.js', () => ({
  htmlFilesService: {
    addFile: (...args: unknown[]) => mockAddFile(...args),
    addFileWithContent: (...args: unknown[]) => mockAddFileWithContent(...args),
    removeFile: (...args: unknown[]) => mockRemoveFile(...args),
    getFiles: (...args: unknown[]) => mockGetFiles(...args),
    getFile: (...args: unknown[]) => mockGetFile(...args),
    getFileContent: (...args: unknown[]) => mockGetFileContent(...args),
    getUploadedContent: (...args: unknown[]) => mockGetUploadedContent(...args),
    clearInstance: (...args: unknown[]) => mockClearInstance(...args),
  },
}));

vi.mock('../services/hook-installer.service.js', () => ({
  hookInstallerService: {
    getHooksConfigForPreview: vi.fn().mockReturnValue({ hooks: {} }),
    installHooksForInstance: vi.fn(),
    uninstallHooksForInstance: vi.fn(),
    checkExistingHooksForInstance: vi.fn(),
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

vi.mock('../services/reverse-tunnel.service.js', () => ({
  reverseTunnelService: {
    closeTunnel: vi.fn(),
    createTunnel: vi.fn(),
    getMachineIdForInstance: vi.fn(),
    hasMachineTunnel: vi.fn(),
  },
}));

describe('HTML Files API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/instances/:id/html-files', () => {
    it('should return files for a local instance', async () => {
      // Mock instance exists and is local
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      // Mock files response
      const mockFiles = {
        instanceId: 'test-instance',
        files: [
          { id: 'abc123', name: 'test.html', path: '/test/test.html', addedAt: '2024-01-01T00:00:00Z' },
        ],
      };
      mockGetFiles.mockReturnValue(mockFiles);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const filesRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files' && r.route?.methods?.get
      );

      if (filesRoute) {
        await filesRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockGetFiles).toHaveBeenCalledWith('test-instance');
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: mockFiles,
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
      const filesRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files' && r.route?.methods?.get
      );

      if (filesRoute) {
        await filesRoute.route.stack[0].handle(mockReq, mockRes);

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
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const filesRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files' && r.route?.methods?.get
      );

      if (filesRoute) {
        await filesRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'HTML files viewer is only available for local instances',
        });
      }
    });
  });

  describe('POST /api/instances/:id/html-files', () => {
    it('should add a file to a local instance', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      const mockFile = {
        id: 'abc123',
        name: 'test.html',
        path: '/test/test.html',
        addedAt: '2024-01-01T00:00:00Z',
      };
      mockAddFile.mockResolvedValue(mockFile);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        body: { path: '/test/test.html' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const filesRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files' && r.route?.methods?.post
      );

      if (filesRoute) {
        await filesRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockAddFile).toHaveBeenCalledWith('test-instance', '/test/test.html');
        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: mockFile,
        });
      }
    });

    it('should return 400 if path is missing', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        body: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const filesRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files' && r.route?.methods?.post
      );

      if (filesRoute) {
        await filesRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Path is required',
        });
      }
    });

    it('should return 400 for invalid file', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      mockAddFile.mockRejectedValue(new Error('File not found'));

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        body: { path: '/nonexistent/file.html' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const filesRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files' && r.route?.methods?.post
      );

      if (filesRoute) {
        await filesRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'File not found',
        });
      }
    });
  });

  describe('DELETE /api/instances/:id/html-files/:fileId', () => {
    it('should remove a file from an instance', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      mockRemoveFile.mockReturnValue(true);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance', fileId: 'abc123' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const filesRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files/:fileId' && r.route?.methods?.delete
      );

      if (filesRoute) {
        await filesRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRemoveFile).toHaveBeenCalledWith('test-instance', 'abc123');
        expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      }
    });

    it('should return 404 if file not found', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      mockRemoveFile.mockReturnValue(false);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance', fileId: 'nonexistent' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const filesRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files/:fileId' && r.route?.methods?.delete
      );

      if (filesRoute) {
        await filesRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'File not found',
        });
      }
    });
  });

  describe('GET /api/instances/:id/html-files/:fileId/content', () => {
    it('should return file content', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      mockGetFile.mockReturnValue({
        id: 'abc123',
        name: 'test.html',
        path: '/test/test.html',
        addedAt: '2024-01-01T00:00:00Z',
      });

      mockGetFileContent.mockResolvedValue('<html><body>Hello</body></html>');

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance', fileId: 'abc123' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const contentRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files/:fileId/content' && r.route?.methods?.get
      );

      if (contentRoute) {
        await contentRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockGetFile).toHaveBeenCalledWith('test-instance', 'abc123');
        expect(mockGetFileContent).toHaveBeenCalledWith('/test/test.html');
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: { content: '<html><body>Hello</body></html>' },
        });
      }
    });

    it('should return 404 if file not found', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      mockGetFile.mockReturnValue(null);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance', fileId: 'nonexistent' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const contentRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files/:fileId/content' && r.route?.methods?.get
      );

      if (contentRoute) {
        await contentRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'File not found',
        });
      }
    });

    it('should return uploaded content for uploaded files', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      mockGetFile.mockReturnValue({
        id: 'upload123',
        name: 'uploaded.html',
        path: 'uploaded://uploaded.html',
        addedAt: '2024-01-01T00:00:00Z',
      });

      mockGetUploadedContent.mockReturnValue('<html><body>Uploaded Content</body></html>');

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance', fileId: 'upload123' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const contentRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files/:fileId/content' && r.route?.methods?.get
      );

      if (contentRoute) {
        await contentRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockGetUploadedContent).toHaveBeenCalledWith('upload123');
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: { content: '<html><body>Uploaded Content</body></html>' },
        });
      }
    });
  });

  describe('POST /api/instances/:id/html-files/upload', () => {
    it('should upload a file with content', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      const mockFile = {
        id: 'upload123',
        name: 'uploaded.html',
        path: 'uploaded://uploaded.html',
        addedAt: '2024-01-01T00:00:00Z',
      };
      mockAddFileWithContent.mockReturnValue(mockFile);

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        body: { fileName: 'uploaded.html', content: '<html>Test</html>' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const uploadRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files/upload' && r.route?.methods?.post
      );

      if (uploadRoute) {
        await uploadRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockAddFileWithContent).toHaveBeenCalledWith('test-instance', 'uploaded.html', '<html>Test</html>');
        expect(mockRes.status).toHaveBeenCalledWith(201);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: mockFile,
        });
      }
    });

    it('should return 400 if fileName is missing', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        body: { content: '<html>Test</html>' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const uploadRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files/upload' && r.route?.methods?.post
      );

      if (uploadRoute) {
        await uploadRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'fileName and content are required',
        });
      }
    });

    it('should return 400 if content is missing', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        name: 'Test Instance',
        status: 'idle',
        working_dir: '/test',
        machine_type: 'local',
      });

      const { default: router } = await import('../routes/instances.js');

      const mockReq = {
        params: { id: 'test-instance' },
        body: { fileName: 'test.html' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const uploadRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files/upload' && r.route?.methods?.post
      );

      if (uploadRoute) {
        await uploadRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'fileName and content are required',
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
        body: { fileName: 'test.html', content: '<html>Test</html>' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const uploadRoute = routes.find(
        (r: any) => r.route?.path === '/:id/html-files/upload' && r.route?.methods?.post
      );

      if (uploadRoute) {
        await uploadRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'HTML files viewer is only available for local instances',
        });
      }
    });
  });
});
