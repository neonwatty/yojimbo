import { Router, Request, Response } from 'express';
import type { ActivityEvent, ActivityFeedStats, ApiResponse } from '@cc-orchestrator/shared';
import {
  listActivityEvents,
  getActivityFeedStats,
  markEventAsRead,
  markAllEventsAsRead,
  clearAllEvents,
} from '../services/feed.service.js';

const router = Router();

// GET /api/feed - List activity events
router.get('/', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const events = listActivityEvents(limit, offset);
    const response: ApiResponse<ActivityEvent[]> = { success: true, data: events };
    res.json(response);
  } catch (error) {
    console.error('Failed to list activity events:', error);
    const response: ApiResponse<ActivityEvent[]> = { success: false, error: 'Failed to list activity events' };
    res.status(500).json(response);
  }
});

// GET /api/feed/stats - Get feed statistics
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getActivityFeedStats();
    const response: ApiResponse<ActivityFeedStats> = { success: true, data: stats };
    res.json(response);
  } catch (error) {
    console.error('Failed to get feed stats:', error);
    const response: ApiResponse<ActivityFeedStats> = { success: false, error: 'Failed to get feed stats' };
    res.status(500).json(response);
  }
});

// PATCH /api/feed/:id/read - Mark a single event as read
router.patch('/:id/read', (req: Request, res: Response) => {
  try {
    const event = markEventAsRead(req.params.id);
    if (event) {
      const response: ApiResponse<ActivityEvent> = { success: true, data: event };
      res.json(response);
    } else {
      const response: ApiResponse<ActivityEvent> = { success: false, error: 'Event not found' };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Failed to mark event as read:', error);
    const response: ApiResponse<ActivityEvent> = { success: false, error: 'Failed to mark event as read' };
    res.status(500).json(response);
  }
});

// POST /api/feed/mark-all-read - Mark all events as read
router.post('/mark-all-read', (_req: Request, res: Response) => {
  try {
    const count = markAllEventsAsRead();
    const response: ApiResponse<{ count: number }> = { success: true, data: { count } };
    res.json(response);
  } catch (error) {
    console.error('Failed to mark all events as read:', error);
    const response: ApiResponse<{ count: number }> = { success: false, error: 'Failed to mark all events as read' };
    res.status(500).json(response);
  }
});

// DELETE /api/feed/clear - Clear all events
router.delete('/clear', (_req: Request, res: Response) => {
  try {
    const count = clearAllEvents();
    const response: ApiResponse<{ count: number }> = { success: true, data: { count } };
    res.json(response);
  } catch (error) {
    console.error('Failed to clear events:', error);
    const response: ApiResponse<{ count: number }> = { success: false, error: 'Failed to clear events' };
    res.status(500).json(response);
  }
});

export default router;
