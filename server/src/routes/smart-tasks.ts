import { Router, Request, Response } from 'express';
import type { ParsedTasksResponse } from '@cc-orchestrator/shared';
import {
  parseTaskInput,
  provideTaskClarification,
  getParsingSession,
  clearParsingSession,
  getRoutableTasks,
  getTasksNeedingClarification,
  validateTasksForRouting,
} from '../services/smart-tasks.service.js';
import { checkClaudeCliAvailable } from '../services/claude-cli.service.js';

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

export default router;
