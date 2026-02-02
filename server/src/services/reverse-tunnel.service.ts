import { EventEmitter } from 'events';
import { Client } from 'ssh2';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { getDatabase } from '../db/connection.js';
import type { SSHConfig } from './terminal-backend.js';
import type { TunnelHealthState, TunnelStatus, TunnelStateChange } from '@cc-orchestrator/shared';

interface RemoteMachineRow {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  ssh_key_path: string | null;
}

interface MachineTunnel {
  client: Client;
  remotePort: number;
  localPort: number;
  machineId: string;
  machineName: string;
  // Track which instances are using this tunnel
  instanceIds: Set<string>;
  // Health tracking
  healthState: TunnelHealthState;
  lastSeenAt: Date | null;
  lastHealthCheck: Date | null;
  reconnectAttempts: number;
  error: string | null;
  // SSH config for reconnection
  sshConfig: SSHConfig;
  // Health check interval
  healthCheckInterval: ReturnType<typeof setInterval> | null;
}

// Constants for health monitoring and reconnection
const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000; // 1 second base for exponential backoff
const HEALTH_CHECK_TIMEOUT_MS = 5000; // 5 seconds for health check

/**
 * Reverse Tunnel Service
 * Creates SSH reverse tunnels so remote machines can reach the local Yojimbo server.
 *
 * When hooks are installed on a remote machine, they curl `localhost:3456` to send status updates.
 * This service creates a reverse tunnel: remote:3456 → local:3456
 *
 * Tunnels are shared per machine - multiple instances on the same machine share one tunnel.
 * The tunnel is only closed when the last instance using it is removed.
 *
 * Uses SSH's `forwardIn` which tells the SSH server to listen on a port and forward
 * connections back to our callback, which we then proxy to the local server.
 */
class ReverseTunnelService extends EventEmitter {
  // Track active tunnels per machine: machineId -> MachineTunnel
  private machineTunnels: Map<string, MachineTunnel> = new Map();
  // Track reconnection in progress
  private reconnecting: Set<string> = new Set();

  /**
   * Set up a reverse tunnel for an instance so hooks can reach the local server.
   * If a tunnel already exists for this machine, the instance is added to it.
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
  ): Promise<{ success: boolean; error?: string; shared?: boolean }> {
    // Check if a tunnel already exists for this machine
    const existingTunnel = this.machineTunnels.get(machineId);
    if (existingTunnel) {
      // Add this instance to the existing tunnel
      existingTunnel.instanceIds.add(instanceId);
      console.log(`[ReverseTunnel] Instance ${instanceId} sharing existing tunnel for machine ${machineId} (${existingTunnel.instanceIds.size} instances)`);
      return { success: true, shared: true };
    }

    // Get machine SSH config from database
    const db = getDatabase();
    const machine = db.prepare(`
      SELECT id, name, hostname, port, username, ssh_key_path
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

    return this.createTunnelWithConfig(instanceId, machineId, machine.name, sshConfig, localPort, remotePort);
  }

  /**
   * Create a reverse tunnel with the given SSH config
   */
  private async createTunnelWithConfig(
    instanceId: string,
    machineId: string,
    machineName: string,
    config: SSHConfig,
    localPort: number,
    remotePort: number
  ): Promise<{ success: boolean; error?: string; shared?: boolean }> {
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
        console.log(`[ReverseTunnel] SSH connected for machine ${machineId}`);

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

          console.log(`[ReverseTunnel] Reverse tunnel established for machine ${machineId}: remote:${remotePort} → local:${localPort}`);

          // Track the tunnel by machine, with this instance as the first user
          const instanceIds = new Set<string>();
          instanceIds.add(instanceId);

          const tunnel: MachineTunnel = {
            client,
            remotePort,
            localPort,
            machineId,
            machineName,
            instanceIds,
            healthState: 'healthy',
            lastSeenAt: new Date(),
            lastHealthCheck: null,
            reconnectAttempts: 0,
            error: null,
            sshConfig: config,
            healthCheckInterval: null,
          };

          this.machineTunnels.set(machineId, tunnel);

          // Start health monitoring
          this.startHealthMonitoring(machineId);

          // Emit state change
          this.emitStateChange(machineId, null, 'healthy');

          this.emit('tunnel:created', { instanceId, machineId, remotePort, localPort });
          resolve({ success: true, shared: false });
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
        console.error(`[ReverseTunnel] SSH error for machine ${machineId}:`, err);

        // Clean up if tunnel was being set up
        if (!this.machineTunnels.has(machineId)) {
          resolve({ success: false, error: `SSH connection error: ${err.message}` });
        } else {
          // Tunnel existed - update state and attempt reconnection
          const tunnel = this.machineTunnels.get(machineId);
          if (tunnel) {
            const previousState = tunnel.healthState;
            tunnel.healthState = 'disconnected';
            tunnel.error = err.message;
            this.emitStateChange(machineId, previousState, 'disconnected', err.message);
          }
          this.emit('tunnel:error', { machineId, error: err.message });
          // Attempt reconnection
          this.attemptReconnection(machineId);
        }
      });

      client.on('close', () => {
        console.log(`[ReverseTunnel] SSH connection closed for machine ${machineId}`);
        const tunnel = this.machineTunnels.get(machineId);
        if (tunnel) {
          // Stop health monitoring
          this.stopHealthMonitoring(machineId);
          const previousState = tunnel.healthState;
          // If we have instances still using this tunnel, attempt reconnection
          if (tunnel.instanceIds.size > 0 && !this.reconnecting.has(machineId)) {
            tunnel.healthState = 'disconnected';
            this.emitStateChange(machineId, previousState, 'disconnected');
            this.attemptReconnection(machineId);
          } else if (tunnel.instanceIds.size === 0) {
            // No instances, clean up
            this.machineTunnels.delete(machineId);
            this.emitStateChange(machineId, previousState, 'disconnected');
          }
        }
        this.emit('tunnel:closed', { machineId });
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
   * Remove an instance from a tunnel. If it's the last instance, close the tunnel.
   * @param instanceId - The instance ID to remove
   * @returns true if the instance was removed (or tunnel closed), false if not found
   */
  async closeTunnel(instanceId: string): Promise<boolean> {
    // Find which machine tunnel this instance belongs to
    for (const [machineId, tunnel] of this.machineTunnels.entries()) {
      if (tunnel.instanceIds.has(instanceId)) {
        tunnel.instanceIds.delete(instanceId);

        if (tunnel.instanceIds.size === 0) {
          // Last instance removed, close the tunnel
          console.log(`[ReverseTunnel] Closing tunnel for machine ${machineId} (last instance ${instanceId} removed)`);
          this.stopHealthMonitoring(machineId);
          const previousState = tunnel.healthState;
          try {
            tunnel.client.end();
          } catch (err) {
            console.error(`[ReverseTunnel] Error closing tunnel:`, err);
          }
          this.machineTunnels.delete(machineId);
          this.emitStateChange(machineId, previousState, 'disconnected');
          this.emit('tunnel:closed', { machineId });
        } else {
          console.log(`[ReverseTunnel] Instance ${instanceId} removed from tunnel for machine ${machineId} (${tunnel.instanceIds.size} instances remaining)`);
        }

        return true;
      }
    }

    return false;
  }

  /**
   * Close the tunnel for a specific machine (regardless of instances)
   */
  async closeMachineTunnel(machineId: string): Promise<boolean> {
    const tunnel = this.machineTunnels.get(machineId);
    if (!tunnel) {
      return false;
    }

    console.log(`[ReverseTunnel] Force closing tunnel for machine ${machineId}`);

    this.stopHealthMonitoring(machineId);
    const previousState = tunnel.healthState;

    try {
      tunnel.client.end();
    } catch (err) {
      console.error(`[ReverseTunnel] Error closing tunnel:`, err);
    }

    this.machineTunnels.delete(machineId);
    this.emitStateChange(machineId, previousState, 'disconnected');
    this.emit('tunnel:closed', { machineId });

    return true;
  }

  /**
   * Check if a tunnel exists for an instance
   */
  hasTunnel(instanceId: string): boolean {
    for (const tunnel of this.machineTunnels.values()) {
      if (tunnel.instanceIds.has(instanceId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a tunnel exists for a machine
   */
  hasMachineTunnel(machineId: string): boolean {
    return this.machineTunnels.has(machineId);
  }

  /**
   * Get tunnel info for a machine
   */
  getMachineTunnel(machineId: string): MachineTunnel | undefined {
    return this.machineTunnels.get(machineId);
  }

  /**
   * Get all active machine tunnels
   */
  getAllTunnels(): MachineTunnel[] {
    return Array.from(this.machineTunnels.values());
  }

  /**
   * Get the machine ID that an instance's tunnel belongs to
   */
  getMachineIdForInstance(instanceId: string): string | undefined {
    for (const [machineId, tunnel] of this.machineTunnels.entries()) {
      if (tunnel.instanceIds.has(instanceId)) {
        return machineId;
      }
    }
    return undefined;
  }

  // ============================================
  // Health Monitoring
  // ============================================

  /**
   * Start health monitoring for a tunnel
   */
  private startHealthMonitoring(machineId: string): void {
    const tunnel = this.machineTunnels.get(machineId);
    if (!tunnel) return;

    // Clear any existing interval
    if (tunnel.healthCheckInterval) {
      clearInterval(tunnel.healthCheckInterval);
    }

    // Start periodic health checks
    tunnel.healthCheckInterval = setInterval(() => {
      this.performHealthCheck(machineId);
    }, HEALTH_CHECK_INTERVAL_MS);

    console.log(`[ReverseTunnel] Started health monitoring for machine ${machineId}`);
  }

  /**
   * Stop health monitoring for a tunnel
   */
  private stopHealthMonitoring(machineId: string): void {
    const tunnel = this.machineTunnels.get(machineId);
    if (tunnel?.healthCheckInterval) {
      clearInterval(tunnel.healthCheckInterval);
      tunnel.healthCheckInterval = null;
      console.log(`[ReverseTunnel] Stopped health monitoring for machine ${machineId}`);
    }
  }

  /**
   * Perform a health check by attempting to connect through the tunnel
   */
  private async performHealthCheck(machineId: string): Promise<void> {
    const tunnel = this.machineTunnels.get(machineId);
    if (!tunnel || tunnel.healthState === 'reconnecting') return;

    tunnel.lastHealthCheck = new Date();

    // Attempt to send a simple command through SSH to verify connection
    return new Promise<void>((resolve) => {
      const timeoutId = setTimeout(() => {
        // Health check timed out - mark as degraded
        if (tunnel.healthState === 'healthy') {
          console.log(`[ReverseTunnel] Health check timeout for machine ${machineId}`);
          const previousState = tunnel.healthState;
          tunnel.healthState = 'degraded';
          this.emitStateChange(machineId, previousState, 'degraded', 'Health check timeout');
        }
        resolve();
      }, HEALTH_CHECK_TIMEOUT_MS);

      // Try to exec a simple command to verify the connection is alive
      tunnel.client.exec('echo ping', (err, stream) => {
        clearTimeout(timeoutId);

        if (err) {
          // Connection error
          console.log(`[ReverseTunnel] Health check failed for machine ${machineId}: ${err.message}`);
          const previousState = tunnel.healthState;
          if (tunnel.healthState === 'healthy') {
            tunnel.healthState = 'degraded';
            tunnel.error = err.message;
            this.emitStateChange(machineId, previousState, 'degraded', err.message);
          } else if (tunnel.healthState === 'degraded') {
            // Already degraded, now disconnected
            tunnel.healthState = 'disconnected';
            tunnel.error = err.message;
            this.emitStateChange(machineId, previousState, 'disconnected', err.message);
            // Attempt reconnection
            this.attemptReconnection(machineId);
          }
          resolve();
          return;
        }

        let output = '';
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.on('close', () => {
          if (output.trim() === 'ping') {
            // Health check passed
            tunnel.lastSeenAt = new Date();
            if (tunnel.healthState !== 'healthy') {
              const previousState = tunnel.healthState;
              tunnel.healthState = 'healthy';
              tunnel.error = null;
              tunnel.reconnectAttempts = 0;
              this.emitStateChange(machineId, previousState, 'healthy');
              console.log(`[ReverseTunnel] Health restored for machine ${machineId}`);
            }
          } else {
            // Unexpected response
            console.log(`[ReverseTunnel] Unexpected health check response for machine ${machineId}: ${output}`);
          }
          resolve();
        });
      });
    });
  }

  // ============================================
  // Auto-Reconnection
  // ============================================

  /**
   * Attempt to reconnect a disconnected tunnel with exponential backoff
   */
  private async attemptReconnection(machineId: string): Promise<void> {
    const tunnel = this.machineTunnels.get(machineId);
    if (!tunnel) return;

    // Check if already reconnecting
    if (this.reconnecting.has(machineId)) {
      console.log(`[ReverseTunnel] Already reconnecting machine ${machineId}`);
      return;
    }

    // Check if max attempts reached
    if (tunnel.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`[ReverseTunnel] Max reconnect attempts reached for machine ${machineId}`);
      const previousState = tunnel.healthState;
      tunnel.healthState = 'disconnected';
      tunnel.error = `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) exceeded`;
      this.emitStateChange(machineId, previousState, 'disconnected', tunnel.error);
      // Clean up but keep the tunnel record for status reporting
      this.stopHealthMonitoring(machineId);
      return;
    }

    this.reconnecting.add(machineId);
    tunnel.reconnectAttempts++;
    const previousState = tunnel.healthState;
    tunnel.healthState = 'reconnecting';
    this.emitStateChange(machineId, previousState, 'reconnecting');

    // Calculate delay with exponential backoff
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, tunnel.reconnectAttempts - 1);
    console.log(`[ReverseTunnel] Attempting reconnection for machine ${machineId} in ${delay}ms (attempt ${tunnel.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    // Get an instance ID to use for reconnection (just pick the first one)
    const instanceId = tunnel.instanceIds.values().next().value;
    if (!instanceId) {
      console.log(`[ReverseTunnel] No instances to reconnect for machine ${machineId}`);
      this.reconnecting.delete(machineId);
      this.machineTunnels.delete(machineId);
      return;
    }

    // Close the old client
    try {
      tunnel.client.end();
    } catch {
      // Ignore errors closing old client
    }

    // Remove from map temporarily (createTunnelWithConfig will re-add)
    const savedInstanceIds = new Set(tunnel.instanceIds);
    const savedConfig = tunnel.sshConfig;
    const savedMachineName = tunnel.machineName;
    const savedRemotePort = tunnel.remotePort;
    const savedLocalPort = tunnel.localPort;
    this.machineTunnels.delete(machineId);

    // Attempt to create a new tunnel
    const result = await this.createTunnelWithConfig(
      instanceId,
      machineId,
      savedMachineName,
      savedConfig,
      savedLocalPort,
      savedRemotePort
    );

    this.reconnecting.delete(machineId);

    if (result.success) {
      console.log(`[ReverseTunnel] Reconnection successful for machine ${machineId}`);
      // Restore all instance IDs
      const newTunnel = this.machineTunnels.get(machineId);
      if (newTunnel) {
        for (const id of savedInstanceIds) {
          newTunnel.instanceIds.add(id);
        }
      }
    } else {
      console.log(`[ReverseTunnel] Reconnection failed for machine ${machineId}: ${result.error}`);
      // Re-create the tunnel record for retry
      const failedTunnel: MachineTunnel = {
        client: new Client(), // Dummy client
        remotePort: savedRemotePort,
        localPort: savedLocalPort,
        machineId,
        machineName: savedMachineName,
        instanceIds: savedInstanceIds,
        healthState: 'disconnected',
        lastSeenAt: null,
        lastHealthCheck: new Date(),
        reconnectAttempts: tunnel.reconnectAttempts,
        error: result.error || 'Reconnection failed',
        sshConfig: savedConfig,
        healthCheckInterval: null,
      };
      this.machineTunnels.set(machineId, failedTunnel);
      this.emitStateChange(machineId, 'reconnecting', 'disconnected', result.error);
      // Try again
      setTimeout(() => this.attemptReconnection(machineId), 1000);
    }
  }

  /**
   * Force reconnection of a tunnel (called via API)
   */
  async forceReconnect(machineId: string): Promise<{ success: boolean; error?: string }> {
    const tunnel = this.machineTunnels.get(machineId);
    if (!tunnel) {
      return { success: false, error: 'No tunnel found for this machine' };
    }

    // Reset reconnect attempts to allow fresh attempts
    tunnel.reconnectAttempts = 0;

    // If currently reconnecting, wait for it
    if (this.reconnecting.has(machineId)) {
      return { success: false, error: 'Reconnection already in progress' };
    }

    // Close current connection and trigger reconnection
    try {
      tunnel.client.end();
    } catch {
      // Ignore errors closing
    }

    // The close event handler will trigger reconnection
    return { success: true };
  }

  // ============================================
  // Status Reporting
  // ============================================

  /**
   * Get status for all tunnels
   */
  getAllTunnelStatuses(): TunnelStatus[] {
    const statuses: TunnelStatus[] = [];

    for (const tunnel of this.machineTunnels.values()) {
      statuses.push({
        machineId: tunnel.machineId,
        machineName: tunnel.machineName,
        healthState: tunnel.healthState,
        remotePort: tunnel.remotePort,
        localPort: tunnel.localPort,
        instanceCount: tunnel.instanceIds.size,
        lastSeenAt: tunnel.lastSeenAt?.toISOString() || null,
        lastHealthCheck: tunnel.lastHealthCheck?.toISOString() || null,
        reconnectAttempts: tunnel.reconnectAttempts,
        error: tunnel.error,
      });
    }

    return statuses;
  }

  /**
   * Get status for a specific tunnel
   */
  getTunnelStatus(machineId: string): TunnelStatus | null {
    const tunnel = this.machineTunnels.get(machineId);
    if (!tunnel) return null;

    return {
      machineId: tunnel.machineId,
      machineName: tunnel.machineName,
      healthState: tunnel.healthState,
      remotePort: tunnel.remotePort,
      localPort: tunnel.localPort,
      instanceCount: tunnel.instanceIds.size,
      lastSeenAt: tunnel.lastSeenAt?.toISOString() || null,
      lastHealthCheck: tunnel.lastHealthCheck?.toISOString() || null,
      reconnectAttempts: tunnel.reconnectAttempts,
      error: tunnel.error,
    };
  }

  /**
   * Emit a tunnel state change event
   */
  private emitStateChange(
    machineId: string,
    previousState: TunnelHealthState | null,
    newState: TunnelHealthState,
    error?: string
  ): void {
    const stateChange: TunnelStateChange = {
      machineId,
      previousState,
      newState,
      error,
      timestamp: new Date().toISOString(),
    };

    this.emit('tunnel:state', stateChange);
    console.log(`[ReverseTunnel] State change for machine ${machineId}: ${previousState || 'null'} → ${newState}${error ? ` (${error})` : ''}`);
  }
}

export const reverseTunnelService = new ReverseTunnelService();
