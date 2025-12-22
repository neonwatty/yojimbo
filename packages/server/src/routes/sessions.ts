import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../db/index.js';
import {
  exportSession,
  getSessionStats,
  clearSession,
  saveSessionState,
} from '../services/session-persistence.js';
import type { Session } from '@cc-orchestrator/shared';

interface CreateSessionBody {
  instanceId?: string;
  name: string;
  workingDir: string;
}

interface UpdateSessionBody {
  name?: string;
  endedAt?: string;
  messageCount?: number;
  tokenCount?: number;
  summary?: string;
}

interface SessionRow {
  id: string;
  instance_id: string | null;
  name: string;
  working_dir: string;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  token_count: number;
  summary: string | null;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    instanceId: row.instance_id || undefined,
    name: row.name,
    workingDir: row.working_dir,
    startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
    messageCount: row.message_count,
    tokenCount: row.token_count,
    summary: row.summary || undefined,
  };
}

export const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // List all sessions
  fastify.get('/api/sessions', async (request) => {
    const db = getDb();
    const { instanceId } = request.query as { instanceId?: string };

    let query = `SELECT * FROM sessions`;
    const params: string[] = [];

    if (instanceId) {
      query += ` WHERE instance_id = ?`;
      params.push(instanceId);
    }

    query += ` ORDER BY started_at DESC`;

    const rows = db.prepare(query).all(...params) as SessionRow[];
    return rows.map(rowToSession);
  });

  // Get single session
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(request.params.id) as
      | SessionRow
      | undefined;

    if (!row) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return rowToSession(row);
  });

  // Create new session
  fastify.post<{ Body: CreateSessionBody }>('/api/sessions', async (request) => {
    const db = getDb();
    const { instanceId, name, workingDir } = request.body;

    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    db.prepare(
      `INSERT INTO sessions (id, instance_id, name, working_dir, started_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, instanceId || null, name, workingDir, startedAt);

    return {
      id,
      instanceId,
      name,
      workingDir,
      startedAt,
      messageCount: 0,
      tokenCount: 0,
    } as Session;
  });

  // Update session
  fastify.patch<{ Params: { id: string }; Body: UpdateSessionBody }>(
    '/api/sessions/:id',
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;
      const updates = request.body;

      // Check if session exists
      const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      // Build update query dynamically
      const setClauses: string[] = [];
      const values: unknown[] = [];

      if (updates.name !== undefined) {
        setClauses.push('name = ?');
        values.push(updates.name);
      }
      if (updates.endedAt !== undefined) {
        setClauses.push('ended_at = ?');
        values.push(updates.endedAt);
      }
      if (updates.messageCount !== undefined) {
        setClauses.push('message_count = ?');
        values.push(updates.messageCount);
      }
      if (updates.tokenCount !== undefined) {
        setClauses.push('token_count = ?');
        values.push(updates.tokenCount);
      }
      if (updates.summary !== undefined) {
        setClauses.push('summary = ?');
        values.push(updates.summary);
      }

      if (setClauses.length === 0) {
        return reply.status(400).send({ error: 'No updates provided' });
      }

      values.push(id);

      db.prepare(`UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

      // Return updated session
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow;
      return rowToSession(row);
    }
  );

  // Delete session
  fastify.delete<{ Params: { id: string } }>('/api/sessions/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    // Check if session exists
    const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
    if (!existing) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Delete messages first
    db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
    // Delete session
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);

    return { success: true };
  });

  // Get session messages
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id/messages', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    // Check if session exists
    const existing = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
    if (!existing) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    const messages = db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(id);

    return messages;
  });

  // === Session Persistence Endpoints ===

  // Get session statistics
  fastify.get('/api/session/stats', async () => {
    return getSessionStats();
  });

  // Export current session state
  fastify.get('/api/session/export', async () => {
    return exportSession();
  });

  // Save current session state (manual save)
  fastify.post('/api/session/save', async () => {
    saveSessionState();
    return { success: true, savedAt: new Date().toISOString() };
  });

  // Clear all instances (fresh start)
  fastify.delete('/api/session/clear', async () => {
    clearSession();
    return { success: true, clearedAt: new Date().toISOString() };
  });
};
