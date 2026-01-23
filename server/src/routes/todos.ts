import { Router, Request, Response } from 'express';
import type {
  GlobalTodo,
  TodoStats,
  ApiResponse,
  CreateTodoRequest,
  UpdateTodoRequest,
  DispatchTodoRequest,
  ReorderTodosRequest,
} from '@cc-orchestrator/shared';
import {
  createTodo,
  listTodos,
  getTodo,
  updateTodo,
  deleteTodo,
  dispatchTodo,
  markTodoDone,
  archiveTodo,
  reorderTodos,
  getTodoStats,
} from '../services/todos.service.js';
import { terminalManager } from '../services/terminal-manager.service.js';

const router = Router();

// GET /api/todos - List all todos
router.get('/', (req: Request, res: Response) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const todos = listTodos(includeArchived);
    const response: ApiResponse<GlobalTodo[]> = { success: true, data: todos };
    res.json(response);
  } catch (error) {
    console.error('Failed to list todos:', error);
    const response: ApiResponse<GlobalTodo[]> = { success: false, error: 'Failed to list todos' };
    res.status(500).json(response);
  }
});

// GET /api/todos/stats - Get todo statistics
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getTodoStats();
    const response: ApiResponse<TodoStats> = { success: true, data: stats };
    res.json(response);
  } catch (error) {
    console.error('Failed to get todo stats:', error);
    const response: ApiResponse<TodoStats> = { success: false, error: 'Failed to get todo stats' };
    res.status(500).json(response);
  }
});

// POST /api/todos - Create new todo
router.post('/', (req: Request, res: Response) => {
  try {
    const { text } = req.body as CreateTodoRequest;

    if (!text || text.trim().length === 0) {
      const response: ApiResponse<GlobalTodo> = { success: false, error: 'Todo text is required' };
      return res.status(400).json(response);
    }

    const todo = createTodo(text.trim());
    const response: ApiResponse<GlobalTodo> = { success: true, data: todo };
    res.status(201).json(response);
  } catch (error) {
    console.error('Failed to create todo:', error);
    const response: ApiResponse<GlobalTodo> = { success: false, error: 'Failed to create todo' };
    res.status(500).json(response);
  }
});

// GET /api/todos/:id - Get single todo
router.get('/:id', (req: Request, res: Response) => {
  try {
    const todo = getTodo(req.params.id);
    if (todo) {
      const response: ApiResponse<GlobalTodo> = { success: true, data: todo };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTodo> = { success: false, error: 'Todo not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to get todo:', error);
    const response: ApiResponse<GlobalTodo> = { success: false, error: 'Failed to get todo' };
    res.status(500).json(response);
  }
});

// PATCH /api/todos/:id - Update todo
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const updates = req.body as UpdateTodoRequest;
    const todo = updateTodo(req.params.id, updates);

    if (todo) {
      const response: ApiResponse<GlobalTodo> = { success: true, data: todo };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTodo> = { success: false, error: 'Todo not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to update todo:', error);
    const response: ApiResponse<GlobalTodo> = { success: false, error: 'Failed to update todo' };
    res.status(500).json(response);
  }
});

// DELETE /api/todos/:id - Delete todo
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteTodo(req.params.id);
    if (deleted) {
      const response: ApiResponse<void> = { success: true };
      res.json(response);
    } else {
      const response: ApiResponse<void> = { success: false, error: 'Todo not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to delete todo:', error);
    const response: ApiResponse<void> = { success: false, error: 'Failed to delete todo' };
    res.status(500).json(response);
  }
});

// POST /api/todos/:id/dispatch - Dispatch todo to instance
router.post('/:id/dispatch', async (req: Request, res: Response) => {
  try {
    const { instanceId, copyToClipboard } = req.body as DispatchTodoRequest;

    // Get the todo first
    const todo = getTodo(req.params.id);
    if (!todo) {
      const response: ApiResponse<GlobalTodo> = { success: false, error: 'Todo not found' };
      return res.status(404).json(response);
    }

    // If copyToClipboard, just return the text (client handles clipboard)
    if (copyToClipboard) {
      const response: ApiResponse<{ text: string }> = { success: true, data: { text: todo.text } };
      return res.json(response);
    }

    // Validate instance exists
    if (!instanceId) {
      const response: ApiResponse<GlobalTodo> = { success: false, error: 'Instance ID is required' };
      return res.status(400).json(response);
    }

    // Write to terminal
    try {
      terminalManager.write(instanceId, todo.text + '\n');
    } catch (termError) {
      console.error('Failed to write to terminal:', termError);
      const response: ApiResponse<GlobalTodo> = { success: false, error: 'Failed to write to terminal' };
      return res.status(500).json(response);
    }

    // Update todo status
    const updatedTodo = dispatchTodo(req.params.id, instanceId);
    if (updatedTodo) {
      const response: ApiResponse<GlobalTodo> = { success: true, data: updatedTodo };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTodo> = { success: false, error: 'Failed to update todo' };
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('Failed to dispatch todo:', error);
    const response: ApiResponse<GlobalTodo> = { success: false, error: 'Failed to dispatch todo' };
    res.status(500).json(response);
  }
});

// POST /api/todos/:id/done - Mark todo as done
router.post('/:id/done', (req: Request, res: Response) => {
  try {
    const todo = markTodoDone(req.params.id);
    if (todo) {
      const response: ApiResponse<GlobalTodo> = { success: true, data: todo };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTodo> = { success: false, error: 'Todo not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to mark todo as done:', error);
    const response: ApiResponse<GlobalTodo> = { success: false, error: 'Failed to mark todo as done' };
    res.status(500).json(response);
  }
});

// POST /api/todos/:id/archive - Archive todo
router.post('/:id/archive', (req: Request, res: Response) => {
  try {
    const todo = archiveTodo(req.params.id);
    if (todo) {
      const response: ApiResponse<GlobalTodo> = { success: true, data: todo };
      res.json(response);
    } else {
      const response: ApiResponse<GlobalTodo> = { success: false, error: 'Todo not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to archive todo:', error);
    const response: ApiResponse<GlobalTodo> = { success: false, error: 'Failed to archive todo' };
    res.status(500).json(response);
  }
});

// POST /api/todos/reorder - Reorder todos
router.post('/reorder', (req: Request, res: Response) => {
  try {
    const { todoIds } = req.body as ReorderTodosRequest;

    if (!todoIds || !Array.isArray(todoIds)) {
      const response: ApiResponse<void> = { success: false, error: 'todoIds array is required' };
      return res.status(400).json(response);
    }

    reorderTodos(todoIds);
    const response: ApiResponse<void> = { success: true };
    res.json(response);
  } catch (error) {
    console.error('Failed to reorder todos:', error);
    const response: ApiResponse<void> = { success: false, error: 'Failed to reorder todos' };
    res.status(500).json(response);
  }
});

export default router;
