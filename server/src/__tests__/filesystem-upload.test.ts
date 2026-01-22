import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('Filesystem Upload Endpoint', () => {
  let uploadDir: string;

  beforeEach(() => {
    uploadDir = path.join(os.tmpdir(), 'yojimbo-uploads');
  });

  afterEach(async () => {
    // Clean up any test files created
    try {
      const files = await fs.readdir(uploadDir);
      for (const file of files) {
        if (file.includes('test-')) {
          await fs.unlink(path.join(uploadDir, file));
        }
      }
    } catch {
      // Directory might not exist, that's fine
    }
  });

  // Helper to get the upload handler from the router
  async function getUploadHandler() {
    const { default: router } = await import('../routes/filesystem.js');
    const uploadRoute = router.stack.find(
      (layer: any) => layer.route?.path === '/upload' && layer.route?.methods?.post
    );
    if (!uploadRoute?.route?.stack) {
      throw new Error('Upload route not found');
    }
    const handlers = uploadRoute.route.stack;
    return handlers[handlers.length - 1].handle;
  }

  describe('POST /api/filesystem/upload', () => {
    it('should upload a file and return the path', async () => {
      const handler = await getUploadHandler();

      const fileContent = Buffer.from('test file content');
      const filename = 'test-file.txt';

      // Create mock request/response
      const mockReq = {
        headers: { 'x-filename': encodeURIComponent(filename) },
        body: fileContent,
      } as any;

      let responseData: any = null;
      const mockRes = {
        json: (data: any) => {
          responseData = data;
          return mockRes;
        },
        status: (_code: number) => {
          return mockRes;
        },
      } as any;

      await handler(mockReq, mockRes, () => {});

      expect(responseData.success).toBe(true);
      expect(responseData.data.path).toContain('yojimbo-uploads');
      expect(responseData.data.path).toContain(filename);

      // Verify file was actually created
      const savedContent = await fs.readFile(responseData.data.path);
      expect(savedContent.toString()).toBe('test file content');
    });

    it('should handle URL-encoded filenames with special characters', async () => {
      const handler = await getUploadHandler();

      const fileContent = Buffer.from('test content');
      const filename = 'Screenshot 2026-01-14 at 6.03.41 PM.png';

      const mockReq = {
        headers: { 'x-filename': encodeURIComponent(filename) },
        body: fileContent,
      } as any;

      let responseData: any = null;
      const mockRes = {
        json: (data: any) => {
          responseData = data;
          return mockRes;
        },
        status: () => mockRes,
      } as any;

      await handler(mockReq, mockRes, () => {});

      expect(responseData.success).toBe(true);
      // The path should contain the decoded filename
      expect(responseData.data.path).toContain('Screenshot 2026-01-14 at 6.03.41 PM.png');
    });

    it('should return 400 when X-Filename header is missing', async () => {
      const handler = await getUploadHandler();

      const fileContent = Buffer.from('test content');

      const mockReq = {
        headers: {},
        body: fileContent,
      } as any;

      let responseData: any = null;
      let statusCode: number = 200;
      const mockRes = {
        json: (data: any) => {
          responseData = data;
          return mockRes;
        },
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
      } as any;

      await handler(mockReq, mockRes, () => {});

      expect(statusCode).toBe(400);
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Missing X-Filename header');
    });

    it('should sanitize filenames to prevent path traversal', async () => {
      const handler = await getUploadHandler();

      const fileContent = Buffer.from('test content');
      const maliciousFilename = '../../../etc/passwd';

      const mockReq = {
        headers: { 'x-filename': encodeURIComponent(maliciousFilename) },
        body: fileContent,
      } as any;

      let responseData: any = null;
      const mockRes = {
        json: (data: any) => {
          responseData = data;
          return mockRes;
        },
        status: () => mockRes,
      } as any;

      await handler(mockReq, mockRes, () => {});

      expect(responseData.success).toBe(true);
      // Path should NOT contain parent directory traversal
      expect(responseData.data.path).not.toContain('..');
      // Should only contain the basename
      expect(responseData.data.path).toContain('passwd');
      expect(responseData.data.path).toContain('yojimbo-uploads');
    });

    it('should generate unique filenames with timestamps', async () => {
      const handler = await getUploadHandler();

      const fileContent = Buffer.from('test content');
      const filename = 'test-duplicate.txt';

      const createMockReqRes = () => {
        let responseData: any = null;
        const mockReq = {
          headers: { 'x-filename': encodeURIComponent(filename) },
          body: fileContent,
        } as any;

        const mockRes = {
          json: (data: any) => {
            responseData = data;
            return mockRes;
          },
          status: () => mockRes,
        } as any;

        return { mockReq, mockRes, getResponse: () => responseData };
      };

      const { mockReq: req1, mockRes: res1, getResponse: getResponse1 } = createMockReqRes();
      await handler(req1, res1, () => {});

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 5));

      const { mockReq: req2, mockRes: res2, getResponse: getResponse2 } = createMockReqRes();
      await handler(req2, res2, () => {});

      const response1 = getResponse1();
      const response2 = getResponse2();

      expect(response1.success).toBe(true);
      expect(response2.success).toBe(true);
      // Paths should be different due to timestamp prefix
      expect(response1.data.path).not.toBe(response2.data.path);
    });

    it('should handle binary file content (images)', async () => {
      const handler = await getUploadHandler();

      // Create a simple PNG header as binary content
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const filename = 'test-image.png';

      const mockReq = {
        headers: { 'x-filename': encodeURIComponent(filename) },
        body: pngHeader,
      } as any;

      let responseData: any = null;
      const mockRes = {
        json: (data: any) => {
          responseData = data;
          return mockRes;
        },
        status: () => mockRes,
      } as any;

      await handler(mockReq, mockRes, () => {});

      expect(responseData.success).toBe(true);

      // Verify binary content was preserved
      const savedContent = await fs.readFile(responseData.data.path);
      expect(savedContent.equals(pngHeader)).toBe(true);
    });
  });
});
