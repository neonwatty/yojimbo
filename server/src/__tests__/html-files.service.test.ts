import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Import the service
import { htmlFilesService } from '../services/html-files.service.js';

describe('HtmlFilesService', () => {
  let testDir: string;
  let testHtmlFile: string;
  let testHtmFile: string;
  let testNonHtmlFile: string;

  beforeEach(async () => {
    // Create temp directory and test files
    testDir = join(tmpdir(), `html-files-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    testHtmlFile = join(testDir, 'test.html');
    testHtmFile = join(testDir, 'test.htm');
    testNonHtmlFile = join(testDir, 'test.txt');

    await writeFile(testHtmlFile, '<html><body>Hello World</body></html>');
    await writeFile(testHtmFile, '<html><body>HTM File</body></html>');
    await writeFile(testNonHtmlFile, 'This is not HTML');
  });

  afterEach(async () => {
    // Clean up temp files
    await rm(testDir, { recursive: true, force: true });
    // Clear any cached files
    htmlFilesService.clearInstance('test-instance');
    htmlFilesService.clearInstance('other-instance');
  });

  describe('addFile', () => {
    it('should add a valid HTML file', async () => {
      const file = await htmlFilesService.addFile('test-instance', testHtmlFile);

      expect(file.id).toBeDefined();
      expect(file.name).toBe('test.html');
      expect(file.path).toBe(testHtmlFile);
      expect(file.addedAt).toBeDefined();
    });

    it('should add a valid HTM file', async () => {
      const file = await htmlFilesService.addFile('test-instance', testHtmFile);

      expect(file.id).toBeDefined();
      expect(file.name).toBe('test.htm');
      expect(file.path).toBe(testHtmFile);
    });

    it('should reject non-HTML files', async () => {
      await expect(
        htmlFilesService.addFile('test-instance', testNonHtmlFile)
      ).rejects.toThrow('File must be an HTML file (.html or .htm)');
    });

    it('should reject non-existent files', async () => {
      await expect(
        htmlFilesService.addFile('test-instance', '/nonexistent/file.html')
      ).rejects.toThrow('File not found');
    });

    it('should reject directories', async () => {
      await expect(
        htmlFilesService.addFile('test-instance', testDir)
      ).rejects.toThrow('File must be an HTML file');
    });

    it('should update existing file if added again', async () => {
      const file1 = await htmlFilesService.addFile('test-instance', testHtmlFile);
      const file2 = await htmlFilesService.addFile('test-instance', testHtmlFile);

      // Should have same ID (based on path hash)
      expect(file1.id).toBe(file2.id);

      // Should only have one file in the list
      const files = htmlFilesService.getFiles('test-instance');
      expect(files.files).toHaveLength(1);
    });

    it('should generate consistent IDs for same path', async () => {
      const file1 = await htmlFilesService.addFile('test-instance', testHtmlFile);
      htmlFilesService.clearInstance('test-instance');
      const file2 = await htmlFilesService.addFile('test-instance', testHtmlFile);

      expect(file1.id).toBe(file2.id);
    });
  });

  describe('getFiles', () => {
    it('should return empty list for new instance', () => {
      const result = htmlFilesService.getFiles('new-instance');

      expect(result.instanceId).toBe('new-instance');
      expect(result.files).toHaveLength(0);
    });

    it('should return all added files', async () => {
      await htmlFilesService.addFile('test-instance', testHtmlFile);
      await htmlFilesService.addFile('test-instance', testHtmFile);

      const result = htmlFilesService.getFiles('test-instance');

      expect(result.instanceId).toBe('test-instance');
      expect(result.files).toHaveLength(2);
      expect(result.files.map(f => f.name).sort()).toEqual(['test.htm', 'test.html']);
    });

    it('should scope files per instance', async () => {
      await htmlFilesService.addFile('test-instance', testHtmlFile);
      await htmlFilesService.addFile('other-instance', testHtmFile);

      const result1 = htmlFilesService.getFiles('test-instance');
      const result2 = htmlFilesService.getFiles('other-instance');

      expect(result1.files).toHaveLength(1);
      expect(result1.files[0].name).toBe('test.html');

      expect(result2.files).toHaveLength(1);
      expect(result2.files[0].name).toBe('test.htm');
    });
  });

  describe('getFile', () => {
    it('should return specific file by ID', async () => {
      const added = await htmlFilesService.addFile('test-instance', testHtmlFile);
      const file = htmlFilesService.getFile('test-instance', added.id);

      expect(file).not.toBeNull();
      expect(file!.id).toBe(added.id);
      expect(file!.name).toBe('test.html');
    });

    it('should return null for non-existent file', () => {
      const file = htmlFilesService.getFile('test-instance', 'nonexistent');

      expect(file).toBeNull();
    });

    it('should return null for non-existent instance', () => {
      const file = htmlFilesService.getFile('nonexistent', 'some-id');

      expect(file).toBeNull();
    });
  });

  describe('removeFile', () => {
    it('should remove existing file', async () => {
      const file = await htmlFilesService.addFile('test-instance', testHtmlFile);
      const removed = htmlFilesService.removeFile('test-instance', file.id);

      expect(removed).toBe(true);

      const files = htmlFilesService.getFiles('test-instance');
      expect(files.files).toHaveLength(0);
    });

    it('should return false for non-existent file', () => {
      const removed = htmlFilesService.removeFile('test-instance', 'nonexistent');

      expect(removed).toBe(false);
    });

    it('should return false for non-existent instance', () => {
      const removed = htmlFilesService.removeFile('nonexistent', 'some-id');

      expect(removed).toBe(false);
    });
  });

  describe('getFileContent', () => {
    it('should return file content', async () => {
      const content = await htmlFilesService.getFileContent(testHtmlFile);

      expect(content).toBe('<html><body>Hello World</body></html>');
    });

    it('should reject non-HTML files', async () => {
      await expect(
        htmlFilesService.getFileContent(testNonHtmlFile)
      ).rejects.toThrow('File must be an HTML file');
    });

    it('should reject non-existent files', async () => {
      await expect(
        htmlFilesService.getFileContent('/nonexistent/file.html')
      ).rejects.toThrow('File not found');
    });
  });

  describe('clearInstance', () => {
    it('should clear all files for instance', async () => {
      await htmlFilesService.addFile('test-instance', testHtmlFile);
      await htmlFilesService.addFile('test-instance', testHtmFile);

      htmlFilesService.clearInstance('test-instance');

      const files = htmlFilesService.getFiles('test-instance');
      expect(files.files).toHaveLength(0);
    });

    it('should not affect other instances', async () => {
      await htmlFilesService.addFile('test-instance', testHtmlFile);
      await htmlFilesService.addFile('other-instance', testHtmFile);

      htmlFilesService.clearInstance('test-instance');

      const files = htmlFilesService.getFiles('other-instance');
      expect(files.files).toHaveLength(1);
    });

    it('should handle clearing non-existent instance', () => {
      // Should not throw
      htmlFilesService.clearInstance('nonexistent');
    });

    it('should clear uploaded content when clearing instance', () => {
      const file = htmlFilesService.addFileWithContent('test-instance', 'test.html', '<html>Test</html>');

      // Verify content exists
      expect(htmlFilesService.getUploadedContent(file.id)).toBe('<html>Test</html>');

      htmlFilesService.clearInstance('test-instance');

      // Verify content is cleared
      expect(htmlFilesService.getUploadedContent(file.id)).toBeNull();
    });
  });

  describe('addFileWithContent', () => {
    it('should add a file with content', () => {
      const content = '<html><body>Uploaded Content</body></html>';
      const file = htmlFilesService.addFileWithContent('test-instance', 'uploaded.html', content);

      expect(file.id).toBeDefined();
      expect(file.name).toBe('uploaded.html');
      expect(file.path).toBe('uploaded://uploaded.html');
      expect(file.addedAt).toBeDefined();
    });

    it('should store content for retrieval', () => {
      const content = '<html><body>Test Content</body></html>';
      const file = htmlFilesService.addFileWithContent('test-instance', 'test.html', content);

      const retrieved = htmlFilesService.getUploadedContent(file.id);
      expect(retrieved).toBe(content);
    });

    it('should reject non-HTML filenames', () => {
      expect(() => {
        htmlFilesService.addFileWithContent('test-instance', 'test.txt', 'content');
      }).toThrow('File must be an HTML file (.html or .htm)');
    });

    it('should accept .htm files', () => {
      const file = htmlFilesService.addFileWithContent('test-instance', 'test.htm', '<html>HTM</html>');
      expect(file.name).toBe('test.htm');
    });

    it('should generate unique IDs for different uploads', () => {
      const file1 = htmlFilesService.addFileWithContent('test-instance', 'test.html', 'short');
      const file2 = htmlFilesService.addFileWithContent('test-instance', 'test.html', 'much longer content here');

      // IDs are based on filename + timestamp + content length, so different content lengths = different IDs
      expect(file1.id).not.toBe(file2.id);
    });

    it('should add file to instance file list', () => {
      htmlFilesService.addFileWithContent('test-instance', 'upload1.html', 'content1');
      htmlFilesService.addFileWithContent('test-instance', 'upload2.html', 'content2');

      const files = htmlFilesService.getFiles('test-instance');
      expect(files.files).toHaveLength(2);
    });
  });

  describe('getUploadedContent', () => {
    it('should return null for non-existent file ID', () => {
      const content = htmlFilesService.getUploadedContent('nonexistent-id');
      expect(content).toBeNull();
    });

    it('should return content for uploaded file', () => {
      const originalContent = '<html>Hello</html>';
      const file = htmlFilesService.addFileWithContent('test-instance', 'test.html', originalContent);

      const content = htmlFilesService.getUploadedContent(file.id);
      expect(content).toBe(originalContent);
    });
  });

  describe('removeFile with uploaded content', () => {
    it('should remove uploaded content when file is removed', () => {
      const file = htmlFilesService.addFileWithContent('test-instance', 'test.html', '<html>Test</html>');

      // Verify content exists
      expect(htmlFilesService.getUploadedContent(file.id)).not.toBeNull();

      // Remove the file
      htmlFilesService.removeFile('test-instance', file.id);

      // Verify content is also removed
      expect(htmlFilesService.getUploadedContent(file.id)).toBeNull();
    });
  });
});
