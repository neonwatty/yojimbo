import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type {
  ParsedTasksResponse,
  SetupProjectRequest,
  CreateAndDispatchRequest,
  CreateAndDispatchResponse,
  CreateAndDispatchResult,
} from '@cc-orchestrator/shared';
import {
  parseTaskInput,
  provideTaskClarification,
  getParsingSession,
  clearParsingSession,
  getRoutableTasks,
  getTasksNeedingClarification,
  validateTasksForRouting,
  validatePath,
  setupProject,
  getExpandedPath,
} from '../services/smart-tasks.service.js';
import { checkClaudeCliAvailable } from '../services/claude-cli.service.js';
import { getDatabase } from '../db/connection.js';
import { terminalManager } from '../services/terminal-manager.service.js';
import { broadcast } from '../websocket/server.js';
import { createTask, dispatchTask } from '../services/tasks.service.js';
import { getProject, linkInstanceToProject } from '../services/projects.service.js';

const router = Router();

/**
 * GET /api/smart-tasks/status
 * Check if the smart tasks feature is available (Claude CLI installed)
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const cliAvailable = await checkClaudeCliAvailable();

    res.json({
      success: true,
      data: {
        available: cliAvailable,
        message: cliAvailable
          ? 'Smart Tasks is ready'
          : 'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code',
      },
    });
  } catch (error) {
    console.error('Failed to check smart tasks status:', error);
    res.status(500).json({ success: false, error: 'Failed to check status' });
  }
});

/**
 * POST /api/smart-tasks/parse
 * Parse free-form task input into structured tasks
 */
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { input } = req.body;

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Input is required and must be a non-empty string',
      });
    }

    console.log(`📝 Parsing task input: "${input.substring(0, 100)}${input.length > 100 ? '...' : ''}"`);

    const result = await parseTaskInput(input.trim());

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // Enhance response with helpful info
    const routableTasks = getRoutableTasks(result.data);
    const tasksNeedingClarification = getTasksNeedingClarification(result.data);

    res.json({
      success: true,
      data: {
        ...result.data,
        sessionId: result.sessionId,
        needsClarification: result.needsClarification,
        summary: {
          totalTasks: result.data.tasks.length,
          routableCount: routableTasks.length,
          needsClarificationCount: tasksNeedingClarification.length,
          estimatedCost: `$${result.cost.toFixed(4)}`,
        },
      },
    });
  } catch (error) {
    console.error('Failed to parse tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to parse tasks' });
  }
});

/**
 * POST /api/smart-tasks/clarify
 * Provide clarification for ambiguous tasks
 */
router.post('/clarify', async (req: Request, res: Response) => {
  try {
    const { sessionId, clarification } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required',
      });
    }

    if (!clarification || typeof clarification !== 'string' || clarification.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'clarification is required and must be a non-empty string',
      });
    }

    console.log(`💬 Processing clarification for session ${sessionId}`);

    const result = await provideTaskClarification(sessionId, clarification.trim());

    if (!result.success) {
      return res.status(result.error.includes('not found') ? 404 : 500).json({
        success: false,
        error: result.error,
      });
    }

    const routableTasks = getRoutableTasks(result.data);
    const tasksNeedingClarification = getTasksNeedingClarification(result.data);

    res.json({
      success: true,
      data: {
        ...result.data,
        needsClarification: result.needsClarification,
        summary: {
          totalTasks: result.data.tasks.length,
          routableCount: routableTasks.length,
          needsClarificationCount: tasksNeedingClarification.length,
          estimatedCost: `$${result.cost.toFixed(4)}`,
        },
      },
    });
  } catch (error) {
    console.error('Failed to process clarification:', error);
    res.status(500).json({ success: false, error: 'Failed to process clarification' });
  }
});

/**
 * GET /api/smart-tasks/session/:sessionId
 * Get the current state of a parsing session
 */
router.get('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const session = getParsingSession(req.params.sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or expired',
      });
    }

    const routableTasks = getRoutableTasks(session.tasks);
    const tasksNeedingClarification = getTasksNeedingClarification(session.tasks);

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        input: session.input,
        tasks: session.tasks,
        clarificationRound: session.clarificationRound,
        createdAt: session.createdAt.toISOString(),
        summary: {
          totalTasks: session.tasks.tasks.length,
          routableCount: routableTasks.length,
          needsClarificationCount: tasksNeedingClarification.length,
        },
      },
    });
  } catch (error) {
    console.error('Failed to get session:', error);
    res.status(500).json({ success: false, error: 'Failed to get session' });
  }
});

/**
 * DELETE /api/smart-tasks/session/:sessionId
 * Clear a parsing session
 */
router.delete('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const deleted = clearParsingSession(req.params.sessionId);

    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Session not found' });
    }
  } catch (error) {
    console.error('Failed to clear session:', error);
    res.status(500).json({ success: false, error: 'Failed to clear session' });
  }
});

/**
 * POST /api/smart-tasks/validate
 * Validate that tasks are ready for routing
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { tasks } = req.body as { tasks: ParsedTasksResponse };

    if (!tasks || !tasks.tasks || !Array.isArray(tasks.tasks)) {
      return res.status(400).json({
        success: false,
        error: 'tasks object with tasks array is required',
      });
    }

    const validation = validateTasksForRouting(tasks);

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        issues: validation.issues,
        routableTasks: getRoutableTasks(tasks),
      },
    });
  } catch (error) {
    console.error('Failed to validate tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to validate tasks' });
  }
});

/**
 * POST /api/smart-tasks/validate-path
 * Validate a filesystem path for cloning
 */
router.post('/validate-path', (req: Request, res: Response) => {
  try {
    const { path } = req.body as { path: string };

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'path is required',
      });
    }

    const validation = validatePath(path);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Failed to validate path:', error);
    res.status(500).json({ success: false, error: 'Failed to validate path' });
  }
});

/**
 * POST /api/smart-tasks/expand-path
 * Expand a path (e.g., ~ to home directory) for display
 */
router.post('/expand-path', (req: Request, res: Response) => {
  try {
    const { path } = req.body as { path: string };

    if (!path || typeof path !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'path is required',
      });
    }

    const expandedPath = getExpandedPath(path);

    res.json({
      success: true,
      data: { expandedPath },
    });
  } catch (error) {
    console.error('Failed to expand path:', error);
    res.status(500).json({ success: false, error: 'Failed to expand path' });
  }
});

/**
 * Helper function to create an instance (used by setupProject)
 * This mirrors the logic from instances.ts but returns just what we need
 */
async function createInstanceHelper(
  name: string,
  workingDir: string
): Promise<{ id: string; name: string }> {
  const db = getDatabase();
  const id = uuidv4();

  // Get max display order
  interface MaxOrderRow {
    max: number | null;
  }
  const maxOrder = db.prepare('SELECT MAX(display_order) as max FROM instances WHERE closed_at IS NULL').get() as MaxOrderRow | undefined;
  const displayOrder = (maxOrder?.max || 0) + 1;

  // Spawn terminal backend
  await terminalManager.spawn(id, {
    type: 'local',
    workingDir,
  });

  // Get PID
  const pid = terminalManager.getPid(id);

  // Insert into database
  db.prepare(`
    INSERT INTO instances (id, name, working_dir, status, display_order, pid, machine_type, machine_id)
    VALUES (?, ?, ?, 'idle', ?, ?, 'local', NULL)
  `).run(id, name, workingDir, displayOrder, pid);

  // Get the full instance row for broadcasting
  interface InstanceRow {
    id: string;
    name: string;
    working_dir: string;
    status: string;
    is_pinned: number;
    display_order: number;
    pid: number | null;
    machine_type: string;
    machine_id: string | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
  }
  const row = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as InstanceRow;

  // Broadcast creation
  broadcast({
    type: 'instance:created',
    instance: {
      id: row.id,
      name: row.name,
      workingDir: row.working_dir,
      status: row.status as 'idle' | 'working' | 'error' | 'disconnected',
      isPinned: Boolean(row.is_pinned),
      displayOrder: row.display_order,
      pid: row.pid,
      machineType: row.machine_type as 'local' | 'remote',
      machineId: row.machine_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      closedAt: row.closed_at,
    },
  });

  return { id, name };
}

/**
 * POST /api/smart-tasks/setup-project
 * Clone a repository and create an instance for it
 */
router.post('/setup-project', async (req: Request, res: Response) => {
  try {
    const { sessionId, taskId, action, gitRepoUrl, targetPath, instanceName } = req.body as SetupProjectRequest;

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required',
      });
    }

    if (!gitRepoUrl || typeof gitRepoUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'gitRepoUrl is required',
      });
    }

    if (!targetPath || typeof targetPath !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'targetPath is required',
      });
    }

    if (action !== 'clone-and-create') {
      return res.status(400).json({
        success: false,
        error: 'Only "clone-and-create" action is currently supported',
      });
    }

    console.log(`🚀 Setting up project from ${gitRepoUrl} to ${targetPath}`);

    const result = await setupProject(
      { sessionId, taskId, action, gitRepoUrl, targetPath, instanceName },
      createInstanceHelper
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        data: result,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to setup project:', error);
    res.status(500).json({ success: false, error: 'Failed to setup project' });
  }
});

/**
 * POST /api/smart-tasks/create-and-dispatch
 * Create tasks and dispatch them to instances in one operation
 */
router.post('/create-and-dispatch', async (req: Request, res: Response) => {
  try {
    const { sessionId, tasks } = req.body as CreateAndDispatchRequest;

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required',
      });
    }

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tasks array is required and must not be empty',
      });
    }

    console.log(`🚀 Creating and dispatching ${tasks.length} tasks`);

    const results: CreateAndDispatchResult[] = [];
    const newInstances: Array<{ id: string; name: string }> = [];
    let createdCount = 0;
    let dispatchedCount = 0;

    for (const taskData of tasks) {
      try {
        // Get project info for the task text
        const project = getProject(taskData.projectId);
        const projectName = project?.name || 'Unknown';

        // Create the global task
        const task = createTask(taskData.text);
        createdCount++;

        // Handle dispatch based on target type
        const target = taskData.dispatchTarget;

        if (target.type === 'none') {
          // Just create the task, don't dispatch
          results.push({
            taskId: task.id,
            status: 'created',
          });
          continue;
        }

        if (target.type === 'new-instance') {
          // Create a new instance first
          const instanceName = target.newInstanceName || `${projectName}-task`;
          const workingDir = target.workingDir || project?.path || '~';

          try {
            const newInstance = await createInstanceHelper(instanceName, workingDir);
            newInstances.push(newInstance);

            // Link instance to project if we have one
            if (taskData.projectId) {
              linkInstanceToProject(taskData.projectId, newInstance.id);
            }

            // Dispatch to the new instance
            await dispatchToInstance(task.id, newInstance.id, taskData.text);
            dispatchedCount++;

            results.push({
              taskId: task.id,
              status: 'dispatched',
              instanceId: newInstance.id,
            });
          } catch (instanceError) {
            console.error(`Failed to create instance for task ${task.id}:`, instanceError);
            results.push({
              taskId: task.id,
              status: 'error',
              error: `Failed to create instance: ${instanceError instanceof Error ? instanceError.message : 'Unknown error'}`,
            });
          }
          continue;
        }

        if (target.type === 'instance' && target.instanceId) {
          // Dispatch to existing instance
          try {
            await dispatchToInstance(task.id, target.instanceId, taskData.text);
            dispatchedCount++;

            results.push({
              taskId: task.id,
              status: 'dispatched',
              instanceId: target.instanceId,
            });
          } catch (dispatchError) {
            console.error(`Failed to dispatch task ${task.id}:`, dispatchError);
            results.push({
              taskId: task.id,
              status: 'error',
              error: `Failed to dispatch: ${dispatchError instanceof Error ? dispatchError.message : 'Unknown error'}`,
            });
          }
          continue;
        }

        // Fallback: just mark as created
        results.push({
          taskId: task.id,
          status: 'created',
        });
      } catch (taskError) {
        console.error(`Failed to create task:`, taskError);
        results.push({
          taskId: '',
          status: 'error',
          error: `Failed to create task: ${taskError instanceof Error ? taskError.message : 'Unknown error'}`,
        });
      }
    }

    const response: CreateAndDispatchResponse = {
      created: createdCount,
      dispatched: dispatchedCount,
      newInstances,
      results,
    };

    console.log(`✅ Created ${createdCount} tasks, dispatched ${dispatchedCount}, created ${newInstances.length} new instances`);

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Failed to create and dispatch tasks:', error);
    res.status(500).json({ success: false, error: 'Failed to create and dispatch tasks' });
  }
});

/**
 * Helper function to dispatch a task to an instance
 */
async function dispatchToInstance(taskId: string, instanceId: string, taskText: string): Promise<void> {
  // Update task status via tasks service
  dispatchTask(taskId, instanceId);

  // Write the task text to the terminal
  terminalManager.write(instanceId, taskText + '\n');
}

export default router;
