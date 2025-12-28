import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import type { Session, SessionMessage } from '@cc-orchestrator/shared';

const router = Router();

// Database row types
interface SessionRow {
  id: string;
  instance_id: string;
  project_path: string;
  jsonl_path: string;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  token_count: number;
  summary: string | null;
}

interface SessionMessageRow {
  id: number;
  session_id: string;
  message_type: 'user' | 'assistant' | 'tool';
  preview: string | null;
  token_count: number | null;
  tool_name: string | null;
  timestamp: string;
}

interface CountResult {
  count: number;
}

// Helper to convert DB row to Session
function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    instanceId: row.instance_id,
    projectPath: row.project_path,
    jsonlPath: row.jsonl_path,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    messageCount: row.message_count,
    tokenCount: row.token_count,
    summary: row.summary,
  };
}

// Helper to convert DB row to SessionMessage
function rowToMessage(row: SessionMessageRow): SessionMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    messageType: row.message_type,
    preview: row.preview,
    tokenCount: row.token_count,
    toolName: row.tool_name,
    timestamp: row.timestamp,
  };
}

// GET /api/sessions - List sessions with pagination
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

    const rows = db
      .prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ? OFFSET ?')
      .all(pageSize, offset) as SessionRow[];

    const total = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as CountResult;

    res.json({
      success: true,
      data: {
        items: rows.map(rowToSession),
        total: total.count,
        page,
        pageSize,
        hasMore: offset + rows.length < total.count,
      },
    });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to list sessions' });
  }
});

// GET /api/sessions/search - Search sessions
router.get('/search', (req, res) => {
  try {
    const db = getDatabase();
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const rows = db
      .prepare(`
        SELECT * FROM sessions
        WHERE summary LIKE ? OR project_path LIKE ?
        ORDER BY started_at DESC
        LIMIT 50
      `)
      .all(`%${query}%`, `%${query}%`) as SessionRow[];

    res.json({ success: true, data: rows.map(rowToSession) });
  } catch (error) {
    console.error('Error searching sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to search sessions' });
  }
});

// GET /api/sessions/by-directory - List sessions for a specific directory
router.get('/by-directory', (req, res) => {
  try {
    const db = getDatabase();
    const dirPath = req.query.path as string;

    if (!dirPath) {
      return res.status(400).json({ success: false, error: 'Directory path is required' });
    }

    // Expand ~ to home directory and normalize path
    const normalizedPath = dirPath.startsWith('~')
      ? dirPath.replace('~', process.env.HOME || '')
      : dirPath;

    // Remove trailing slashes for consistent matching
    const cleanPath = normalizedPath.replace(/\/+$/, '');

    // Query sessions where project_path matches exactly
    const rows = db
      .prepare(`
        SELECT * FROM sessions
        WHERE project_path = ?
        ORDER BY started_at DESC
        LIMIT 10
      `)
      .all(cleanPath) as SessionRow[];

    res.json({ success: true, data: rows.map(rowToSession) });
  } catch (error) {
    console.error('Error listing sessions by directory:', error);
    res.status(500).json({ success: false, error: 'Failed to list sessions' });
  }
});

// GET /api/sessions/:id - Get session details
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as SessionRow | undefined;

    if (!row) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, data: rowToSession(row) });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ success: false, error: 'Failed to get session' });
  }
});

// GET /api/sessions/:id/messages - Get session messages
router.get('/:id/messages', (req, res) => {
  try {
    const db = getDatabase();
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const offset = (page - 1) * pageSize;

    // Get messages and total count in a single query using a subquery
    // This avoids N+1 by combining session check + messages + count
    const rows = db
      .prepare(`
        SELECT sm.*, (SELECT COUNT(*) FROM session_messages WHERE session_id = ?) as total_count
        FROM session_messages sm
        WHERE sm.session_id = ?
        ORDER BY sm.timestamp ASC
        LIMIT ? OFFSET ?
      `)
      .all(req.params.id, req.params.id, pageSize, offset) as (SessionMessageRow & { total_count: number })[];

    // If no messages and page 1, check if session exists
    if (rows.length === 0 && page === 1) {
      const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(req.params.id);
      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }
    }

    const totalCount = rows.length > 0 ? rows[0].total_count : 0;

    res.json({
      success: true,
      data: {
        items: rows.map(rowToMessage),
        total: totalCount,
        page,
        pageSize,
        hasMore: offset + rows.length < totalCount,
      },
    });
  } catch (error) {
    console.error('Error getting session messages:', error);
    res.status(500).json({ success: false, error: 'Failed to get session messages' });
  }
});

export default router;
