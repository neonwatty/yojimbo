import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/connection.js';
import { terminalManager } from '../services/terminal-manager.service.js';
import { sshConnectionService } from '../services/ssh-connection.service.js';
import { hookInstallerService } from '../services/hook-installer.service.js';
import { reverseTunnelService } from '../services/reverse-tunnel.service.js';
import { portDetectionService } from '../services/port-detection.service.js';
import { htmlFilesService } from '../services/html-files.service.js';
import { keychainStorageService } from '../services/keychain-storage.service.js';
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
      let keychainUnlockDelay = 0;

      // Auto-unlock keychain for remote Claude Code instances
      if (machineType === 'remote' && machineId && startupCommand.includes('claude')) {
        const hasPassword = await keychainStorageService.hasPassword(machineId);
        if (hasPassword) {
          const passwordResult = await keychainStorageService.getPassword(machineId);
          if (passwordResult.success && passwordResult.password) {
            // Unlock keychain first (after initial shell setup delay)
            setTimeout(() => {
              if (terminalManager.has(id)) {
                terminalManager.write(id, 'security unlock-keychain ~/Library/Keychains/login.keychain-db\n');
                setTimeout(() => {
                  if (terminalManager.has(id)) {
                    terminalManager.write(id, passwordResult.password + '\n');
                  }
                }, 500);
              }
            }, 1000);
            keychainUnlockDelay = 2500; // Wait for unlock before starting Claude
            console.log(`🔐 Auto-unlocking keychain for remote Claude Code instance ${id}`);
          }
        }
      }

      const baseDelay = machineType === 'remote' ? 1500 : 100;
      setTimeout(() => {
        if (terminalManager.has(id)) {
          terminalManager.write(id, startupCommand + '\n');
        }
      }, baseDelay + keychainUnlockDelay);
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

    // Clear port detection cache
    portDetectionService.clearInstance(id);

    // Clear HTML files cache
    htmlFilesService.clearInstance(id);

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

// GET /api/instances/:id/check-hooks - Check which hooks already exist on remote machine
router.get('/:id/check-hooks', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await hookInstallerService.checkExistingHooksForInstance(id);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({
      success: true,
      data: { existingHooks: result.existingHooks },
    });
  } catch (error) {
    console.error('Error checking existing hooks:', error);
    res.status(500).json({ success: false, error: 'Failed to check existing hooks' });
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
    // If a tunnel already exists for this machine, the instance will share it
    const tunnelResult = await reverseTunnelService.createTunnel(id, instance.machine_id, localPort);

    if (tunnelResult.success) {
      const tunnelStatus = tunnelResult.shared ? 'sharing existing' : 'new';
      console.log(`[Hooks] Installed hooks and ${tunnelStatus} reverse tunnel for instance ${id}`);
      res.json({
        success: true,
        data: {
          message: result.message,
          tunnelActive: true,
          tunnelPort: localPort,
          tunnelShared: tunnelResult.shared || false,
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

    // Get the machine ID before closing the tunnel (so we can check if other instances remain)
    const machineId = reverseTunnelService.getMachineIdForInstance(id);

    // Remove this instance from the tunnel (may or may not close the tunnel)
    const instanceRemoved = await reverseTunnelService.closeTunnel(id);

    // Check if the tunnel is still active for this machine (other instances using it)
    const tunnelStillActive = machineId ? reverseTunnelService.hasMachineTunnel(machineId) : false;

    // Only uninstall hooks from the remote if this was the last instance (tunnel closed)
    let hooksUninstalled = false;
    if (instanceRemoved && !tunnelStillActive) {
      console.log(`[Hooks] Last instance removed, uninstalling hooks for instance ${id}`);
      const result = await hookInstallerService.uninstallHooksForInstance(id);
      hooksUninstalled = result.success;
      if (!result.success) {
        console.warn(`[Hooks] Failed to uninstall hooks: ${result.error}`);
      }
    } else if (instanceRemoved) {
      console.log(`[Hooks] Instance ${id} removed from tunnel, but other instances still using it`);
    }

    res.json({
      success: true,
      data: {
        message: hooksUninstalled
          ? 'Hooks uninstalled successfully'
          : tunnelStillActive
            ? 'Instance removed from shared tunnel (hooks still active for other instances)'
            : 'Instance was not using a tunnel',
        instanceRemoved,
        tunnelStillActive,
        hooksUninstalled,
      },
    });
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

// GET /api/instances/:id/listening-ports - Get listening ports for an instance
router.get('/:id/listening-ports', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { refresh } = req.query;

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ? AND closed_at IS NULL').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Only support local instances for now
    if (existing.machine_type !== 'local') {
      return res.status(400).json({
        success: false,
        error: 'Port detection is only available for local instances',
      });
    }

    // Get ports (optionally force refresh)
    let instancePorts;
    if (refresh === 'true') {
      instancePorts = await portDetectionService.refreshInstance(id);
    } else {
      instancePorts = portDetectionService.getInstancePorts(id);
    }

    res.json({
      success: true,
      data: instancePorts,
    });
  } catch (error) {
    console.error('Error getting listening ports:', error);
    res.status(500).json({ success: false, error: 'Failed to get listening ports' });
  }
});

// GET /api/instances/:id/html-files - List HTML files for an instance
router.get('/:id/html-files', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ? AND closed_at IS NULL').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Only support local instances
    if (existing.machine_type !== 'local') {
      return res.status(400).json({
        success: false,
        error: 'HTML files viewer is only available for local instances',
      });
    }

    const htmlFiles = htmlFilesService.getFiles(id);
    res.json({ success: true, data: htmlFiles });
  } catch (error) {
    console.error('Error getting HTML files:', error);
    res.status(500).json({ success: false, error: 'Failed to get HTML files' });
  }
});

// POST /api/instances/:id/html-files - Add an HTML file to an instance
router.post('/:id/html-files', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ success: false, error: 'Path is required' });
    }

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ? AND closed_at IS NULL').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Only support local instances
    if (existing.machine_type !== 'local') {
      return res.status(400).json({
        success: false,
        error: 'HTML files viewer is only available for local instances',
      });
    }

    const htmlFile = await htmlFilesService.addFile(id, path);
    res.status(201).json({ success: true, data: htmlFile });
  } catch (error) {
    console.error('Error adding HTML file:', error);
    const message = error instanceof Error ? error.message : 'Failed to add HTML file';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/instances/:id/html-files/upload - Upload an HTML file with content
router.post('/:id/html-files/upload', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { fileName, content } = req.body;

    if (!fileName || !content) {
      return res.status(400).json({ success: false, error: 'fileName and content are required' });
    }

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ? AND closed_at IS NULL').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Only support local instances
    if (existing.machine_type !== 'local') {
      return res.status(400).json({
        success: false,
        error: 'HTML files viewer is only available for local instances',
      });
    }

    const htmlFile = htmlFilesService.addFileWithContent(id, fileName, content);
    res.status(201).json({ success: true, data: htmlFile });
  } catch (error) {
    console.error('Error uploading HTML file:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload HTML file';
    res.status(400).json({ success: false, error: message });
  }
});

// DELETE /api/instances/:id/html-files/:fileId - Remove an HTML file from an instance
router.delete('/:id/html-files/:fileId', (req, res) => {
  try {
    const db = getDatabase();
    const { id, fileId } = req.params;

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ? AND closed_at IS NULL').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    const removed = htmlFilesService.removeFile(id, fileId);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing HTML file:', error);
    res.status(500).json({ success: false, error: 'Failed to remove HTML file' });
  }
});

// GET /api/instances/:id/html-files/:fileId/content - Get HTML file content
router.get('/:id/html-files/:fileId/content', async (req, res) => {
  try {
    const db = getDatabase();
    const { id, fileId } = req.params;

    // Check if instance exists
    const existing = db.prepare('SELECT * FROM instances WHERE id = ? AND closed_at IS NULL').get(id) as InstanceRow | undefined;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    // Get the file entry
    const file = htmlFilesService.getFile(id, fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Check if it's an uploaded file (content stored in memory)
    if (file.path.startsWith('uploaded://')) {
      const content = htmlFilesService.getUploadedContent(fileId);
      if (!content) {
        return res.status(404).json({ success: false, error: 'File content not found' });
      }
      return res.json({ success: true, data: { content } });
    }

    // Read content from disk
    const content = await htmlFilesService.getFileContent(file.path);
    res.json({ success: true, data: { content } });
  } catch (error) {
    console.error('Error getting HTML file content:', error);
    const message = error instanceof Error ? error.message : 'Failed to get file content';
    res.status(400).json({ success: false, error: message });
  }
});

export default router;
