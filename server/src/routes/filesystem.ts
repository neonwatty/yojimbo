import { Router } from 'express';
import express from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { DirectoryListResponse, HomePathResponse, ClaudeCliStatus } from '@cc-orchestrator/shared';

const execAsync = promisify(exec);
const router = Router();

// POST /api/filesystem/upload - Save dropped file and return path
router.post('/upload', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
  try {
    const encodedFilename = req.headers['x-filename'] as string;
    if (!encodedFilename) {
      return res.status(400).json({ success: false, error: 'Missing X-Filename header' });
    }

    // Decode the URL-encoded filename and sanitize to prevent path traversal
    const filename = decodeURIComponent(encodedFilename);
    const sanitizedFilename = path.basename(filename);
    const uploadDir = path.join(os.tmpdir(), 'yojimbo-uploads');

    // Create upload dir if not exists
    await fsPromises.mkdir(uploadDir, { recursive: true });

    // Generate unique filename to avoid collisions
    const uniqueName = `${Date.now()}-${sanitizedFilename}`;
    const filePath = path.join(uploadDir, uniqueName);

    // Write file
    await fsPromises.writeFile(filePath, req.body);

    res.json({ success: true, data: { path: filePath } });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

// Expand ~ to home directory
function expandPath(p: string): string {
  return p.replace(/^~/, os.homedir());
}

// Convert full path to display path with ~
function toDisplayPath(p: string): string {
  const home = os.homedir();
  if (p.startsWith(home)) {
    return p.replace(home, '~');
  }
  return p;
}

// GET /api/filesystem/list - List directories in a path
router.get('/list', (req, res) => {
  try {
    const requestedPath = (req.query.path as string) || '~';
    const fullPath = expandPath(requestedPath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'Path does not exist' });
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ success: false, error: 'Path is not a directory' });
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    // Filter to only directories, exclude hidden dirs (starting with .)
    const directories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => ({
        name: entry.name,
        path: path.join(fullPath, entry.name),
        isDirectory: true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(fullPath);
    const hasParent = fullPath !== '/' && fullPath !== os.homedir();

    const response: DirectoryListResponse = {
      currentPath: fullPath,
      displayPath: toDisplayPath(fullPath),
      entries: directories,
      hasParent,
      parentPath: hasParent ? parentPath : null,
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error listing directory:', error);
    res.status(500).json({ success: false, error: 'Failed to list directory' });
  }
});

// GET /api/filesystem/home - Get home directory path
router.get('/home', (_req, res) => {
  try {
    const homePath = os.homedir();
    const response: HomePathResponse = {
      path: homePath,
      displayPath: '~',
    };
    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error getting home path:', error);
    res.status(500).json({ success: false, error: 'Failed to get home path' });
  }
});

// GET /api/filesystem/claude-status - Check if Claude CLI is installed
router.get('/claude-status', async (_req, res) => {
  try {
    // Try to find claude in PATH
    const whichCommand = process.platform === 'win32' ? 'where' : 'which';

    try {
      const { stdout: claudePath } = await execAsync(`${whichCommand} claude`);
      const trimmedPath = claudePath.trim().split('\n')[0]; // Take first result if multiple

      // Try to get version
      let version: string | null = null;
      try {
        const { stdout: versionOutput } = await execAsync('claude --version');
        version = versionOutput.trim();
      } catch {
        // Version command failed, but claude exists
      }

      const response: ClaudeCliStatus = {
        installed: true,
        path: trimmedPath,
        version,
      };
      res.json({ success: true, data: response });
    } catch {
      // Claude not found in PATH
      const response: ClaudeCliStatus = {
        installed: false,
        path: null,
        version: null,
      };
      res.json({ success: true, data: response });
    }
  } catch (error) {
    console.error('Error checking Claude CLI status:', error);
    res.status(500).json({ success: false, error: 'Failed to check Claude CLI status' });
  }
});

export default router;
