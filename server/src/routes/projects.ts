import { Router, Request, Response } from 'express';
import type { Project, ApiResponse } from '@cc-orchestrator/shared';
import {
  createProject,
  getProject,
  getProjectByPath,
  listProjects,
  updateProject,
  deleteProject,
  ensureProjectExists,
} from '../services/projects.service.js';
import { getGitRemoteInfo } from '../services/context-gathering.service.js';

const router = Router();

/**
 * GET /api/projects
 * List all registered projects
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const projects = listProjects();
    const response: ApiResponse<Project[]> = { success: true, data: projects };
    res.json(response);
  } catch (error) {
    console.error('Failed to list projects:', error);
    const response: ApiResponse<Project[]> = { success: false, error: 'Failed to list projects' };
    res.status(500).json(response);
  }
});

/**
 * GET /api/projects/:id
 * Get a single project by ID
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const project = getProject(req.params.id);
    if (project) {
      res.json({ success: true, data: project });
    } else {
      res.status(404).json({ success: false, error: 'Project not found' });
    }
  } catch (error) {
    console.error('Failed to get project:', error);
    res.status(500).json({ success: false, error: 'Failed to get project' });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, path, gitRemote, repoName } = req.body;

    if (!name || !path) {
      return res.status(400).json({
        success: false,
        error: 'Name and path are required',
      });
    }

    // Check if project already exists for this path
    const existing = getProjectByPath(path);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'A project already exists for this path',
        data: existing,
      });
    }

    // Auto-detect git info if not provided
    let finalGitRemote = gitRemote;
    let finalRepoName = repoName;

    if (!gitRemote || !repoName) {
      const gitInfo = await getGitRemoteInfo(path);
      if (gitInfo) {
        finalGitRemote = finalGitRemote || gitInfo.remote;
        finalRepoName = finalRepoName || gitInfo.repoName;
      }
    }

    const project = createProject({
      name,
      path,
      gitRemote: finalGitRemote,
      repoName: finalRepoName,
    });

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('Failed to create project:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
});

/**
 * POST /api/projects/ensure
 * Ensure a project exists for a path (creates if needed)
 * Used when instances open directories
 */
router.post('/ensure', async (req: Request, res: Response) => {
  try {
    const { path, name } = req.body;

    if (!path) {
      return res.status(400).json({
        success: false,
        error: 'Path is required',
      });
    }

    // Auto-detect git info
    const gitInfo = await getGitRemoteInfo(path);

    const project = ensureProjectExists(
      path,
      name,
      gitInfo ? { remote: gitInfo.remote, repoName: gitInfo.repoName } : undefined
    );

    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Failed to ensure project:', error);
    res.status(500).json({ success: false, error: 'Failed to ensure project exists' });
  }
});

/**
 * PATCH /api/projects/:id
 * Update a project
 */
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const { name, gitRemote, repoName } = req.body;

    const project = updateProject(req.params.id, {
      name,
      gitRemote,
      repoName,
    });

    if (project) {
      res.json({ success: true, data: project });
    } else {
      res.status(404).json({ success: false, error: 'Project not found' });
    }
  } catch (error) {
    console.error('Failed to update project:', error);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteProject(req.params.id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Project not found' });
    }
  } catch (error) {
    console.error('Failed to delete project:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

export default router;
