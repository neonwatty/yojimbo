import { Router, Request, Response } from 'express';
import type {
  GlobalTask,
  TaskStats,
  ApiResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  DispatchTaskRequest,
  ReorderTasksRequest,
} from '@cc-orchestrator/shared';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  dispatchTask,
  markTaskDone,
  archiveTask,
  reorderTasks,
  getTaskStats,
} from '../services/tasks.service.js';
import { terminalManager } from '../services/terminal-manager.service.js';

const router = Router();

// GET /api/tasks - List all tasks
router.get('/', (req: Request, res: Response) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const tasks = listTasks(includeArchived);
    const response: ApiResponse<GlobalTask[]> = { success: true, data: tasks };
    res.json(response);
  } catch (error) {
    console.error('Failed to list tasks:', error);
    const response: ApiResponse<GlobalTask[]> = { success: false, error: 'Failed to list tasks' };
    res.status(500).json(response);
  }
});

// GET /api/tasks/stats - Get task statistics
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getTaskStats();
    const response: ApiResponse<TaskStats> = { success: true, data: stats };
    res.json(response);
  } catch (error) {
    console.error('Failed to get task stats:', error);
    const response: ApiResponse<TaskStats> = { success: false, error: 'Failed to get task stats' };
    res.status(500).json(response);
  }
});

// POST /api/tasks - Create new task
router.post('/', (req: Request, res: Response) => {
  try {
    const { text } = req.body as CreateTaskRequest;

    if (!text || text.trim().length === 0) {
      const response: ApiResponse<GlobalTask> = { success: false, error: 'Task text is required' };
      return res.status(400).json(response);
    }

    const task = createTask(text.trim());
    const response: ApiResponse<GlobalTask> = { success: true, data: task };
    res.status(201).json(response);
  } catch (error) {
    console.error('Failed to create task:', error);
    const response: ApiResponse<GlobalTask> = { success: false, error: 'Failed to create task' };
    res.status(500).json(response);
  }
});

// GET /api/tasks/:id - Get single task
router.get('/:id', (req: Request, res: Response) => {
  try {
    const task = getTask(req.params.id);
    if (task) {
      const response: ApiResponse<GlobalTask> = { success: true, data: task };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTask> = { success: false, error: 'Task not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to get task:', error);
    const response: ApiResponse<GlobalTask> = { success: false, error: 'Failed to get task' };
    res.status(500).json(response);
  }
});

// PATCH /api/tasks/:id - Update task
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const updates = req.body as UpdateTaskRequest;
    const task = updateTask(req.params.id, updates);

    if (task) {
      const response: ApiResponse<GlobalTask> = { success: true, data: task };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTask> = { success: false, error: 'Task not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to update task:', error);
    const response: ApiResponse<GlobalTask> = { success: false, error: 'Failed to update task' };
    res.status(500).json(response);
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteTask(req.params.id);
    if (deleted) {
      const response: ApiResponse<void> = { success: true };
      res.json(response);
    } else {
      const response: ApiResponse<void> = { success: false, error: 'Task not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to delete task:', error);
    const response: ApiResponse<void> = { success: false, error: 'Failed to delete task' };
    res.status(500).json(response);
  }
});

// POST /api/tasks/:id/dispatch - Dispatch task to instance
router.post('/:id/dispatch', async (req: Request, res: Response) => {
  try {
    const { instanceId, copyToClipboard } = req.body as DispatchTaskRequest;

    // Get the task first
    const task = getTask(req.params.id);
    if (!task) {
      const response: ApiResponse<GlobalTask> = { success: false, error: 'Task not found' };
      return res.status(404).json(response);
    }

    // If copyToClipboard, just return the text (client handles clipboard)
    if (copyToClipboard) {
      const response: ApiResponse<{ text: string }> = { success: true, data: { text: task.text } };
      return res.json(response);
    }

    // Validate instance exists
    if (!instanceId) {
      const response: ApiResponse<GlobalTask> = { success: false, error: 'Instance ID is required' };
      return res.status(400).json(response);
    }

    // Write to terminal
    try {
      terminalManager.write(instanceId, task.text + '\n');
    } catch (termError) {
      console.error('Failed to write to terminal:', termError);
      const response: ApiResponse<GlobalTask> = { success: false, error: 'Failed to write to terminal' };
      return res.status(500).json(response);
    }

    // Update task status
    const updatedTask = dispatchTask(req.params.id, instanceId);
    if (updatedTask) {
      const response: ApiResponse<GlobalTask> = { success: true, data: updatedTask };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTask> = { success: false, error: 'Failed to update task' };
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('Failed to dispatch task:', error);
    const response: ApiResponse<GlobalTask> = { success: false, error: 'Failed to dispatch task' };
    res.status(500).json(response);
  }
});

// POST /api/tasks/:id/done - Mark task as done
router.post('/:id/done', (req: Request, res: Response) => {
  try {
    const task = markTaskDone(req.params.id);
    if (task) {
      const response: ApiResponse<GlobalTask> = { success: true, data: task };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTask> = { success: false, error: 'Task not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to mark task as done:', error);
    const response: ApiResponse<GlobalTask> = { success: false, error: 'Failed to mark task as done' };
    res.status(500).json(response);
  }
});

// POST /api/tasks/:id/archive - Archive task
router.post('/:id/archive', (req: Request, res: Response) => {
  try {
    const task = archiveTask(req.params.id);
    if (task) {
      const response: ApiResponse<GlobalTask> = { success: true, data: task };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTask> = { success: false, error: 'Task not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to archive task:', error);
    const response: ApiResponse<GlobalTask> = { success: false, error: 'Failed to archive task' };
    res.status(500).json(response);
  }
});

// POST /api/tasks/reorder - Reorder tasks
router.post('/reorder', (req: Request, res: Response) => {
  try {
    const { taskIds } = req.body as ReorderTasksRequest;

    if (!taskIds || !Array.isArray(taskIds)) {
      const response: ApiResponse<void> = { success: false, error: 'taskIds array is required' };
      return res.status(400).json(response);
    }

    reorderTasks(taskIds);
    const response: ApiResponse<void> = { success: true };
    res.json(response);
  } catch (error) {
    console.error('Failed to reorder tasks:', error);
    const response: ApiResponse<void> = { success: false, error: 'Failed to reorder tasks' };
    res.status(500).json(response);
  }
});

export default router;
