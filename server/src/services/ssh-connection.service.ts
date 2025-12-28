import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDatabase } from '../db/connection.js';
import type { SSHConfig } from './terminal-backend.js';
import type { MachineStatus, SSHKey } from '@cc-orchestrator/shared';

interface RemoteMachineRow {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  ssh_key_path: string | null;
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

      // Read private key
      let privateKey: Buffer | undefined;
      if (config.privateKeyPath) {
        const keyPath = config.privateKeyPath.replace(/^~/, os.homedir());
        try {
          privateKey = fs.readFileSync(keyPath);
        } catch (err) {
          clearTimeout(timeout);
          resolve({ success: false, error: `Failed to read SSH key: ${keyPath}` });
          return;
        }
      } else {
        // Try default keys
        const defaultKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa'];
        for (const keyName of defaultKeys) {
          const keyPath = `${os.homedir()}/.ssh/${keyName}`;
          if (fs.existsSync(keyPath)) {
            try {
              privateKey = fs.readFileSync(keyPath);
              break;
            } catch {
              // Continue to next key
            }
          }
        }
      }

      if (!privateKey) {
        clearTimeout(timeout);
        resolve({ success: false, error: 'No SSH private key found' });
        return;
      }

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
    };
  }
}

export const sshConnectionService = new SSHConnectionService();
