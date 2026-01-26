import { exec } from 'child_process';
import { promisify } from 'util';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import { terminalManager } from './terminal-manager.service.js';
import type { DetectedPort, InstancePorts, InstanceStatus, ServiceType } from '@cc-orchestrator/shared';

const execAsync = promisify(exec);

interface LocalInstanceRow {
  id: string;
  name: string;
  working_dir: string;
  status: InstanceStatus;
  pid: number | null;
}

interface LsofPort {
  port: number;
  pid: number;
  processName: string;
  bindAddress: string;
}

/**
 * Port Detection Service
 * Periodically scans for listening ports from local instance process trees
 * and broadcasts updates with Tailscale URLs for remote access
 */
class PortDetectionService {
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 10000; // 10 seconds
  private cachedTailscaleIp: string | null = null;
  private tailscaleIpLastChecked: number = 0;
  private readonly TAILSCALE_CACHE_MS = 60000; // Cache Tailscale IP for 1 minute

  // Cache of detected ports per instance
  private instancePortsCache: Map<string, DetectedPort[]> = new Map();

  /**
   * Start the port detection service
   */
  start(): void {
    if (this.pollInterval) {
      console.log('⚠️ Port detection service already running');
      return;
    }

    console.log('🔌 Starting port detection service');

    // Run immediately on start
    this.pollAllLocalInstances().catch(console.error);

    // Then poll at regular intervals
    this.pollInterval = setInterval(() => {
      this.pollAllLocalInstances().catch(console.error);
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop the port detection service
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('🛑 Stopped port detection service');
    }
  }

  /**
   * Poll all local instances for listening ports
   */
  async pollAllLocalInstances(): Promise<void> {
    const db = getDatabase();

    // Get all open local instances
    const instances = db.prepare(`
      SELECT id, name, working_dir, status, pid
      FROM instances
      WHERE closed_at IS NULL
        AND machine_type = 'local'
    `).all() as LocalInstanceRow[];

    // Get Tailscale IP (cached)
    const tailscaleIp = await this.getTailscaleIp();

    for (const instance of instances) {
      try {
        const ports = await this.detectInstancePorts(instance.id);
        const cachedPorts = this.instancePortsCache.get(instance.id) || [];

        // Check if ports changed
        if (this.portsChanged(cachedPorts, ports)) {
          this.instancePortsCache.set(instance.id, ports);

          // Broadcast update
          const instancePorts: InstancePorts = {
            instanceId: instance.id,
            ports,
            tailscaleIp,
            lastScannedAt: new Date().toISOString(),
          };

          broadcast({
            type: 'ports:updated',
            instanceId: instance.id,
            instancePorts,
          });

          if (ports.length > 0) {
            console.log(`🔌 Ports updated for ${instance.name}: ${ports.map(p => p.port).join(', ')}`);
          }
        }
      } catch (error) {
        console.error(`Error detecting ports for ${instance.name}:`, error);
      }
    }
  }

  /**
   * Detect listening ports for a specific instance
   */
  async detectInstancePorts(instanceId: string): Promise<DetectedPort[]> {
    // Get the terminal PID
    const terminalPid = terminalManager.getPid(instanceId);
    if (!terminalPid) {
      return [];
    }

    // Get all child PIDs in the process tree
    const pids = await this.getProcessTree(terminalPid);
    if (pids.length === 0) {
      return [];
    }

    // Get all listening ports on the system
    const listeningPorts = await this.getListeningPorts();

    // Filter to ports owned by processes in the tree
    const detectedPorts: DetectedPort[] = [];
    for (const port of listeningPorts) {
      if (pids.includes(port.pid)) {
        detectedPorts.push({
          port: port.port,
          pid: port.pid,
          processName: port.processName,
          bindAddress: port.bindAddress,
          isAccessible: this.isAccessibleAddress(port.bindAddress),
          serviceType: this.detectServiceType(port.processName),
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Sort by port number
    detectedPorts.sort((a, b) => a.port - b.port);

    return detectedPorts;
  }

  /**
   * Get all PIDs in a process tree (parent + all descendants)
   */
  private async getProcessTree(rootPid: number): Promise<number[]> {
    const pids: number[] = [rootPid];

    try {
      // Use pgrep to find all child processes recursively
      // We'll do a breadth-first search
      const toProcess = [rootPid];

      while (toProcess.length > 0) {
        const parentPid = toProcess.shift()!;

        try {
          const { stdout } = await execAsync(`pgrep -P ${parentPid}`);
          const childPids = stdout
            .trim()
            .split('\n')
            .filter(line => line)
            .map(line => parseInt(line, 10))
            .filter(pid => !isNaN(pid));

          for (const childPid of childPids) {
            if (!pids.includes(childPid)) {
              pids.push(childPid);
              toProcess.push(childPid);
            }
          }
        } catch {
          // pgrep returns exit code 1 if no children found - that's OK
        }
      }
    } catch (error) {
      console.error('Error getting process tree:', error);
    }

    return pids;
  }

  /**
   * Get all listening TCP ports on the system
   */
  private async getListeningPorts(): Promise<LsofPort[]> {
    try {
      // Use lsof to find listening TCP ports
      // -iTCP: only TCP
      // -sTCP:LISTEN: only listening sockets
      // -P: don't resolve port names
      // -n: don't resolve hostnames
      const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -P -n');

      const ports: LsofPort[] = [];
      const lines = stdout.trim().split('\n');

      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(/\s+/);

        if (parts.length < 9) continue;

        const processName = parts[0];
        const pid = parseInt(parts[1], 10);
        const nameField = parts[8]; // e.g., "*:3000", "127.0.0.1:8080", "[::1]:3000"

        if (isNaN(pid)) continue;

        // Parse the name field to get bind address and port
        const match = nameField.match(/^(.+):(\d+)$/);
        if (!match) continue;

        const bindAddress = match[1];
        const port = parseInt(match[2], 10);

        if (isNaN(port) || port < 1024) continue; // Skip system ports

        ports.push({
          port,
          pid,
          processName,
          bindAddress,
        });
      }

      return ports;
    } catch (error) {
      // lsof might not be available or might fail
      console.error('Error running lsof:', error);
      return [];
    }
  }

  /**
   * Check if a bind address is accessible from other machines
   * (i.e., bound to 0.0.0.0, *, or ::)
   */
  private isAccessibleAddress(bindAddress: string): boolean {
    return (
      bindAddress === '*' ||
      bindAddress === '0.0.0.0' ||
      bindAddress === '::' ||
      bindAddress === '[::]'
    );
  }

  /**
   * Detect the service/framework type from the process name
   */
  private detectServiceType(processName: string): ServiceType {
    const name = processName.toLowerCase();

    // Frontend bundlers/dev servers
    if (name.includes('vite')) return 'vite';
    if (name.includes('next') || name.includes('next-server')) return 'nextjs';
    if (name.includes('react-scripts') || name.includes('craco')) return 'cra';
    if (name.includes('webpack')) return 'webpack';
    if (name.includes('parcel')) return 'parcel';
    if (name.includes('esbuild')) return 'esbuild';

    // Python frameworks
    if (name.includes('flask')) return 'flask';
    if (name.includes('django') || name.includes('gunicorn') || name.includes('uvicorn')) return 'django';

    // Ruby
    if (name.includes('rails') || name.includes('puma') || name.includes('unicorn')) return 'rails';

    // Node.js frameworks
    if (name.includes('express')) return 'express';
    if (name.includes('fastify')) return 'fastify';
    if (name.includes('nest')) return 'nest';

    // Java
    if (name.includes('java') || name.includes('spring') || name.includes('tomcat')) return 'spring';

    // Go
    if (name === 'go' || name.includes('gin') || name.includes('fiber')) return 'go';

    // Rust
    if (name.includes('cargo') || name.includes('actix') || name.includes('axum')) return 'rust';

    // PHP
    if (name.includes('php') || name.includes('artisan') || name.includes('laravel')) return 'php';

    // Generic language detections
    if (name.includes('python') || name.includes('python3')) return 'python';
    if (name.includes('ruby')) return 'ruby';
    if (name === 'node' || name.includes('nodejs')) return 'node';

    return 'unknown';
  }

  /**
   * Get the LAN IP address (first non-loopback IPv4 address)
   */
  private async getLanIp(): Promise<string | null> {
    try {
      const { networkInterfaces } = await import('os');
      const interfaces = networkInterfaces();

      for (const name of Object.keys(interfaces)) {
        // Skip virtual interfaces
        if (name.startsWith('lo') || name.startsWith('veth') || name.startsWith('docker')) {
          continue;
        }

        const iface = interfaces[name];
        if (!iface) continue;

        for (const config of iface) {
          // Look for IPv4 addresses that aren't internal (loopback)
          if (config.family === 'IPv4' && !config.internal) {
            return config.address;
          }
        }
      }
    } catch (error) {
      console.error('Error getting LAN IP:', error);
    }

    return null;
  }

  /**
   * Get the Tailscale IP address (cached)
   */
  private async getTailscaleIp(): Promise<string | null> {
    const now = Date.now();

    // Return cached value if still valid
    if (this.cachedTailscaleIp && now - this.tailscaleIpLastChecked < this.TAILSCALE_CACHE_MS) {
      return this.cachedTailscaleIp;
    }

    try {
      const { stdout } = await execAsync('tailscale ip -4');
      const ip = stdout.trim().split('\n')[0];

      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        this.cachedTailscaleIp = ip;
        this.tailscaleIpLastChecked = now;
        return ip;
      }
    } catch {
      // Tailscale not installed or not connected
    }

    this.cachedTailscaleIp = null;
    this.tailscaleIpLastChecked = now;
    return null;
  }

  /**
   * Check if ports have changed
   */
  private portsChanged(oldPorts: DetectedPort[], newPorts: DetectedPort[]): boolean {
    if (oldPorts.length !== newPorts.length) {
      return true;
    }

    const oldSet = new Set(oldPorts.map(p => `${p.port}:${p.bindAddress}`));
    const newSet = new Set(newPorts.map(p => `${p.port}:${p.bindAddress}`));

    for (const item of oldSet) {
      if (!newSet.has(item)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get current ports for an instance (from cache)
   */
  getInstancePorts(instanceId: string): InstancePorts {
    const ports = this.instancePortsCache.get(instanceId) || [];

    return {
      instanceId,
      ports,
      tailscaleIp: this.cachedTailscaleIp,
      lastScannedAt: new Date().toISOString(),
    };
  }

  /**
   * Force a refresh for a specific instance
   */
  async refreshInstance(instanceId: string): Promise<InstancePorts> {
    const ports = await this.detectInstancePorts(instanceId);
    const tailscaleIp = await this.getTailscaleIp();

    this.instancePortsCache.set(instanceId, ports);

    const instancePorts: InstancePorts = {
      instanceId,
      ports,
      tailscaleIp,
      lastScannedAt: new Date().toISOString(),
    };

    broadcast({
      type: 'ports:updated',
      instanceId,
      instancePorts,
    });

    return instancePorts;
  }

  /**
   * Clear cached ports for an instance (e.g., when closed)
   */
  clearInstance(instanceId: string): void {
    this.instancePortsCache.delete(instanceId);
  }

  /**
   * Get network addresses for this server (for mobile access)
   */
  async getNetworkAddresses(): Promise<{ tailscaleIp: string | null; lanIp: string | null }> {
    const [tailscaleIp, lanIp] = await Promise.all([
      this.getTailscaleIp(),
      this.getLanIp(),
    ]);

    return { tailscaleIp, lanIp };
  }
}

export const portDetectionService = new PortDetectionService();
