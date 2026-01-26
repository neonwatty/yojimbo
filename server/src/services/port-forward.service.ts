import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import os from 'os';
import { Client } from 'ssh2';
import { getDatabase } from '../db/connection.js';
import { terminalManager } from './terminal-manager.service.js';
import { SSHBackend } from './backends/ssh.backend.js';
import type { PortForward, PortForwardStatus } from '@cc-orchestrator/shared';
import net from 'net';

// Port detection patterns for common dev servers
const PORT_PATTERNS = [
  /listening on.*?:(\d+)/i,
  /localhost:(\d+)/i,
  /127\.0\.0\.1:(\d+)/i,
  /Server running.*?:(\d+)/i,
  /Local:\s*https?:\/\/localhost:(\d+)/i,
  /Network:\s*https?:\/\/.*?:(\d+)/i,
  /Started.*?port\s*(\d+)/i,
  /Available on.*?:(\d+)/i,
  /Listening on port\s*(\d+)/i,
  /Running on\s*https?:\/\/.*?:(\d+)/i,
];

// Ports to ignore (common system/service ports)
const IGNORED_PORTS = new Set([22, 80, 443, 3306, 5432, 6379, 27017]);

// Database row type
interface PortForwardRow {
  id: string;
  instance_id: string;
  remote_port: number;
  local_port: number;
  status: PortForwardStatus;
  reconnect_attempts: number;
  last_error: string | null;
  created_at: string;
}

// Helper to convert DB row to PortForward
function rowToPortForward(row: PortForwardRow): PortForward {
  return {
    id: row.id,
    instanceId: row.instance_id,
    remotePort: row.remote_port,
    localPort: row.local_port,
    status: row.status,
    reconnectAttempts: row.reconnect_attempts || 0,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

// Reconnection configuration
const RECONNECT_CONFIG = {
  initialDelayMs: 1000,    // 1 second
  maxDelayMs: 30000,       // 30 seconds
  multiplier: 2,           // Exponential backoff
  maxAttempts: 10,         // Max reconnect attempts before giving up
};

// Forward info tracked for each active forward
interface ForwardInfo {
  id: string;
  server: net.Server;
  client: Client;
  instanceId: string;
  remotePort: number;
  localPort: number;
  reconnectTimer?: NodeJS.Timeout;
  isReconnecting: boolean;
}

/**
 * Port Forward Service
 * Detects ports in terminal output and sets up SSH tunnels for remote instances
 */
class PortForwardService extends EventEmitter {
  // Track active forwards per instance: instanceId -> Map<remotePort, ForwardInfo>
  private activeForwards: Map<string, Map<number, ForwardInfo>> = new Map();

  // Track detected ports to avoid duplicate detection
  private detectedPorts: Map<string, Set<number>> = new Map();

  /**
   * Analyze terminal output for port announcements
   * Returns detected ports that haven't been seen before
   */
  analyzeOutput(instanceId: string, output: string): number[] {
    const newPorts: number[] = [];

    // Initialize tracking set for this instance
    if (!this.detectedPorts.has(instanceId)) {
      this.detectedPorts.set(instanceId, new Set());
    }
    const detected = this.detectedPorts.get(instanceId)!;

    for (const pattern of PORT_PATTERNS) {
      const matches = output.matchAll(new RegExp(pattern, 'gi'));
      for (const match of matches) {
        const port = parseInt(match[1], 10);

        // Skip if invalid, ignored, or already detected
        if (isNaN(port) || port < 1024 || port > 65535 || IGNORED_PORTS.has(port) || detected.has(port)) {
          continue;
        }

        detected.add(port);
        newPorts.push(port);
      }
    }

    return newPorts;
  }

  /**
   * Set up port forwarding for a remote instance
   * Creates a local server that tunnels to the remote port via SSH
   */
  async createForward(instanceId: string, remotePort: number, preferredLocalPort?: number): Promise<PortForward | null> {
    const backend = terminalManager.getBackend(instanceId);

    // Only forward for SSH backends
    if (!backend || backend.type !== 'ssh') {
      console.log(`[PortForward] Skipping - not an SSH backend for instance ${instanceId}`);
      return null;
    }

    const sshBackend = backend as SSHBackend;
    const sshConfig = sshBackend.getSSHConfig();

    // Find an available local port
    const localPort = await this.findAvailablePort(preferredLocalPort || remotePort);

    if (!localPort) {
      console.error(`[PortForward] Could not find available local port`);
      return null;
    }

    // Save to database first to get the ID
    const db = getDatabase();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO port_forwards (id, instance_id, remote_port, local_port, status, reconnect_attempts, last_error)
      VALUES (?, ?, ?, ?, 'active', 0, NULL)
    `).run(id, instanceId, remotePort, localPort);

    try {
      // Create the actual connection
      await this.establishConnection(id, instanceId, remotePort, localPort, sshConfig);

      const row = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(id) as PortForwardRow;
      const portForward = rowToPortForward(row);

      this.emit('forward:created', portForward);

      return portForward;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[PortForward] Failed to create forward:`, err);

      // Update database with error
      db.prepare(`UPDATE port_forwards SET status = 'failed', last_error = ? WHERE id = ?`).run(errorMessage, id);

      const row = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(id) as PortForwardRow;
      return rowToPortForward(row);
    }
  }

  /**
   * Establish SSH connection and local server for a forward
   */
  private async establishConnection(
    forwardId: string,
    instanceId: string,
    remotePort: number,
    localPort: number,
    sshConfig: { host: string; port: number; username: string; privateKeyPath?: string }
  ): Promise<void> {
    // Create SSH client for port forwarding
    const client = new Client();

    await new Promise<void>((resolve, reject) => {
      client.on('ready', () => resolve());
      client.on('error', reject);

      let privateKey: Buffer | undefined;
      if (sshConfig.privateKeyPath) {
        const keyPath = sshConfig.privateKeyPath.replace(/^~/, os.homedir());
        privateKey = fs.readFileSync(keyPath);
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
        reject(new Error('No SSH private key found'));
        return;
      }

      client.connect({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        privateKey,
      });
    });

    // Create local server for port forwarding
    const server = net.createServer((socket) => {
      client.forwardOut(
        '127.0.0.1',
        localPort,
        '127.0.0.1',
        remotePort,
        (err, stream) => {
          if (err) {
            console.error(`[PortForward] Forward error:`, err);
            socket.destroy();
            return;
          }

          socket.pipe(stream);
          stream.pipe(socket);

          socket.on('error', () => stream.destroy());
          stream.on('error', () => socket.destroy());
        }
      );
    });

    // Start the local server
    await new Promise<void>((resolve, reject) => {
      server.on('error', reject);
      server.listen(localPort, '127.0.0.1', () => {
        console.log(`[PortForward] Forwarding localhost:${localPort} -> ${sshConfig.host}:${remotePort}`);
        resolve();
      });
    });

    // Track the forward
    if (!this.activeForwards.has(instanceId)) {
      this.activeForwards.set(instanceId, new Map());
    }

    const forwardInfo: ForwardInfo = {
      id: forwardId,
      server,
      client,
      instanceId,
      remotePort,
      localPort,
      isReconnecting: false,
    };

    this.activeForwards.get(instanceId)!.set(remotePort, forwardInfo);

    // Set up connection error handling for auto-reconnect
    client.on('error', (err) => {
      console.error(`[PortForward] SSH connection error for ${forwardId}:`, err);
      this.handleConnectionError(forwardInfo, sshConfig, err);
    });

    client.on('close', () => {
      console.log(`[PortForward] SSH connection closed for ${forwardId}`);
      // Only attempt reconnect if not intentionally closed
      const currentForward = this.activeForwards.get(instanceId)?.get(remotePort);
      if (currentForward && !currentForward.isReconnecting) {
        this.handleConnectionError(forwardInfo, sshConfig, new Error('Connection closed'));
      }
    });

    client.on('end', () => {
      console.log(`[PortForward] SSH connection ended for ${forwardId}`);
    });
  }

  /**
   * Handle connection error with auto-reconnect
   */
  private async handleConnectionError(
    forwardInfo: ForwardInfo,
    sshConfig: { host: string; port: number; username: string; privateKeyPath?: string },
    error: Error
  ): Promise<void> {
    const db = getDatabase();

    // Get current state from DB
    const row = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(forwardInfo.id) as PortForwardRow | undefined;
    if (!row || row.status === 'closed') {
      return; // Forward was intentionally closed
    }

    const attempts = (row.reconnect_attempts || 0) + 1;

    if (attempts > RECONNECT_CONFIG.maxAttempts) {
      // Max attempts reached, mark as failed
      console.log(`[PortForward] Max reconnect attempts reached for ${forwardInfo.id}`);
      db.prepare(`UPDATE port_forwards SET status = 'failed', reconnect_attempts = ?, last_error = ? WHERE id = ?`)
        .run(attempts, error.message, forwardInfo.id);

      const updatedRow = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(forwardInfo.id) as PortForwardRow;
      this.emit('forward:updated', rowToPortForward(updatedRow));
      return;
    }

    // Mark as reconnecting
    forwardInfo.isReconnecting = true;
    db.prepare(`UPDATE port_forwards SET status = 'reconnecting', reconnect_attempts = ?, last_error = ? WHERE id = ?`)
      .run(attempts, error.message, forwardInfo.id);

    const updatedRow = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(forwardInfo.id) as PortForwardRow;
    this.emit('forward:updated', rowToPortForward(updatedRow));

    // Calculate backoff delay
    const delay = Math.min(
      RECONNECT_CONFIG.initialDelayMs * Math.pow(RECONNECT_CONFIG.multiplier, attempts - 1),
      RECONNECT_CONFIG.maxDelayMs
    );

    console.log(`[PortForward] Attempting reconnect for ${forwardInfo.id} in ${delay}ms (attempt ${attempts})`);

    // Clean up old connection
    try {
      forwardInfo.server.close();
      forwardInfo.client.end();
    } catch {
      // Ignore cleanup errors
    }

    // Schedule reconnect
    forwardInfo.reconnectTimer = setTimeout(async () => {
      try {
        await this.establishConnection(
          forwardInfo.id,
          forwardInfo.instanceId,
          forwardInfo.remotePort,
          forwardInfo.localPort,
          sshConfig
        );

        // Success - update status
        db.prepare(`UPDATE port_forwards SET status = 'active', last_error = NULL WHERE id = ?`)
          .run(forwardInfo.id);

        const successRow = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(forwardInfo.id) as PortForwardRow;
        this.emit('forward:updated', rowToPortForward(successRow));
        console.log(`[PortForward] Reconnected successfully for ${forwardInfo.id}`);
      } catch (reconnectError) {
        const errMsg = reconnectError instanceof Error ? reconnectError.message : String(reconnectError);
        console.error(`[PortForward] Reconnect failed for ${forwardInfo.id}:`, errMsg);
        this.handleConnectionError(forwardInfo, sshConfig, new Error(errMsg));
      }
    }, delay);
  }

  /**
   * Manually trigger reconnection for a forward
   */
  async reconnectForward(forwardId: string): Promise<PortForward | null> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(forwardId) as PortForwardRow | undefined;

    if (!row) {
      return null;
    }

    const backend = terminalManager.getBackend(row.instance_id);
    if (!backend || backend.type !== 'ssh') {
      return null;
    }

    const sshBackend = backend as SSHBackend;
    const sshConfig = sshBackend.getSSHConfig();

    // Reset reconnect attempts
    db.prepare(`UPDATE port_forwards SET status = 'reconnecting', reconnect_attempts = 0, last_error = NULL WHERE id = ?`)
      .run(forwardId);

    // Cancel any pending reconnect timer
    const instanceForwards = this.activeForwards.get(row.instance_id);
    if (instanceForwards) {
      const forward = instanceForwards.get(row.remote_port);
      if (forward?.reconnectTimer) {
        clearTimeout(forward.reconnectTimer);
      }
      // Clean up old connection
      if (forward) {
        try {
          forward.server.close();
          forward.client.end();
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    try {
      await this.establishConnection(forwardId, row.instance_id, row.remote_port, row.local_port, sshConfig);

      db.prepare(`UPDATE port_forwards SET status = 'active', last_error = NULL WHERE id = ?`).run(forwardId);

      const updatedRow = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(forwardId) as PortForwardRow;
      const portForward = rowToPortForward(updatedRow);
      this.emit('forward:updated', portForward);

      return portForward;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      db.prepare(`UPDATE port_forwards SET status = 'failed', last_error = ? WHERE id = ?`).run(errorMessage, forwardId);

      const updatedRow = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(forwardId) as PortForwardRow;
      const portForward = rowToPortForward(updatedRow);
      this.emit('forward:updated', portForward);

      return portForward;
    }
  }

  /**
   * Close a port forward
   */
  async closeForward(forwardId: string): Promise<boolean> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM port_forwards WHERE id = ?').get(forwardId) as PortForwardRow | undefined;

    if (!row) {
      return false;
    }

    // Close the server and SSH client
    const instanceForwards = this.activeForwards.get(row.instance_id);
    if (instanceForwards) {
      const forward = instanceForwards.get(row.remote_port);
      if (forward) {
        // Cancel any pending reconnect
        if (forward.reconnectTimer) {
          clearTimeout(forward.reconnectTimer);
        }
        // Mark as not reconnecting to prevent auto-reconnect
        forward.isReconnecting = true;
        try {
          forward.server.close();
          forward.client.end();
        } catch {
          // Ignore cleanup errors
        }
        instanceForwards.delete(row.remote_port);
      }
    }

    // Update database
    db.prepare(`UPDATE port_forwards SET status = 'closed' WHERE id = ?`).run(forwardId);

    const portForward = rowToPortForward({
      ...row,
      status: 'closed',
      reconnect_attempts: row.reconnect_attempts,
      last_error: null,
    });

    this.emit('forward:closed', portForward);

    return true;
  }

  /**
   * Close all forwards for an instance
   */
  async closeInstanceForwards(instanceId: string): Promise<void> {
    const instanceForwards = this.activeForwards.get(instanceId);
    if (instanceForwards) {
      for (const forward of instanceForwards.values()) {
        // Cancel any pending reconnect
        if (forward.reconnectTimer) {
          clearTimeout(forward.reconnectTimer);
        }
        // Mark as not reconnecting to prevent auto-reconnect
        forward.isReconnecting = true;
        try {
          forward.server.close();
          forward.client.end();
        } catch {
          // Ignore cleanup errors
        }
      }
      this.activeForwards.delete(instanceId);
    }

    // Clear detected ports
    this.detectedPorts.delete(instanceId);

    // Update database - close all non-closed forwards
    const db = getDatabase();
    db.prepare(`UPDATE port_forwards SET status = 'closed' WHERE instance_id = ? AND status IN ('active', 'reconnecting', 'failed')`).run(instanceId);
  }

  /**
   * Get active forwards for an instance
   */
  getInstanceForwards(instanceId: string): PortForward[] {
    const db = getDatabase();
    const rows = db
      .prepare('SELECT * FROM port_forwards WHERE instance_id = ? AND status = ?')
      .all(instanceId, 'active') as PortForwardRow[];

    return rows.map(rowToPortForward);
  }

  /**
   * Find an available local port
   */
  private async findAvailablePort(preferredPort: number): Promise<number | null> {
    // Try the preferred port first
    if (await this.isPortAvailable(preferredPort)) {
      return preferredPort;
    }

    // Try ports in range around preferred port
    for (let offset = 1; offset <= 100; offset++) {
      const port = preferredPort + offset;
      if (port <= 65535 && await this.isPortAvailable(port)) {
        return port;
      }
    }

    return null;
  }

  /**
   * Check if a port is available
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });
  }
}

export const portForwardService = new PortForwardService();
