import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { getDb } from '../db/index.js';
import { getTerminalManager } from '../services/terminal-manager.js';
import type { Instance, InstanceStatus } from '@cc-orchestrator/shared';

interface CreateInstanceBody {
  name: string;
  workingDir: string;
}

interface UpdateInstanceBody {
  name?: string;
  pinned?: boolean;
  status?: InstanceStatus;
}

export const instanceRoutes: FastifyPluginAsync = async (fastify) => {
  // List all instances
  fastify.get('/api/instances', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, name, working_dir, status, pinned, created_at, last_activity_at
         FROM instances ORDER BY pinned DESC, created_at DESC`
      )
      .all() as Array<{
      id: string;
      name: string;
      working_dir: string;
      status: InstanceStatus;
      pinned: number;
      created_at: string;
      last_activity_at: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      workingDir: row.working_dir,
      status: row.status,
      pinned: Boolean(row.pinned),
      createdAt: row.created_at,
      updatedAt: row.last_activity_at || row.created_at,
    }));
  });

  // Get single instance
  fastify.get<{ Params: { id: string } }>('/api/instances/:id', async (request, reply) => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT id, name, working_dir, status, pinned, created_at, last_activity_at
         FROM instances WHERE id = ?`
      )
      .get(request.params.id) as
      | {
          id: string;
          name: string;
          working_dir: string;
          status: InstanceStatus;
          pinned: number;
          created_at: string;
          last_activity_at: string | null;
        }
      | undefined;

    if (!row) {
      return reply.status(404).send({ error: 'Instance not found' });
    }

    return {
      id: row.id,
      name: row.name,
      workingDir: row.working_dir,
      status: row.status,
      pinned: Boolean(row.pinned),
      createdAt: row.created_at,
      updatedAt: row.last_activity_at || row.created_at,
    };
  });

  // Create new instance
  fastify.post<{ Body: CreateInstanceBody }>('/api/instances', async (request) => {
    const db = getDb();
    const terminalManager = getTerminalManager();

    const id = randomUUID();
    const { name, workingDir } = request.body;

    // Insert into database
    db.prepare(
      `INSERT INTO instances (id, name, working_dir, status, created_at)
       VALUES (?, ?, ?, 'idle', datetime('now'))`
    ).run(id, name, workingDir);

    // Spawn terminal
    terminalManager.spawn({ id, workingDir });

    const instance: Instance = {
      id,
      name,
      workingDir,
      status: 'idle',
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return instance;
  });

  // Update instance
  fastify.patch<{ Params: { id: string }; Body: UpdateInstanceBody }>(
    '/api/instances/:id',
    async (request, reply) => {
      const db = getDb();
      const { id } = request.params;
      const updates = request.body;

      // Check if instance exists
      const existing = db.prepare('SELECT id FROM instances WHERE id = ?').get(id);
      if (!existing) {
        return reply.status(404).send({ error: 'Instance not found' });
      }

      // Build update query dynamically
      const setClauses: string[] = ['last_activity_at = datetime(\'now\')'];
      const values: unknown[] = [];

      if (updates.name !== undefined) {
        setClauses.push('name = ?');
        values.push(updates.name);
      }
      if (updates.pinned !== undefined) {
        setClauses.push('pinned = ?');
        values.push(updates.pinned ? 1 : 0);
      }
      if (updates.status !== undefined) {
        setClauses.push('status = ?');
        values.push(updates.status);
      }

      values.push(id);

      db.prepare(`UPDATE instances SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);

      // Return updated instance
      return fastify.inject({
        method: 'GET',
        url: `/api/instances/${id}`,
      }).then((res) => JSON.parse(res.body));
    }
  );

  // Delete instance
  fastify.delete<{ Params: { id: string } }>('/api/instances/:id', async (request, reply) => {
    const db = getDb();
    const terminalManager = getTerminalManager();
    const { id } = request.params;

    // Check if instance exists
    const existing = db.prepare('SELECT id FROM instances WHERE id = ?').get(id);
    if (!existing) {
      return reply.status(404).send({ error: 'Instance not found' });
    }

    // Kill terminal if running
    terminalManager.kill(id);

    // Delete from database (cascade deletes related records)
    db.prepare('DELETE FROM status_events WHERE instance_id = ?').run(id);
    db.prepare('DELETE FROM instances WHERE id = ?').run(id);

    return { success: true };
  });
};
