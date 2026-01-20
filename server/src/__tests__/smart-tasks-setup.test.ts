import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing routes
const mockPrepare = vi.fn();
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();

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

vi.mock('../websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../services/terminal-manager.service.js', () => ({
  terminalManager: {
    spawn: vi.fn().mockResolvedValue(undefined),
    kill: vi.fn(),
    has: vi.fn(),
    write: vi.fn(),
    getPid: vi.fn().mockReturnValue(12345),
  },
}));

// Mock git-clone service
const mockCloneRepository = vi.fn();
const mockValidateClonePath = vi.fn();
const mockExpandPath = vi.fn();
const mockExtractRepoName = vi.fn();

vi.mock('../services/git-clone.service.js', () => ({
  cloneRepository: mockCloneRepository,
  validateClonePath: mockValidateClonePath,
  expandPath: mockExpandPath,
  extractRepoName: mockExtractRepoName,
}));

// Mock projects service
const mockCreateProject = vi.fn();

vi.mock('../services/projects.service.js', () => ({
  createProject: mockCreateProject,
}));

// Mock context gathering
vi.mock('../services/context-gathering.service.js', () => ({
  gatherFullContext: vi.fn().mockResolvedValue({ projects: [], instances: [] }),
  formatContextForPrompt: vi.fn().mockReturnValue(''),
}));

// Mock claude-cli service
vi.mock('../services/claude-cli.service.js', () => ({
  checkClaudeCliAvailable: vi.fn().mockResolvedValue(true),
  parseTasks: vi.fn(),
  clarifyTasks: vi.fn(),
}));

describe('Smart Tasks Setup Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockExpandPath.mockImplementation((p) => p.replace('~', '/home/user'));
    mockExtractRepoName.mockReturnValue('owner/repo');
  });

  describe('POST /api/smart-tasks/validate-path', () => {
    it('should return validation result for valid path', async () => {
      mockValidateClonePath.mockReturnValue({
        valid: true,
        exists: false,
        parentExists: true,
        expandedPath: '/home/user/Desktop/new-repo',
      });

      const { default: router } = await import('../routes/smart-tasks.js');

      const mockReq = {
        body: { path: '~/Desktop/new-repo' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const validateRoute = routes.find(
        (r: any) => r.route?.path === '/validate-path' && r.route?.methods?.post
      );

      if (validateRoute) {
        await validateRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: {
            valid: true,
            exists: false,
            parentExists: true,
            expandedPath: '/home/user/Desktop/new-repo',
          },
        });
      }
    });

    it('should return 400 for missing path', async () => {
      const { default: router } = await import('../routes/smart-tasks.js');

      const mockReq = {
        body: {},
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const validateRoute = routes.find(
        (r: any) => r.route?.path === '/validate-path' && r.route?.methods?.post
      );

      if (validateRoute) {
        await validateRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'path is required',
        });
      }
    });
  });

  describe('POST /api/smart-tasks/expand-path', () => {
    it('should return expanded path', async () => {
      mockExpandPath.mockReturnValue('/home/user/Desktop/repo');

      const { default: router } = await import('../routes/smart-tasks.js');

      const mockReq = {
        body: { path: '~/Desktop/repo' },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const expandRoute = routes.find(
        (r: any) => r.route?.path === '/expand-path' && r.route?.methods?.post
      );

      if (expandRoute) {
        await expandRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: { expandedPath: '/home/user/Desktop/repo' },
        });
      }
    });
  });

  describe('POST /api/smart-tasks/setup-project', () => {
    // Store sessions for testing
    const sessions = new Map();

    beforeEach(() => {
      // Create a mock session
      sessions.set('test-session', {
        sessionId: 'test-session',
        input: 'test input',
        tasks: { tasks: [], suggestedOrder: [] },
        clarificationRound: 0,
        createdAt: new Date(),
      });
    });

    it('should return 400 for missing sessionId', async () => {
      const { default: router } = await import('../routes/smart-tasks.js');

      const mockReq = {
        body: {
          action: 'clone-and-create',
          gitRepoUrl: 'https://github.com/owner/repo',
          targetPath: '~/Desktop/repo',
        },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const setupRoute = routes.find(
        (r: any) => r.route?.path === '/setup-project' && r.route?.methods?.post
      );

      if (setupRoute) {
        await setupRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'sessionId is required',
        });
      }
    });

    it('should return 400 for missing gitRepoUrl', async () => {
      const { default: router } = await import('../routes/smart-tasks.js');

      const mockReq = {
        body: {
          sessionId: 'test-session',
          action: 'clone-and-create',
          targetPath: '~/Desktop/repo',
        },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const setupRoute = routes.find(
        (r: any) => r.route?.path === '/setup-project' && r.route?.methods?.post
      );

      if (setupRoute) {
        await setupRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'gitRepoUrl is required',
        });
      }
    });

    it('should return 400 for missing targetPath', async () => {
      const { default: router } = await import('../routes/smart-tasks.js');

      const mockReq = {
        body: {
          sessionId: 'test-session',
          action: 'clone-and-create',
          gitRepoUrl: 'https://github.com/owner/repo',
        },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const setupRoute = routes.find(
        (r: any) => r.route?.path === '/setup-project' && r.route?.methods?.post
      );

      if (setupRoute) {
        await setupRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'targetPath is required',
        });
      }
    });

    it('should return 400 for unsupported action', async () => {
      const { default: router } = await import('../routes/smart-tasks.js');

      const mockReq = {
        body: {
          sessionId: 'test-session',
          action: 'unsupported-action',
          gitRepoUrl: 'https://github.com/owner/repo',
          targetPath: '~/Desktop/repo',
        },
      } as any;

      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;

      const routes = (router as any).stack || [];
      const setupRoute = routes.find(
        (r: any) => r.route?.path === '/setup-project' && r.route?.methods?.post
      );

      if (setupRoute) {
        await setupRoute.route.stack[0].handle(mockReq, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Only "clone-and-create" action is currently supported',
        });
      }
    });
  });
});
