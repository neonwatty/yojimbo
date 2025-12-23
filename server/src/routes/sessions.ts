import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import type { Session, SessionMessage } from '@cc-orchestrator/shared';

const router = Router();

// Helper to convert DB row to Session
function rowToSession(row: any): Session {
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
function rowToMessage(row: any): SessionMessage {
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
      .all(pageSize, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM sessions').get() as any;

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
      .all(`%${query}%`, `%${query}%`);

    res.json({ success: true, data: rows.map(rowToSession) });
  } catch (error) {
    console.error('Error searching sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to search sessions' });
  }
});

// GET /api/sessions/:id - Get session details
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);

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

    // Check if session exists
    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const rows = db
      .prepare(`
        SELECT * FROM session_messages
        WHERE session_id = ?
        ORDER BY timestamp ASC
        LIMIT ? OFFSET ?
      `)
      .all(req.params.id, pageSize, offset);

    const total = db
      .prepare('SELECT COUNT(*) as count FROM session_messages WHERE session_id = ?')
      .get(req.params.id) as any;

    res.json({
      success: true,
      data: {
        items: rows.map(rowToMessage),
        total: total.count,
        page,
        pageSize,
        hasMore: offset + rows.length < total.count,
      },
    });
  } catch (error) {
    console.error('Error getting session messages:', error);
    res.status(500).json({ success: false, error: 'Failed to get session messages' });
  }
});

export default router;
