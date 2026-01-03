import { EventEmitter } from 'events';
import { Client } from 'ssh2';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { getDatabase } from '../db/connection.js';
import type { SSHConfig } from './terminal-backend.js';

interface RemoteMachineRow {
  id: string;
  hostname: string;
  port: number;
  username: string;
  ssh_key_path: string | null;
}

interface TunnelInfo {
  client: Client;
  remotePort: number;
  localPort: number;
  instanceId: string;
  machineId: string;
}

/**
 * Reverse Tunnel Service
 * Creates SSH reverse tunnels so remote machines can reach the local Yojimbo server.
 *
 * When hooks are installed on a remote machine, they curl `localhost:3456` to send status updates.
 * This service creates a reverse tunnel: remote:3456 → local:3456
 *
 * Uses SSH's `forwardIn` which tells the SSH server to listen on a port and forward
 * connections back to our callback, which we then proxy to the local server.
 */
class ReverseTunnelService extends EventEmitter {
  // Track active tunnels per instance: instanceId -> TunnelInfo
  private activeTunnels: Map<string, TunnelInfo> = new Map();

  /**
   * Set up a reverse tunnel for an instance so hooks can reach the local server
   * @param instanceId - The instance ID
   * @param machineId - The remote machine ID
   * @param localPort - The local port where Yojimbo server is running (default 3456)
   * @param remotePort - The port to listen on remote machine (default same as local)
   */
  async createTunnel(
    instanceId: string,
    machineId: string,
    localPort: number = 3456,
    remotePort: number = localPort
  ): Promise<{ success: boolean; error?: string }> {
    // Check if tunnel already exists for this instance
    if (this.activeTunnels.has(instanceId)) {
      console.log(`[ReverseTunnel] Tunnel already exists for instance ${instanceId}`);
      return { success: true };
    }

    // Get machine SSH config from database
    const db = getDatabase();
    const machine = db.prepare(`
      SELECT id, hostname, port, username, ssh_key_path
      FROM remote_machines
      WHERE id = ?
    `).get(machineId) as RemoteMachineRow | undefined;

    if (!machine) {
      return { success: false, error: 'Remote machine not found' };
    }

    const sshConfig: SSHConfig = {
      host: machine.hostname,
      port: machine.port,
      username: machine.username,
      privateKeyPath: machine.ssh_key_path || undefined,
    };

    return this.createTunnelWithConfig(instanceId, machineId, sshConfig, localPort, remotePort);
  }

  /**
   * Create a reverse tunnel with the given SSH config
   */
  private async createTunnelWithConfig(
    instanceId: string,
    machineId: string,
    config: SSHConfig,
    localPort: number,
    remotePort: number
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, error: 'SSH connection timeout' });
      }, 15000);

      // Load SSH private key
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
        console.log(`[ReverseTunnel] SSH connected for instance ${instanceId}`);

        // Set up reverse port forward: remote listens on remotePort, forwards to us
        // forwardIn tells the SSH server to listen on the given address/port
        client.forwardIn('127.0.0.1', remotePort, (err) => {
          clearTimeout(timeout);

          if (err) {
            console.error(`[ReverseTunnel] Failed to create reverse tunnel:`, err);
            client.end();
            resolve({ success: false, error: `Failed to create reverse tunnel: ${err.message}` });
            return;
          }

          console.log(`[ReverseTunnel] Reverse tunnel established: remote:${remotePort} → local:${localPort}`);

          // Track the tunnel
          this.activeTunnels.set(instanceId, {
            client,
            remotePort,
            localPort,
            instanceId,
            machineId,
          });

          this.emit('tunnel:created', { instanceId, machineId, remotePort, localPort });
          resolve({ success: true });
        });
      });

      // Handle incoming connections on the reverse tunnel
      client.on('tcp connection', (details, accept, _reject) => {
        console.log(`[ReverseTunnel] Incoming connection from ${details.srcIP}:${details.srcPort}`);

        // Accept the incoming channel
        const channel = accept();

        // Connect to local Yojimbo server
        const localSocket = net.createConnection({ port: localPort, host: '127.0.0.1' }, () => {
          console.log(`[ReverseTunnel] Connected to local server on port ${localPort}`);
        });

        // Pipe data bidirectionally
        channel.pipe(localSocket);
        localSocket.pipe(channel);

        // Handle errors and cleanup
        channel.on('error', (err: Error) => {
          console.error(`[ReverseTunnel] Channel error:`, err);
          localSocket.destroy();
        });

        localSocket.on('error', (err: Error) => {
          console.error(`[ReverseTunnel] Local socket error:`, err);
          channel.close();
        });

        channel.on('close', () => {
          localSocket.destroy();
        });

        localSocket.on('close', () => {
          channel.close();
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[ReverseTunnel] SSH error:`, err);

        // Clean up if tunnel was being set up
        if (!this.activeTunnels.has(instanceId)) {
          resolve({ success: false, error: `SSH connection error: ${err.message}` });
        } else {
          // Tunnel existed, emit event for reconnection handling
          this.emit('tunnel:error', { instanceId, error: err.message });
        }
      });

      client.on('close', () => {
        console.log(`[ReverseTunnel] SSH connection closed for instance ${instanceId}`);
        this.activeTunnels.delete(instanceId);
        this.emit('tunnel:closed', { instanceId });
      });

      // Connect to remote host
      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 10000,
        keepaliveInterval: 30000,
        keepaliveCountMax: 3,
      });
    });
  }

  /**
   * Close the reverse tunnel for an instance
   */
  async closeTunnel(instanceId: string): Promise<boolean> {
    const tunnel = this.activeTunnels.get(instanceId);
    if (!tunnel) {
      return false;
    }

    console.log(`[ReverseTunnel] Closing tunnel for instance ${instanceId}`);

    try {
      tunnel.client.end();
    } catch (err) {
      console.error(`[ReverseTunnel] Error closing tunnel:`, err);
    }

    this.activeTunnels.delete(instanceId);
    this.emit('tunnel:closed', { instanceId });

    return true;
  }

  /**
   * Close all tunnels for a specific machine
   */
  async closeAllTunnelsForMachine(machineId: string): Promise<void> {
    for (const [instanceId, tunnel] of this.activeTunnels.entries()) {
      if (tunnel.machineId === machineId) {
        await this.closeTunnel(instanceId);
      }
    }
  }

  /**
   * Check if a tunnel exists for an instance
   */
  hasTunnel(instanceId: string): boolean {
    return this.activeTunnels.has(instanceId);
  }

  /**
   * Get tunnel info for an instance
   */
  getTunnelInfo(instanceId: string): TunnelInfo | undefined {
    return this.activeTunnels.get(instanceId);
  }

  /**
   * Get all active tunnels
   */
  getAllTunnels(): TunnelInfo[] {
    return Array.from(this.activeTunnels.values());
  }
}

export const reverseTunnelService = new ReverseTunnelService();
