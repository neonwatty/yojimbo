import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../db/index.js';
import type { StatusEvent, InstanceStatus } from '@cc-orchestrator/shared';

interface CreateStatusEventBody {
  instanceId: string;
  status: InstanceStatus;
  message?: string;
}

interface StatusEventRow {
  id: number;
  instance_id: string;
  status: InstanceStatus;
  message: string | null;
  timestamp: string;
}

function rowToStatusEvent(row: StatusEventRow): StatusEvent {
  return {
    id: row.id,
    instanceId: row.instance_id,
    status: row.status,
    message: row.message || undefined,
    timestamp: row.timestamp,
  };
}

export const statusEventRoutes: FastifyPluginAsync = async (fastify) => {
  // List status events (with optional filtering)
  fastify.get('/api/status-events', async (request) => {
    const db = getDb();
    const { instanceId, limit = '100' } = request.query as {
      instanceId?: string;
      limit?: string;
    };

    let query = `SELECT * FROM status_events`;
    const params: (string | number)[] = [];

    if (instanceId) {
      query += ` WHERE instance_id = ?`;
      params.push(instanceId);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const rows = db.prepare(query).all(...params) as StatusEventRow[];
    return rows.map(rowToStatusEvent);
  });

  // Get status events for a specific instance
  fastify.get<{ Params: { instanceId: string } }>(
    '/api/instances/:instanceId/status-events',
    async (request) => {
      const db = getDb();
      const { instanceId } = request.params;
      const { limit = '50' } = request.query as { limit?: string };

      const rows = db
        .prepare(
          `SELECT * FROM status_events
           WHERE instance_id = ?
           ORDER BY timestamp DESC
           LIMIT ?`
        )
        .all(instanceId, parseInt(limit, 10)) as StatusEventRow[];

      return rows.map(rowToStatusEvent);
    }
  );

  // Create status event (usually called internally when status changes)
  fastify.post<{ Body: CreateStatusEventBody }>('/api/status-events', async (request, reply) => {
    const db = getDb();
    const { instanceId, status, message } = request.body;

    // Verify instance exists
    const instance = db.prepare('SELECT id FROM instances WHERE id = ?').get(instanceId);
    if (!instance) {
      return reply.status(404).send({ error: 'Instance not found' });
    }

    // Insert status event
    const result = db
      .prepare(
        `INSERT INTO status_events (instance_id, status, message, timestamp)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .run(instanceId, status, message || null);

    // Update instance status
    db.prepare(
      `UPDATE instances
       SET status = ?, last_activity_at = datetime('now')
       WHERE id = ?`
    ).run(status, instanceId);

    // Get the created event
    const row = db
      .prepare('SELECT * FROM status_events WHERE id = ?')
      .get(result.lastInsertRowid) as StatusEventRow;

    return rowToStatusEvent(row);
  });

  // Get latest status for each instance
  fastify.get('/api/status-events/latest', async () => {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT se.* FROM status_events se
         INNER JOIN (
           SELECT instance_id, MAX(timestamp) as max_timestamp
           FROM status_events
           GROUP BY instance_id
         ) latest ON se.instance_id = latest.instance_id
                  AND se.timestamp = latest.max_timestamp`
      )
      .all() as StatusEventRow[];

    return rows.map(rowToStatusEvent);
  });
};
