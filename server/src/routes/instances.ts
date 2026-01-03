import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/connection.js';
import { terminalManager } from '../services/terminal-manager.service.js';
import { sshConnectionService } from '../services/ssh-connection.service.js';
import { hookInstallerService } from '../services/hook-installer.service.js';
import { reverseTunnelService } from '../services/reverse-tunnel.service.js';
import { broadcast } from '../websocket/server.js';
import type { Instance, CreateInstanceRequest, UpdateInstanceRequest, InstanceStatus, MachineType } from '@cc-orchestrator/shared';

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
  machine_type: MachineType;
  machine_id: string | null;
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
    machineType: row.machine_type || 'local',
    machineId: row.machine_id,
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
router.post('/', async (req, res) => {
  try {
    const { name, workingDir, startupCommand, machineType = 'local', machineId } = req.body as CreateInstanceRequest;

    if (!name || !workingDir) {
      return res.status(400).json({ success: false, error: 'Name and workingDir are required' });
    }

    // Validate machine type
    if (machineType === 'remote') {
      if (!machineId) {
        return res.status(400).json({ success: false, error: 'machineId is required for remote instances' });
      }

      // Verify the machine exists and get its config
      const sshConfig = sshConnectionService.getMachineSSHConfig(machineId);
      if (!sshConfig) {
        return res.status(404).json({ success: false, error: 'Remote machine not found' });
      }
    }

    const db = getDatabase();
    const id = uuidv4();

    // Get max display order
    const maxOrder = db.prepare('SELECT MAX(display_order) as max FROM instances WHERE closed_at IS NULL').get() as { max: number | null } | undefined;
    const displayOrder = (maxOrder?.max || 0) + 1;

    // Spawn terminal backend (local PTY or SSH)
    try {
      await terminalManager.spawn(id, {
        type: machineType === 'remote' ? 'ssh' : 'local',
        machineId: machineId || undefined,
        workingDir,
      });
    } catch (err) {
      console.error(`Error spawning terminal for instance ${id}:`, err);
      return res.status(500).json({
        success: false,
        error: machineType === 'remote'
          ? `Failed to connect to remote machine: ${(err as Error).message}`
          : 'Failed to spawn terminal'
      });
    }

    // Get PID (only available for local instances)
    const pid = terminalManager.getPid(id);

    // Execute startup command if provided (after delay for shell to be ready)
    // For SSH backends, we need extra time for shell initialization, profile sourcing, and cd command
    // Note: For remote instances, we wait longer to allow the client to connect and send
    // the initial resize event, which ensures the PTY has the correct dimensions before
    // starting interactive TUI programs like Claude Code.
    if (startupCommand) {
      const delay = machineType === 'remote' ? 1500 : 100;
      setTimeout(() => {
        if (terminalManager.has(id)) {
          terminalManager.write(id, startupCommand + '\n');
        }
      }, delay);
    }

    // Insert into database
    db.prepare(`
      INSERT INTO instances (id, name, working_dir, status, display_order, pid, machine_type, machine_id)
      VALUES (?, ?, ?, 'idle', ?, ?, ?, ?)
    `).run(id, name, workingDir, displayOrder, pid, machineType, machineId || null);

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
router.delete('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Close reverse tunnel if it exists (for remote instances)
    await reverseTunnelService.closeTunnel(id);

    // Kill terminal backend if running
    await terminalManager.kill(id);

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

    if (!terminalManager.has(id)) {
      return res.status(404).json({ success: false, error: 'Instance terminal not found' });
    }

    terminalManager.write(id, data);
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

// POST /api/instances/:id/install-hooks - Install Claude Code hooks on remote machine
router.post('/:id/install-hooks', async (req, res) => {
  try {
    const { id } = req.params;
    const { orchestratorUrl } = req.body;

    if (!orchestratorUrl) {
      return res.status(400).json({
        success: false,
        error: 'orchestratorUrl is required (the URL the remote machine can use to reach this server)',
      });
    }

    // Get instance to find machine_id for reverse tunnel
    const db = getDatabase();
    const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(id) as InstanceRow | undefined;

    if (!instance) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    if (!instance.machine_id) {
      return res.status(400).json({ success: false, error: 'Hooks are only supported for remote instances' });
    }

    // Install hooks on the remote machine
    const result = await hookInstallerService.installHooksForInstance(id, orchestratorUrl);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message, details: result.error });
    }

    // Set up reverse tunnel so hooks can reach the local server
    // Parse port from orchestratorUrl (default to 3456)
    let localPort = 3456;
    try {
      const url = new URL(orchestratorUrl);
      if (url.port) {
        localPort = parseInt(url.port, 10);
      } else if (url.protocol === 'https:') {
        localPort = 443;
      } else if (url.protocol === 'http:') {
        localPort = 80;
      }
    } catch {
      // Keep default port if URL parsing fails
    }

    // Create reverse tunnel: remote:localPort → local:localPort
    const tunnelResult = await reverseTunnelService.createTunnel(id, instance.machine_id, localPort);

    if (tunnelResult.success) {
      console.log(`[Hooks] Installed hooks and set up reverse tunnel for instance ${id}`);
      res.json({
        success: true,
        data: {
          message: result.message,
          tunnelActive: true,
          tunnelPort: localPort,
        },
      });
    } else {
      // Hooks installed but tunnel failed - warn but don't fail completely
      console.warn(`[Hooks] Hooks installed but reverse tunnel failed: ${tunnelResult.error}`);
      res.json({
        success: true,
        data: {
          message: result.message,
          tunnelActive: false,
          tunnelError: tunnelResult.error,
          warning: 'Hooks installed but reverse tunnel could not be established. Remote hooks may not work.',
        },
      });
    }
  } catch (error) {
    console.error('Error installing hooks:', error);
    res.status(500).json({ success: false, error: 'Failed to install hooks' });
  }
});

// POST /api/instances/:id/uninstall-hooks - Uninstall Claude Code hooks from remote machine
router.post('/:id/uninstall-hooks', async (req, res) => {
  try {
    const { id } = req.params;

    // Close reverse tunnel if it exists
    const tunnelClosed = await reverseTunnelService.closeTunnel(id);
    if (tunnelClosed) {
      console.log(`[Hooks] Closed reverse tunnel for instance ${id}`);
    }

    const result = await hookInstallerService.uninstallHooksForInstance(id);

    if (result.success) {
      res.json({ success: true, data: { message: result.message, tunnelClosed } });
    } else {
      res.status(400).json({ success: false, error: result.message, details: result.error });
    }
  } catch (error) {
    console.error('Error uninstalling hooks:', error);
    res.status(500).json({ success: false, error: 'Failed to uninstall hooks' });
  }
});

// POST /api/instances/:id/reset-status - Manually reset instance status to idle
router.post('/:id/reset-status', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ? AND closed_at IS NULL').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Reset status to idle
    db.prepare(`
      UPDATE instances
      SET status = 'idle', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    // Broadcast status change
    broadcast({
      type: 'status:changed',
      instanceId: id,
      status: 'idle',
    });

    console.log(`🔄 Instance ${id} status manually reset to idle`);

    res.json({ success: true, data: { status: 'idle' } });
  } catch (error) {
    console.error('Error resetting instance status:', error);
    res.status(500).json({ success: false, error: 'Failed to reset status' });
  }
});

// GET /api/instances/:id/hooks-config - Get hooks configuration for preview (remote instances only)
router.get('/:id/hooks-config', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { orchestratorUrl } = req.query;

    if (!orchestratorUrl || typeof orchestratorUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'orchestratorUrl query parameter is required',
      });
    }

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ? AND closed_at IS NULL').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Generate hooks config for preview
    const hooksConfig = hookInstallerService.getHooksConfigForPreview(id, orchestratorUrl);

    res.json({
      success: true,
      data: {
        config: hooksConfig,
        configJson: JSON.stringify(hooksConfig, null, 2),
        instructions: [
          'Add the following to your ~/.claude/settings.json on the remote machine:',
          'If you already have a settings.json, merge the "hooks" section with your existing hooks.',
          'These hooks allow the orchestrator to track Claude Code status on this instance.',
        ],
      },
    });
  } catch (error) {
    console.error('Error getting hooks config:', error);
    res.status(500).json({ success: false, error: 'Failed to get hooks config' });
  }
});

export default router;
