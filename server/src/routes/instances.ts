import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/connection.js';
import { ptyService } from '../services/pty.service.js';
import { broadcast } from '../websocket/server.js';
import type { Instance, CreateInstanceRequest, UpdateInstanceRequest, InstanceStatus } from '@cc-orchestrator/shared';

const router = Router();

// Database row type for instances table
interface InstanceRow {
  id: string;
  name: string;
  working_dir: string;
  status: InstanceStatus;
  is_pinned: number;
  display_order: number;
  pid: number | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  last_cwd: string | null;
}

// Helper to convert DB row to Instance
function rowToInstance(row: InstanceRow): Instance {
  return {
    id: row.id,
    name: row.name,
    workingDir: row.working_dir,
    status: row.status,
    isPinned: Boolean(row.is_pinned),
    displayOrder: row.display_order,
    pid: row.pid,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

// GET /api/instances - List all instances
router.get('/', (_req, res) => {
  try {
    const db = getDatabase();
    const rows = db
      .prepare('SELECT * FROM instances WHERE closed_at IS NULL ORDER BY display_order, created_at DESC')
      .all() as InstanceRow[];

    const instances = rows.map(rowToInstance);
    res.json({ success: true, data: instances });
  } catch (error) {
    console.error('Error listing instances:', error);
    res.status(500).json({ success: false, error: 'Failed to list instances' });
  }
});

// POST /api/instances - Create new instance
router.post('/', (req, res) => {
  try {
    const { name, workingDir } = req.body as CreateInstanceRequest;

    if (!name || !workingDir) {
      return res.status(400).json({ success: false, error: 'Name and workingDir are required' });
    }

    const db = getDatabase();
    const id = uuidv4();

    // Get max display order
    const maxOrder = db.prepare('SELECT MAX(display_order) as max FROM instances WHERE closed_at IS NULL').get() as { max: number | null } | undefined;
    const displayOrder = (maxOrder?.max || 0) + 1;

    // Spawn PTY
    const ptyInstance = ptyService.spawn(id, workingDir);
    const pid = ptyInstance.pty.pid;

    // Insert into database
    db.prepare(`
      INSERT INTO instances (id, name, working_dir, status, display_order, pid)
      VALUES (?, ?, ?, 'idle', ?, ?)
    `).run(id, name, workingDir, displayOrder, pid);

    const row = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as InstanceRow;
    const instance = rowToInstance(row);

    // Broadcast creation
    broadcast({ type: 'instance:created', instance });

    res.status(201).json({ success: true, data: instance });
  } catch (error) {
    console.error('Error creating instance:', error);
    res.status(500).json({ success: false, error: 'Failed to create instance' });
  }
});

// GET /api/instances/:id - Get single instance
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id) as InstanceRow | undefined;

    if (!row) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    res.json({ success: true, data: rowToInstance(row) });
  } catch (error) {
    console.error('Error getting instance:', error);
    res.status(500).json({ success: false, error: 'Failed to get instance' });
  }
});

// PATCH /api/instances/:id - Update instance
router.patch('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, isPinned, displayOrder } = req.body as UpdateInstanceRequest;
    const { id } = req.params;

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Build update query
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (isPinned !== undefined) {
      updates.push('is_pinned = ?');
      values.push(isPinned ? 1 : 0);
    }
    if (displayOrder !== undefined) {
      updates.push('display_order = ?');
      values.push(displayOrder);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);

      db.prepare(`UPDATE instances SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const row = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as InstanceRow;
    const instance = rowToInstance(row);

    // Broadcast update
    broadcast({ type: 'instance:updated', instance });

    res.json({ success: true, data: instance });
  } catch (error) {
    console.error('Error updating instance:', error);
    res.status(500).json({ success: false, error: 'Failed to update instance' });
  }
});

// DELETE /api/instances/:id - Close instance
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Kill PTY if running
    ptyService.kill(id);

    // Mark as closed in database
    db.prepare(`
      UPDATE instances
      SET closed_at = datetime('now'), updated_at = datetime('now'), pid = NULL
      WHERE id = ?
    `).run(id);

    // Broadcast closure
    broadcast({ type: 'instance:closed', instanceId: id });

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error closing instance:', error);
    res.status(500).json({ success: false, error: 'Failed to close instance' });
  }
});

// POST /api/instances/:id/input - Send input to terminal
router.post('/:id/input', (req, res) => {
  try {
    const { id } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ success: false, error: 'Data is required' });
    }

    if (!ptyService.has(id)) {
      return res.status(404).json({ success: false, error: 'Instance PTY not found' });
    }

    ptyService.write(id, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending input:', error);
    res.status(500).json({ success: false, error: 'Failed to send input' });
  }
});

// POST /api/instances/reorder - Bulk update display order
router.post('/reorder', (req, res) => {
  try {
    const { instanceIds } = req.body as { instanceIds: string[] };

    if (!instanceIds || !Array.isArray(instanceIds)) {
      return res.status(400).json({ success: false, error: 'instanceIds array is required' });
    }

    const db = getDatabase();
    const updateStmt = db.prepare('UPDATE instances SET display_order = ? WHERE id = ?');

    const transaction = db.transaction(() => {
      instanceIds.forEach((id, index) => {
        updateStmt.run(index, id);
      });
    });

    transaction();

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering instances:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder instances' });
  }
});

export default router;
