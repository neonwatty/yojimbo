import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDatabase } from '../db/connection.js';
import type { SSHConfig } from './terminal-backend.js';
import type { MachineStatus, SSHKey, InstanceStatus } from '@cc-orchestrator/shared';

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

interface SSHKeyResult {
  privateKey?: Buffer;
  error?: string;
}

/**
 * Load SSH private key from path or default locations
 */
function loadSSHPrivateKey(privateKeyPath?: string): SSHKeyResult {
  // If a specific path is provided, try to read it
  if (privateKeyPath) {
    const keyPath = privateKeyPath.replace(/^~/, os.homedir());
    try {
      const privateKey = fs.readFileSync(keyPath);
      return { privateKey };
    } catch {
      return { error: `Failed to read SSH key: ${keyPath}` };
    }
  }

  // Try default keys in order of preference
  const defaultKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa'];
  for (const keyName of defaultKeys) {
    const keyPath = path.join(os.homedir(), '.ssh', keyName);
    if (fs.existsSync(keyPath)) {
      try {
        const privateKey = fs.readFileSync(keyPath);
        return { privateKey };
      } catch {
        // Continue to next key
      }
    }
  }

  return { error: 'No SSH private key found' };
}

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

/**
 * SSH Connection Service
 * Manages SSH connection testing, key discovery, and machine status
 */
class SSHConnectionService {
  /**
   * Test SSH connection to a machine
   */
  async testConnection(machineId: string): Promise<{ success: boolean; error?: string }> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM remote_machines WHERE id = ?').get(machineId) as RemoteMachineRow | undefined;

    if (!row) {
      return { success: false, error: 'Machine not found' };
    }

    const sshConfig: SSHConfig = {
      host: row.hostname,
      port: row.port,
      username: row.username,
      privateKeyPath: row.ssh_key_path || undefined,
    };

    return this.testConnectionWithConfig(sshConfig);
  }

  /**
   * Test SSH connection with given config
   */
  async testConnectionWithConfig(config: SSHConfig): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, error: 'Connection timeout' });
      }, 10000);

      // Load SSH private key
      const keyResult = loadSSHPrivateKey(config.privateKeyPath);
      if (keyResult.error) {
        clearTimeout(timeout);
        resolve({ success: false, error: keyResult.error });
        return;
      }
      const privateKey = keyResult.privateKey;

      client.on('ready', () => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: true });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: false, error: err.message });
      });

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 10000,
      });
    });
  }

  /**
   * Check and update machine status
   */
  async checkMachineStatus(machineId: string): Promise<MachineStatus> {
    const result = await this.testConnection(machineId);
    const status: MachineStatus = result.success ? 'online' : 'offline';

    // Update status in database
    const db = getDatabase();
    db.prepare(`
      UPDATE remote_machines
      SET status = ?, updated_at = datetime('now')
      ${result.success ? ", last_connected_at = datetime('now')" : ''}
      WHERE id = ?
    `).run(status, machineId);

    return status;
  }

  /**
   * List available SSH keys in ~/.ssh/
   */
  listSSHKeys(): SSHKey[] {
    const sshDir = path.join(os.homedir(), '.ssh');
    const keys: SSHKey[] = [];

    if (!fs.existsSync(sshDir)) {
      return keys;
    }

    try {
      const files = fs.readdirSync(sshDir);

      // Find private keys (files without .pub extension that have corresponding .pub files)
      for (const file of files) {
        // Skip .pub files, known_hosts, config, etc.
        if (file.endsWith('.pub') || file === 'known_hosts' || file === 'config' || file === 'authorized_keys') {
          continue;
        }

        const filePath = path.join(sshDir, file);
        const stat = fs.statSync(filePath);

        // Skip directories
        if (stat.isDirectory()) {
          continue;
        }

        // Check if it looks like a private key (has corresponding .pub or starts with -----)
        const pubKeyPath = `${filePath}.pub`;
        const hasPublicKey = fs.existsSync(pubKeyPath);

        // Read first line to check if it's a key
        try {
          const content = fs.readFileSync(filePath, 'utf-8').slice(0, 100);
          if (content.includes('-----BEGIN') || content.includes('PRIVATE KEY')) {
            keys.push({
              name: file,
              path: filePath,
              hasPublicKey,
            });
          }
        } catch {
          // Skip files we can't read
        }
      }
    } catch (err) {
      console.error('Error listing SSH keys:', err);
    }

    return keys;
  }

  /**
   * Get SSH config for a machine
   */
  getMachineSSHConfig(machineId: string): SSHConfig | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM remote_machines WHERE id = ?').get(machineId) as RemoteMachineRow | undefined;

    if (!row) {
      return null;
    }

    return {
      host: row.hostname,
      port: row.port,
      username: row.username,
      privateKeyPath: row.ssh_key_path || undefined,
      forwardCredentials: Boolean(row.forward_credentials),
    };
  }

  /**
   * List directories on a remote machine
   */
  async listDirectories(
    machineId: string,
    remotePath: string
  ): Promise<{ success: boolean; path?: string; directories?: string[]; error?: string }> {
    const config = this.getMachineSSHConfig(machineId);
    if (!config) {
      return { success: false, error: 'Machine not found' };
    }

    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, error: 'Connection timeout' });
      }, 15000);

      // Load SSH private key
      const keyResult = loadSSHPrivateKey(config.privateKeyPath);
      if (keyResult.error) {
        clearTimeout(timeout);
        resolve({ success: false, error: keyResult.error });
        return;
      }
      const privateKey = keyResult.privateKey;

      client.on('ready', () => {
        // Expand ~ and get directories
        // Use a command that:
        // 1. Expands ~ to home directory
        // 2. Lists only directories
        // 3. Outputs the resolved path first, then directories
        // Wrap in bash -c to ensure bash syntax works regardless of user's default shell (e.g., nushell)
        const bashCmd = `cd ${remotePath} 2>/dev/null && pwd && ls -1d */ 2>/dev/null | sed 's|/$||' || echo ""`;
        const cmd = `bash -c '${bashCmd.replace(/'/g, "'\"'\"'")}'`;

        client.exec(cmd, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            client.end();
            resolve({ success: false, error: err.message });
            return;
          }

          let stdout = '';
          let stderr = '';

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });

          stream.on('close', (code: number) => {
            clearTimeout(timeout);
            client.end();

            if (code !== 0 && stderr) {
              resolve({ success: false, error: stderr.trim() || 'Failed to list directories' });
              return;
            }

            const lines = stdout.trim().split('\n').filter(Boolean);
            if (lines.length === 0) {
              resolve({ success: false, error: 'Directory not found or empty' });
              return;
            }

            const resolvedPath = lines[0];
            const directories = lines.slice(1).sort();

            resolve({
              success: true,
              path: resolvedPath,
              directories,
            });
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: false, error: err.message });
      });

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 10000,
      });
    });
  }

  /**
   * Execute a command on a remote machine
   */
  async executeCommand(machineId: string, command: string, timeoutMs = 10000): Promise<CommandResult> {
    const config = this.getMachineSSHConfig(machineId);
    if (!config) {
      return { success: false, stdout: '', stderr: 'Machine not found', code: -1 };
    }

    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, stdout: '', stderr: 'Connection timeout', code: -1 });
      }, timeoutMs);

      // Load SSH private key
      const keyResult = loadSSHPrivateKey(config.privateKeyPath);
      if (keyResult.error) {
        clearTimeout(timeout);
        resolve({ success: false, stdout: '', stderr: keyResult.error, code: -1 });
        return;
      }
      const privateKey = keyResult.privateKey;

      client.on('ready', () => {
        client.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            client.end();
            resolve({ success: false, stdout: '', stderr: err.message, code: -1 });
            return;
          }

          let stdout = '';
          let stderr = '';

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });

          stream.on('close', (code: number) => {
            clearTimeout(timeout);
            client.end();
            resolve({
              success: code === 0,
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              code,
            });
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: false, stdout: '', stderr: err.message, code: -1 });
      });

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 10000,
      });
    });
  }

  /**
   * Check Claude Code status on a remote machine by examining session files
   * Returns 'working' if recent activity (within 30s), 'idle' otherwise
   */
  async checkRemoteClaudeStatus(
    machineId: string,
    workingDir: string
  ): Promise<{ status: InstanceStatus; error?: string; ageSeconds?: number }> {
    // Encode the working directory path like Claude does (replace / with -)
    // Note: Claude keeps the leading dash (e.g., -Users-jeremywatt-Desktop-...)
    const encodedDir = workingDir.replace(/\//g, '-');

    // Command to:
    // 1. Find the latest .jsonl session file for this project
    // 2. Get its modification time in seconds since epoch
    // 3. Get the last line to check message type
    // Wrap in bash -c to ensure bash syntax works regardless of user's default shell (e.g., nushell)
    const bashScript = `
      SESSION_DIR="$HOME/.claude/projects/${encodedDir}"
      if [ -d "$SESSION_DIR" ]; then
        LATEST=$(ls -t "$SESSION_DIR"/*.jsonl 2>/dev/null | head -1)
        if [ -n "$LATEST" ]; then
          # Get file mod time and current time
          MOD_TIME=$(stat -f %m "$LATEST" 2>/dev/null || stat -c %Y "$LATEST" 2>/dev/null)
          NOW=$(date +%s)
          AGE=$((NOW - MOD_TIME))
          # Get last non-empty line
          LAST_LINE=$(tail -1 "$LATEST" 2>/dev/null)
          echo "AGE:$AGE"
          echo "LAST:$LAST_LINE"
        else
          echo "NO_SESSION"
        fi
      else
        echo "NO_PROJECT"
      fi
    `;
    const command = `bash -c '${bashScript.replace(/'/g, "'\"'\"'")}'`;

    const result = await this.executeCommand(machineId, command);

    if (!result.success) {
      return { status: 'idle', error: result.stderr };
    }

    const output = result.stdout;

    if (output.includes('NO_SESSION') || output.includes('NO_PROJECT')) {
      return { status: 'idle' };
    }

    // Parse age from session file modification time
    const ageMatch = output.match(/AGE:(\d+)/);
    const age = ageMatch ? parseInt(ageMatch[1], 10) : Infinity;
    const ageSeconds = isFinite(age) ? age : undefined;

    // Determine status:
    // - If file modified within last 30 seconds = working
    // - Otherwise = idle
    if (age <= 30) {
      return { status: 'working', ageSeconds };
    } else {
      return { status: 'idle', ageSeconds };
    }
  }
}

export const sshConnectionService = new SSHConnectionService();
