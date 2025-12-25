import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Mockup } from '@cc-orchestrator/shared';
import { startWatching } from '../services/file-watcher.service.js';

const router = Router();

// Expand ~ to home directory
function expandPath(p: string): string {
  return p.replace(/^~/, os.homedir());
}

// GET /api/mockups - List mockups for a working directory
router.get('/', (req, res) => {
  try {
    const workingDir = req.query.workingDir as string;

    if (!workingDir) {
      return res.status(400).json({ success: false, error: 'workingDir is required' });
    }

    const mockupsDir = path.join(expandPath(workingDir), 'mockups');

    if (!fs.existsSync(mockupsDir)) {
      return res.json({ success: true, data: [], hasMockupsDir: false });
    }

    const mockups: Mockup[] = [];

    function scanDirectory(dir: string, folder: string | null = null): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDirectory(fullPath, entry.name);
        } else if (entry.name.endsWith('.html') || entry.name.endsWith('.htm')) {
          mockups.push({
            id: Buffer.from(fullPath).toString('base64'),
            name: entry.name,
            path: fullPath,
            folder,
            content: '', // Don't load content in list view
          });
        }
      }
    }

    scanDirectory(mockupsDir);

    // Start watching for file changes in this directory
    startWatching(expandPath(workingDir), 'mockup');

    res.json({ success: true, data: mockups, hasMockupsDir: true });
  } catch (error) {
    console.error('Error listing mockups:', error);
    res.status(500).json({ success: false, error: 'Failed to list mockups' });
  }
});

// GET /api/mockups/:id - Read mockup file content
router.get('/:id', (req, res) => {
  try {
    const filePath = Buffer.from(req.params.id, 'base64').toString('utf-8');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Mockup not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const name = path.basename(filePath);
    const folder = path.basename(path.dirname(filePath));
    const mockupsIndex = filePath.indexOf('/mockups/');
    const parentFolder = mockupsIndex >= 0 && folder !== 'mockups' ? folder : null;

    const mockup: Mockup = {
      id: req.params.id,
      name,
      path: filePath,
      folder: parentFolder,
      content,
    };

    res.json({ success: true, data: mockup });
  } catch (error) {
    console.error('Error reading mockup:', error);
    res.status(500).json({ success: false, error: 'Failed to read mockup' });
  }
});

// POST /api/mockups/init - Initialize mockups directory
router.post('/init', (req, res) => {
  try {
    const { workingDir } = req.body as { workingDir: string };

    if (!workingDir) {
      return res.status(400).json({ success: false, error: 'workingDir is required' });
    }

    const mockupsDir = path.join(expandPath(workingDir), 'mockups');

    if (fs.existsSync(mockupsDir)) {
      return res.json({ success: true, data: { created: false, message: 'Directory already exists' } });
    }

    fs.mkdirSync(mockupsDir, { recursive: true });

    // Start watching for file changes in this directory
    startWatching(expandPath(workingDir), 'mockup');

    res.status(201).json({ success: true, data: { created: true } });
  } catch (error) {
    console.error('Error initializing mockups directory:', error);
    res.status(500).json({ success: false, error: 'Failed to create mockups directory' });
  }
});

export default router;
