import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Plan, CreatePlanRequest, UpdatePlanRequest } from '@cc-orchestrator/shared';
import { startWatching } from '../services/file-watcher.service.js';

const router = Router();

// Expand ~ to home directory
function expandPath(p: string): string {
  return p.replace(/^~/, os.homedir());
}

// GET /api/plans - List plans for a working directory
router.get('/', (req, res) => {
  try {
    const workingDir = req.query.workingDir as string;

    if (!workingDir) {
      return res.status(400).json({ success: false, error: 'workingDir is required' });
    }

    const plansDir = path.join(expandPath(workingDir), 'plans');

    if (!fs.existsSync(plansDir)) {
      return res.json({ success: true, data: [], hasPlansDir: false });
    }

    const plans: Plan[] = [];

    function scanDirectory(dir: string, folder: string | null = null): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDirectory(fullPath, entry.name);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
          plans.push({
            id: Buffer.from(fullPath).toString('base64'),
            name: entry.name,
            path: fullPath,
            folder,
            content: '', // Don't load content in list view
            isDirty: false,
          });
        }
      }
    }

    scanDirectory(plansDir);

    // Start watching for file changes in this directory
    startWatching(expandPath(workingDir), 'plan');

    res.json({ success: true, data: plans, hasPlansDir: true });
  } catch (error) {
    console.error('Error listing plans:', error);
    res.status(500).json({ success: false, error: 'Failed to list plans' });
  }
});

// GET /api/plans/:id - Read plan file content
router.get('/:id', (req, res) => {
  try {
    const filePath = Buffer.from(req.params.id, 'base64').toString('utf-8');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const name = path.basename(filePath);
    const folder = path.basename(path.dirname(filePath));
    const plansIndex = filePath.indexOf('/plans/');
    const parentFolder = plansIndex >= 0 && folder !== 'plans' ? folder : null;

    const plan: Plan = {
      id: req.params.id,
      name,
      path: filePath,
      folder: parentFolder,
      content,
      isDirty: false,
    };

    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error reading plan:', error);
    res.status(500).json({ success: false, error: 'Failed to read plan' });
  }
});

// PUT /api/plans/:id - Update plan file
router.put('/:id', (req, res) => {
  try {
    const filePath = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const { content } = req.body as UpdatePlanRequest;

    if (content === undefined) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    fs.writeFileSync(filePath, content, 'utf-8');

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ success: false, error: 'Failed to update plan' });
  }
});

// POST /api/plans - Create new plan file
router.post('/', (req, res) => {
  try {
    const { workingDir, name, content = '' } = req.body as CreatePlanRequest;

    if (!workingDir || !name) {
      return res.status(400).json({ success: false, error: 'workingDir and name are required' });
    }

    const plansDir = path.join(expandPath(workingDir), 'plans');

    // Create plans directory if it doesn't exist
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }

    // Ensure .md extension
    const fileName = name.endsWith('.md') || name.endsWith('.mdx') ? name : `${name}.md`;
    const filePath = path.join(plansDir, fileName);

    if (fs.existsSync(filePath)) {
      return res.status(409).json({ success: false, error: 'Plan already exists' });
    }

    fs.writeFileSync(filePath, content, 'utf-8');

    const plan: Plan = {
      id: Buffer.from(filePath).toString('base64'),
      name: fileName,
      path: filePath,
      folder: null,
      content,
      isDirty: false,
    };

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ success: false, error: 'Failed to create plan' });
  }
});

// DELETE /api/plans/:id - Delete plan file
router.delete('/:id', (req, res) => {
  try {
    const filePath = Buffer.from(req.params.id, 'base64').toString('utf-8');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    fs.unlinkSync(filePath);

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ success: false, error: 'Failed to delete plan' });
  }
});

export default router;
