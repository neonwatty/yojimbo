import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/connection.js';
import { sshConnectionService } from '../services/ssh-connection.service.js';
import { reverseTunnelService } from '../services/reverse-tunnel.service.js';
import { hookInstallerService } from '../services/hook-installer.service.js';
import { broadcast } from '../websocket/server.js';
import type { RemoteMachine, MachineStatus } from '@cc-orchestrator/shared';

const router = Router();

// Database row type for remote_machines table
interface RemoteMachineRow {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  ssh_key_path: string | null;
  forward_credentials: number;
  status: MachineStatus;
  last_connected_at: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to convert DB row to RemoteMachine
function rowToMachine(row: RemoteMachineRow): RemoteMachine {
  return {
    id: row.id,
    name: row.name,
    hostname: row.hostname,
    port: row.port,
    username: row.username,
    sshKeyPath: row.ssh_key_path,
    forwardCredentials: Boolean(row.forward_credentials),
    status: row.status,
    lastConnectedAt: row.last_connected_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/machines - List all remote machines
router.get('/', (_req, res) => {
  try {
    const db = getDatabase();
    const rows = db
      .prepare('SELECT * FROM remote_machines ORDER BY name')
      .all() as RemoteMachineRow[];

    const machines = rows.map(rowToMachine);
    res.json({ success: true, data: machines });
  } catch (error) {
    console.error('Error listing machines:', error);
    res.status(500).json({ success: false, error: 'Failed to list machines' });
  }
});

// POST /api/machines - Add a new remote machine
router.post('/', (req, res) => {
  try {
    const { name, hostname, port = 22, username, sshKeyPath, forwardCredentials = false } = req.body;

    if (!name || !hostname || !username) {
      return res.status(400).json({
        success: false,
        error: 'Name, hostname, and username are required',
      });
    }

    const db = getDatabase();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO remote_machines (id, name, hostname, port, username, ssh_key_path, forward_credentials, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'unknown')
    `).run(id, name, hostname, port, username, sshKeyPath || null, forwardCredentials ? 1 : 0);

    const row = db.prepare('SELECT * FROM remote_machines WHERE id = ?').get(id) as RemoteMachineRow;
    const machine = rowToMachine(row);

    broadcast({ type: 'machine:created', machine });

    res.status(201).json({ success: true, data: machine });
  } catch (error) {
    console.error('Error creating machine:', error);
    res.status(500).json({ success: false, error: 'Failed to create machine' });
  }
});

// GET /api/machines/:id - Get a single remote machine
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const row = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(req.params.id) as RemoteMachineRow | undefined;

    if (!row) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    res.json({ success: true, data: rowToMachine(row) });
  } catch (error) {
    console.error('Error getting machine:', error);
    res.status(500).json({ success: false, error: 'Failed to get machine' });
  }
});

// PATCH /api/machines/:id - Update a remote machine
router.patch('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { name, hostname, port, username, sshKeyPath, forwardCredentials } = req.body;
    const { id } = req.params;

    // Check if machine exists
    const existing = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    // Build update query
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (hostname !== undefined) {
      updates.push('hostname = ?');
      values.push(hostname);
    }
    if (port !== undefined) {
      updates.push('port = ?');
      values.push(port);
    }
    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username);
    }
    if (sshKeyPath !== undefined) {
      updates.push('ssh_key_path = ?');
      values.push(sshKeyPath || null);
    }
    if (forwardCredentials !== undefined) {
      updates.push('forward_credentials = ?');
      values.push(forwardCredentials ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      // Reset status to unknown when connection details change
      if (hostname !== undefined || port !== undefined || username !== undefined || sshKeyPath !== undefined) {
        updates.push("status = 'unknown'");
      }
      values.push(id);

      db.prepare(`UPDATE remote_machines SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const row = db.prepare('SELECT * FROM remote_machines WHERE id = ?').get(id) as RemoteMachineRow;
    const machine = rowToMachine(row);

    broadcast({ type: 'machine:updated', machine });

    res.json({ success: true, data: machine });
  } catch (error) {
    console.error('Error updating machine:', error);
    res.status(500).json({ success: false, error: 'Failed to update machine' });
  }
});

// DELETE /api/machines/:id - Delete a remote machine
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Check if machine exists
    const existing = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    // Check if any active instances are using this machine
    const activeInstances = db
      .prepare('SELECT COUNT(*) as count FROM instances WHERE machine_id = ? AND closed_at IS NULL')
      .get(id) as { count: number };

    if (activeInstances.count > 0) {
      return res.status(409).json({
        success: false,
        error: 'Cannot delete machine with active instances',
      });
    }

    db.prepare('DELETE FROM remote_machines WHERE id = ?').run(id);

    broadcast({ type: 'machine:deleted', machineId: id });

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting machine:', error);
    res.status(500).json({ success: false, error: 'Failed to delete machine' });
  }
});

// POST /api/machines/:id/test - Test SSH connection to a machine
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const existing = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    const result = await sshConnectionService.testConnection(id);

    // Update status in database
    const status: MachineStatus = result.success ? 'online' : 'offline';
    db.prepare(`
      UPDATE remote_machines
      SET status = ?, updated_at = datetime('now')${result.success ? ", last_connected_at = datetime('now')" : ''}
      WHERE id = ?
    `).run(status, id);

    // Fetch updated machine
    const row = db.prepare('SELECT * FROM remote_machines WHERE id = ?').get(id) as RemoteMachineRow;
    const machine = rowToMachine(row);

    broadcast({ type: 'machine:updated', machine });

    res.json({
      success: result.success,
      data: {
        connected: result.success,
        error: result.error,
        machine,
      },
    });
  } catch (error) {
    console.error('Error testing machine connection:', error);
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

// POST /api/machines/:id/test-tunnel - Test if reverse tunnel is active for a machine
router.post('/:id/test-tunnel', async (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const existing = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    // Check if tunnel exists for this machine
    const hasTunnel = reverseTunnelService.hasMachineTunnel(id);

    if (hasTunnel) {
      res.json({
        success: true,
        data: {
          active: true,
          message: 'Reverse tunnel is active',
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          active: false,
          message: 'No active tunnel. Install hooks on an instance to create a tunnel.',
        },
      });
    }
  } catch (error) {
    console.error('Error testing tunnel:', error);
    res.status(500).json({ success: false, error: 'Failed to test tunnel' });
  }
});

// GET /api/machines/:id/claude-status - Check if Claude Code is installed on remote machine
router.get('/:id/claude-status', async (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const existing = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    try {
      // Check if claude is installed by running which claude && claude --version
      // Wrap in bash -c to ensure it works regardless of user's default shell (e.g., nushell)
      const result = await sshConnectionService.executeCommand(id, "bash -c 'which claude && claude --version'");
      const lines = result.stdout.trim().split('\n');
      const path = lines[0] || null;
      const version = lines[1]?.match(/v[\d.]+/)?.[0] || null;

      res.json({
        success: true,
        data: { installed: true, path, version },
      });
    } catch {
      // Claude not installed or command failed
      res.json({
        success: true,
        data: { installed: false, path: null, version: null },
      });
    }
  } catch (error) {
    console.error('Error checking Claude status on remote machine:', error);
    res.status(500).json({ success: false, error: 'Failed to check Claude status' });
  }
});

// GET /api/machines/:id/directories - List directories on remote machine
router.get('/:id/directories', async (req, res) => {
  try {
    const { id } = req.params;
    const { path = '~' } = req.query;

    const db = getDatabase();
    const existing = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    const result = await sshConnectionService.listDirectories(id, path as string);

    if (result.success) {
      res.json({
        success: true,
        data: {
          path: result.path,
          directories: result.directories,
        },
      });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error listing remote directories:', error);
    res.status(500).json({ success: false, error: 'Failed to list directories' });
  }
});

// POST /api/machines/:id/install-hooks - Install Claude Code hooks on remote machine
router.post('/:id/install-hooks', async (req, res) => {
  try {
    const { id } = req.params;
    const { orchestratorUrl } = req.body;

    if (!orchestratorUrl) {
      return res.status(400).json({
        success: false,
        error: 'orchestratorUrl is required',
      });
    }

    const db = getDatabase();
    const existing = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    const result = await hookInstallerService.installHooksForMachine(id, orchestratorUrl);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.message,
        details: result.error,
      });
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
    // Use synthetic instance ID for machine-level tunnel
    const syntheticInstanceId = `machine-${id}`;
    const tunnelResult = await reverseTunnelService.createTunnel(syntheticInstanceId, id, localPort);

    if (tunnelResult.success) {
      const tunnelStatus = tunnelResult.shared ? 'sharing existing' : 'new';
      console.log(`[Hooks] Installed hooks and ${tunnelStatus} reverse tunnel for machine ${id}`);
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
      console.warn(`[Hooks] Hooks installed but reverse tunnel failed for machine ${id}: ${tunnelResult.error}`);
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
    console.error('Error installing hooks on remote machine:', error);
    res.status(500).json({ success: false, error: 'Failed to install hooks' });
  }
});

// GET /api/machines/:id/hooks-status - Check if hooks are installed on remote machine
router.get('/:id/hooks-status', async (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const existing = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    const result = await hookInstallerService.checkExistingHooksForMachine(id);

    res.json({
      success: result.success,
      data: {
        installed: result.existingHooks.length > 0,
        hookTypes: result.existingHooks,
        error: result.error,
      },
    });
  } catch (error) {
    console.error('Error checking hooks status on remote machine:', error);
    res.status(500).json({ success: false, error: 'Failed to check hooks status' });
  }
});

// GET /api/machines/:id/tunnel-status - Check if reverse tunnel is active for machine
router.get('/:id/tunnel-status', (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const existing = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    const tunnel = reverseTunnelService.getMachineTunnel(id);

    if (tunnel) {
      res.json({
        success: true,
        data: {
          tunnelActive: true,
          remotePort: tunnel.remotePort,
          localPort: tunnel.localPort,
          instanceCount: tunnel.instanceIds.size,
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          tunnelActive: false,
        },
      });
    }
  } catch (error) {
    console.error('Error checking tunnel status:', error);
    res.status(500).json({ success: false, error: 'Failed to check tunnel status' });
  }
});

// POST /api/machines/:id/test-tunnel - Test tunnel connectivity by running curl on remote machine
router.post('/:id/test-tunnel', async (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const machine = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!machine) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    // Test tunnel by running curl on the remote machine
    const result = await sshConnectionService.testTunnelConnectivity(
      machine.hostname,
      machine.port,
      machine.username,
      machine.ssh_key_path || undefined,
      3456  // The port hooks use
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error testing tunnel:', error);
    res.status(500).json({ success: false, error: 'Failed to test tunnel' });
  }
});

// GET /api/machines/:id/debug-hooks - Get detailed diagnostic information about hooks
router.get('/:id/debug-hooks', async (req, res) => {
  try {
    const { id } = req.params;

    const db = getDatabase();
    const machine = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(id) as RemoteMachineRow | undefined;

    if (!machine) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }

    // Gather diagnostic info in parallel
    const diagnostics: {
      settingsJson?: string;
      settingsError?: string;
      jqInstalled?: boolean;
      jqVersion?: string;
      jqError?: string;
      curlInstalled?: boolean;
      curlVersion?: string;
      tunnelReachable?: boolean;
      tunnelError?: string;
      hookTestResult?: string;
      hookTestError?: string;
    } = {};

    // 1. Read settings.json content
    const settingsResult = await sshConnectionService.executeCommand(
      id,
      "bash -c 'cat ~/.claude/settings.json 2>&1 || echo \"FILE_NOT_FOUND\"'"
    );
    if (settingsResult.success) {
      diagnostics.settingsJson = settingsResult.stdout;
    } else {
      diagnostics.settingsError = settingsResult.stderr;
    }

    // 2. Check if jq is installed
    const jqResult = await sshConnectionService.executeCommand(
      id,
      "bash -c 'which jq && jq --version 2>&1 || echo \"JQ_NOT_FOUND\"'"
    );
    if (jqResult.stdout.includes('JQ_NOT_FOUND')) {
      diagnostics.jqInstalled = false;
      diagnostics.jqError = 'jq not found - hooks will not work without jq installed';
    } else {
      diagnostics.jqInstalled = true;
      const lines = jqResult.stdout.trim().split('\n');
      diagnostics.jqVersion = lines[1] || lines[0];
    }

    // 3. Check if curl is installed
    const curlResult = await sshConnectionService.executeCommand(
      id,
      "bash -c 'which curl && curl --version 2>&1 | head -1 || echo \"CURL_NOT_FOUND\"'"
    );
    diagnostics.curlInstalled = !curlResult.stdout.includes('CURL_NOT_FOUND');
    if (diagnostics.curlInstalled) {
      const lines = curlResult.stdout.trim().split('\n');
      diagnostics.curlVersion = lines[1] || lines[0];
    }

    // 4. Test if tunnel is reachable (duplicate of test-tunnel but included for convenience)
    const tunnelResult = await sshConnectionService.testTunnelConnectivity(
      machine.hostname,
      machine.port,
      machine.username,
      machine.ssh_key_path || undefined,
      3456
    );
    diagnostics.tunnelReachable = tunnelResult.tunnelWorking;
    if (!tunnelResult.tunnelWorking) {
      diagnostics.tunnelError = tunnelResult.error;
    }

    // 5. Simulate a hook call (without the actual hook, just the command pattern)
    // This tests if the full pipeline works: jq + curl
    if (diagnostics.jqInstalled && diagnostics.tunnelReachable) {
      const testPayload = JSON.stringify({ cwd: '/test/path' });
      const hookTestCmd = `bash -c 'echo '"'"'${testPayload}'"'"' | jq '"'"'{event:"test",projectDir:.cwd,machineId:"${id}"}'"'"' | curl -s -X POST "http://localhost:3456/api/hooks/status" -H "Content-Type: application/json" -d @- 2>&1'`;
      const hookTestResult = await sshConnectionService.executeCommand(id, hookTestCmd);
      if (hookTestResult.success) {
        diagnostics.hookTestResult = hookTestResult.stdout;
      } else {
        diagnostics.hookTestError = hookTestResult.stderr || hookTestResult.stdout;
      }
    }

    res.json({
      success: true,
      data: diagnostics,
    });
  } catch (error) {
    console.error('Error debugging hooks:', error);
    res.status(500).json({ success: false, error: 'Failed to debug hooks' });
  }
});

export default router;
