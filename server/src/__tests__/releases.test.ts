import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Releases Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockGitHubRelease = {
    tag_name: 'v1.0.0',
    name: 'Release v1.0.0',
    body: '## Changes\n- Feature A\n- Bug fix B',
    published_at: '2026-01-15T12:00:00Z',
    html_url: 'https://github.com/neonwatty/yojimbo/releases/tag/v1.0.0',
    prerelease: false,
  };

  const mockGitHubReleasePrerelease = {
    tag_name: 'v1.1.0-beta',
    name: 'Beta Release',
    body: 'Beta features',
    published_at: '2026-01-16T12:00:00Z',
    html_url: 'https://github.com/neonwatty/yojimbo/releases/tag/v1.1.0-beta',
    prerelease: true,
  };

  describe('GET /api/releases', () => {
    it('should fetch releases from GitHub and transform them', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockGitHubRelease, mockGitHubReleasePrerelease]),
      });

      const { default: router } = await import('../routes/releases.js');

      const mockReq = {} as any;
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as any;
      const mockNext = vi.fn();

      // Get the route handler
      const routes = (router as any).stack || [];
      const routeHandler = routes.find(
        (layer: any) => layer.route?.path === '/' && layer.route?.methods?.get
      );

      if (routeHandler) {
        await routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: [
            {
              version: 'v1.0.0',
              name: 'Release v1.0.0',
              body: '## Changes\n- Feature A\n- Bug fix B',
              publishedAt: '2026-01-15T12:00:00Z',
              url: 'https://github.com/neonwatty/yojimbo/releases/tag/v1.0.0',
              isPrerelease: false,
            },
            {
              version: 'v1.1.0-beta',
              name: 'Beta Release',
              body: 'Beta features',
              publishedAt: '2026-01-16T12:00:00Z',
              url: 'https://github.com/neonwatty/yojimbo/releases/tag/v1.1.0-beta',
              isPrerelease: true,
            },
          ],
        });
      }
    });

    it('should handle GitHub API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Rate Limit Exceeded',
      });

      const { default: router } = await import('../routes/releases.js');

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
        await routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to fetch releases from GitHub',
        });
      }
    });

    it('should handle releases with missing name field', async () => {
      const releaseWithoutName = {
        tag_name: 'v2.0.0',
        name: null, // Some releases have null name
        body: 'Release notes',
        published_at: '2026-01-17T12:00:00Z',
        html_url: 'https://github.com/neonwatty/yojimbo/releases/tag/v2.0.0',
        prerelease: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([releaseWithoutName]),
      });

      const { default: router } = await import('../routes/releases.js');

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
        await routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        // Should fall back to tag_name when name is null
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: [
            expect.objectContaining({
              version: 'v2.0.0',
              name: 'v2.0.0', // Falls back to tag_name
            }),
          ],
        });
      }
    });

    it('should handle releases with empty body', async () => {
      const releaseWithoutBody = {
        tag_name: 'v3.0.0',
        name: 'v3.0.0',
        body: null,
        published_at: '2026-01-18T12:00:00Z',
        html_url: 'https://github.com/neonwatty/yojimbo/releases/tag/v3.0.0',
        prerelease: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([releaseWithoutBody]),
      });

      const { default: router } = await import('../routes/releases.js');

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
        await routeHandler.route.stack[0].handle(mockReq, mockRes, mockNext);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          data: [
            expect.objectContaining({
              body: '', // Empty string fallback
            }),
          ],
        });
      }
    });
  });
});
