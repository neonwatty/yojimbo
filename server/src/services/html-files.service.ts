import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { basename, extname, resolve, isAbsolute } from 'path';
import type { HtmlFile, InstanceHtmlFiles } from '@cc-orchestrator/shared';

/**
 * HTML Files Service
 * Manages HTML files per instance for viewing in the UI
 */
class HtmlFilesService {
  // In-memory store: instanceId -> HtmlFile[]
  private filesByInstance: Map<string, HtmlFile[]> = new Map();
  // Store content for uploaded files (fileId -> content)
  private uploadedContent: Map<string, string> = new Map();

  /**
   * Generate a unique ID for a file based on its path
   */
  private generateFileId(filePath: string): string {
    return createHash('md5').update(filePath).digest('hex').substring(0, 12);
  }

  /**
   * Validate that a path points to an HTML file
   */
  private isHtmlFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    return ext === '.html' || ext === '.htm';
  }

  /**
   * Add a file to an instance's list
   */
  async addFile(instanceId: string, filePath: string): Promise<HtmlFile> {
    // Resolve to absolute path
    const absolutePath = isAbsolute(filePath) ? filePath : resolve(filePath);

    // Validate extension
    if (!this.isHtmlFile(absolutePath)) {
      throw new Error('File must be an HTML file (.html or .htm)');
    }

    // Check file exists
    try {
      const stats = await stat(absolutePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('File not found');
      }
      throw error;
    }

    // Generate file entry
    const fileId = this.generateFileId(absolutePath);
    const htmlFile: HtmlFile = {
      id: fileId,
      name: basename(absolutePath),
      path: absolutePath,
      addedAt: new Date().toISOString(),
    };

    // Get or create instance file list
    const files = this.filesByInstance.get(instanceId) || [];

    // Check for duplicate
    const existingIndex = files.findIndex(f => f.id === fileId);
    if (existingIndex >= 0) {
      // Update existing entry
      files[existingIndex] = htmlFile;
    } else {
      // Add new entry
      files.push(htmlFile);
    }

    this.filesByInstance.set(instanceId, files);
    return htmlFile;
  }

  /**
   * Add a file with content (for file picker uploads)
   */
  addFileWithContent(instanceId: string, fileName: string, content: string): HtmlFile {
    // Validate extension
    if (!this.isHtmlFile(fileName)) {
      throw new Error('File must be an HTML file (.html or .htm)');
    }

    // Generate unique ID based on content hash + timestamp
    const uniqueKey = `${fileName}-${Date.now()}-${content.length}`;
    const fileId = this.generateFileId(uniqueKey);

    const htmlFile: HtmlFile = {
      id: fileId,
      name: fileName,
      path: `uploaded://${fileName}`, // Mark as uploaded file
      addedAt: new Date().toISOString(),
    };

    // Store the content
    this.uploadedContent.set(fileId, content);

    // Get or create instance file list
    const files = this.filesByInstance.get(instanceId) || [];
    files.push(htmlFile);
    this.filesByInstance.set(instanceId, files);

    return htmlFile;
  }

  /**
   * Remove a file from an instance's list
   */
  removeFile(instanceId: string, fileId: string): boolean {
    const files = this.filesByInstance.get(instanceId);
    if (!files) return false;

    const index = files.findIndex(f => f.id === fileId);
    if (index === -1) return false;

    files.splice(index, 1);
    // Also remove uploaded content if exists
    this.uploadedContent.delete(fileId);
    return true;
  }

  /**
   * Get all files for an instance
   */
  getFiles(instanceId: string): InstanceHtmlFiles {
    const files = this.filesByInstance.get(instanceId) || [];
    return {
      instanceId,
      files,
    };
  }

  /**
   * Get a specific file by ID
   */
  getFile(instanceId: string, fileId: string): HtmlFile | null {
    const files = this.filesByInstance.get(instanceId);
    if (!files) return null;
    return files.find(f => f.id === fileId) || null;
  }

  /**
   * Get content for an uploaded file by ID
   */
  getUploadedContent(fileId: string): string | null {
    return this.uploadedContent.get(fileId) || null;
  }

  /**
   * Read and return the content of an HTML file
   */
  async getFileContent(filePath: string): Promise<string> {
    // Validate it's an HTML file
    if (!this.isHtmlFile(filePath)) {
      throw new Error('File must be an HTML file (.html or .htm)');
    }

    // Resolve path
    const absolutePath = isAbsolute(filePath) ? filePath : resolve(filePath);

    try {
      const content = await readFile(absolutePath, 'utf-8');
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('File not found');
      }
      throw error;
    }
  }

  /**
   * Clear all files for an instance (e.g., when instance closes)
   */
  clearInstance(instanceId: string): void {
    // Clean up uploaded content for this instance
    const files = this.filesByInstance.get(instanceId);
    if (files) {
      for (const file of files) {
        this.uploadedContent.delete(file.id);
      }
    }
    this.filesByInstance.delete(instanceId);
  }
}

export const htmlFilesService = new HtmlFilesService();
