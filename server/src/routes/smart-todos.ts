import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type {
  ParsedTodosResponse,
  SetupProjectRequest,
  CreateAndDispatchRequest,
  CreateAndDispatchResponse,
  CreateAndDispatchResult,
} from '@cc-orchestrator/shared';
import {
  parseTodoInput,
  provideTodoClarification,
  getParsingSession,
  clearParsingSession,
  getRoutableTodos,
  getTodosNeedingClarification,
  validateTodosForRouting,
  validatePath,
  setupProject,
  getExpandedPath,
} from '../services/smart-todos.service.js';
import { checkClaudeCliAvailable } from '../services/claude-cli.service.js';
import { getDatabase } from '../db/connection.js';
import { terminalManager } from '../services/terminal-manager.service.js';
import { broadcast } from '../websocket/server.js';
import { createTodo, dispatchTodo } from '../services/todos.service.js';
import { getProject, linkInstanceToProject } from '../services/projects.service.js';

const router = Router();

/**
 * GET /api/smart-todos/status
 * Check if the smart todos feature is available (Claude CLI installed)
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const cliAvailable = await checkClaudeCliAvailable();

    res.json({
      success: true,
      data: {
        available: cliAvailable,
        message: cliAvailable
          ? 'Smart Todos is ready'
          : 'Claude CLI not found. Install it with: npm install -g @anthropic-ai/claude-code',
      },
    });
  } catch (error) {
    console.error('Failed to check smart todos status:', error);
    res.status(500).json({ success: false, error: 'Failed to check status' });
  }
});

/**
 * POST /api/smart-todos/parse
 * Parse free-form todo input into structured todos
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

    console.log(`📝 Parsing todo input: "${input.substring(0, 100)}${input.length > 100 ? '...' : ''}"`);

    const result = await parseTodoInput(input.trim());

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    // Enhance response with helpful info
    const routableTodos = getRoutableTodos(result.data);
    const todosNeedingClarification = getTodosNeedingClarification(result.data);

    res.json({
      success: true,
      data: {
        ...result.data,
        sessionId: result.sessionId,
        needsClarification: result.needsClarification,
        summary: {
          totalTodos: result.data.todos.length,
          routableCount: routableTodos.length,
          needsClarificationCount: todosNeedingClarification.length,
          estimatedCost: `$${result.cost.toFixed(4)}`,
        },
      },
    });
  } catch (error) {
    console.error('Failed to parse todos:', error);
    res.status(500).json({ success: false, error: 'Failed to parse todos' });
  }
});

/**
 * POST /api/smart-todos/clarify
 * Provide clarification for ambiguous todos
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

    const result = await provideTodoClarification(sessionId, clarification.trim());

    if (!result.success) {
      return res.status(result.error.includes('not found') ? 404 : 500).json({
        success: false,
        error: result.error,
      });
    }

    const routableTodos = getRoutableTodos(result.data);
    const todosNeedingClarification = getTodosNeedingClarification(result.data);

    res.json({
      success: true,
      data: {
        ...result.data,
        needsClarification: result.needsClarification,
        summary: {
          totalTodos: result.data.todos.length,
          routableCount: routableTodos.length,
          needsClarificationCount: todosNeedingClarification.length,
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
 * GET /api/smart-todos/session/:sessionId
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

    const routableTodos = getRoutableTodos(session.todos);
    const todosNeedingClarification = getTodosNeedingClarification(session.todos);

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        input: session.input,
        todos: session.todos,
        clarificationRound: session.clarificationRound,
        createdAt: session.createdAt.toISOString(),
        summary: {
          totalTodos: session.todos.todos.length,
          routableCount: routableTodos.length,
          needsClarificationCount: todosNeedingClarification.length,
        },
      },
    });
  } catch (error) {
    console.error('Failed to get session:', error);
    res.status(500).json({ success: false, error: 'Failed to get session' });
  }
});

/**
 * DELETE /api/smart-todos/session/:sessionId
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
 * POST /api/smart-todos/validate
 * Validate that todos are ready for routing
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { todos } = req.body as { todos: ParsedTodosResponse };

    if (!todos || !todos.todos || !Array.isArray(todos.todos)) {
      return res.status(400).json({
        success: false,
        error: 'todos object with todos array is required',
      });
    }

    const validation = validateTodosForRouting(todos);

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        issues: validation.issues,
        routableTodos: getRoutableTodos(todos),
      },
    });
  } catch (error) {
    console.error('Failed to validate todos:', error);
    res.status(500).json({ success: false, error: 'Failed to validate todos' });
  }
});

/**
 * POST /api/smart-todos/validate-path
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
 * POST /api/smart-todos/expand-path
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
 * POST /api/smart-todos/setup-project
 * Clone a repository and create an instance for it
 */
router.post('/setup-project', async (req: Request, res: Response) => {
  try {
    const { sessionId, todoId, action, gitRepoUrl, targetPath, instanceName } = req.body as SetupProjectRequest;

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
      { sessionId, todoId, action, gitRepoUrl, targetPath, instanceName },
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
 * POST /api/smart-todos/create-and-dispatch
 * Create todos and dispatch them to instances in one operation
 */
router.post('/create-and-dispatch', async (req: Request, res: Response) => {
  try {
    const { sessionId, todos } = req.body as CreateAndDispatchRequest;

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required',
      });
    }

    if (!todos || !Array.isArray(todos) || todos.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'todos array is required and must not be empty',
      });
    }

    console.log(`🚀 Creating and dispatching ${todos.length} todos`);

    const results: CreateAndDispatchResult[] = [];
    const newInstances: Array<{ id: string; name: string }> = [];
    let createdCount = 0;
    let dispatchedCount = 0;

    for (const todoData of todos) {
      try {
        // Get project info for the todo text
        const project = getProject(todoData.projectId);
        const projectName = project?.name || 'Unknown';

        // Create the global todo
        const todo = createTodo(todoData.text);
        createdCount++;

        // Handle dispatch based on target type
        const target = todoData.dispatchTarget;

        if (target.type === 'none') {
          // Just create the todo, don't dispatch
          results.push({
            todoId: todo.id,
            status: 'created',
          });
          continue;
        }

        if (target.type === 'new-instance') {
          // Create a new instance first
          const instanceName = target.newInstanceName || `${projectName}-todo`;
          const workingDir = target.workingDir || project?.path || '~';

          try {
            const newInstance = await createInstanceHelper(instanceName, workingDir);
            newInstances.push(newInstance);

            // Link instance to project if we have one
            if (todoData.projectId) {
              linkInstanceToProject(todoData.projectId, newInstance.id);
            }

            // Dispatch to the new instance
            await dispatchToInstance(todo.id, newInstance.id, todoData.text);
            dispatchedCount++;

            results.push({
              todoId: todo.id,
              status: 'dispatched',
              instanceId: newInstance.id,
            });
          } catch (instanceError) {
            console.error(`Failed to create instance for todo ${todo.id}:`, instanceError);
            results.push({
              todoId: todo.id,
              status: 'error',
              error: `Failed to create instance: ${instanceError instanceof Error ? instanceError.message : 'Unknown error'}`,
            });
          }
          continue;
        }

        if (target.type === 'instance' && target.instanceId) {
          // Dispatch to existing instance
          try {
            await dispatchToInstance(todo.id, target.instanceId, todoData.text);
            dispatchedCount++;

            results.push({
              todoId: todo.id,
              status: 'dispatched',
              instanceId: target.instanceId,
            });
          } catch (dispatchError) {
            console.error(`Failed to dispatch todo ${todo.id}:`, dispatchError);
            results.push({
              todoId: todo.id,
              status: 'error',
              error: `Failed to dispatch: ${dispatchError instanceof Error ? dispatchError.message : 'Unknown error'}`,
            });
          }
          continue;
        }

        // Fallback: just mark as created
        results.push({
          todoId: todo.id,
          status: 'created',
        });
      } catch (todoError) {
        console.error(`Failed to create todo:`, todoError);
        results.push({
          todoId: '',
          status: 'error',
          error: `Failed to create todo: ${todoError instanceof Error ? todoError.message : 'Unknown error'}`,
        });
      }
    }

    const response: CreateAndDispatchResponse = {
      created: createdCount,
      dispatched: dispatchedCount,
      newInstances,
      results,
    };

    console.log(`✅ Created ${createdCount} todos, dispatched ${dispatchedCount}, created ${newInstances.length} new instances`);

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Failed to create and dispatch todos:', error);
    res.status(500).json({ success: false, error: 'Failed to create and dispatch todos' });
  }
});

/**
 * Helper function to dispatch a todo to an instance
 */
async function dispatchToInstance(todoId: string, instanceId: string, todoText: string): Promise<void> {
  // Update todo status via todos service
  dispatchTodo(todoId, instanceId);

  // Write the todo text to the terminal
  terminalManager.write(instanceId, todoText + '\n');
}

export default router;
