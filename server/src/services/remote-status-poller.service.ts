import { getDatabase } from '../db/connection.js';
import { sshConnectionService } from './ssh-connection.service.js';
import { broadcast } from '../websocket/server.js';
import { createActivityEvent } from './feed.service.js';
import type { InstanceStatus } from '@cc-orchestrator/shared';

interface RemoteInstanceRow {
  id: string;
  name: string;
  working_dir: string;
  machine_id: string;
  status: InstanceStatus;
}

// Polling interval in milliseconds (10 seconds for remote status checks)
const POLL_INTERVAL = 10000;

/**
 * Remote Status Poller Service
 * Periodically checks Claude Code status on remote machines via SSH
 */
class RemoteStatusPollerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;

  /**
   * Start polling for remote instance status
   */
  start(): void {
    if (this.intervalId) {
      return; // Already running
    }

    console.log('🔄 Remote status poller started');

    // Run immediately, then on interval
    this.pollAll();
    this.intervalId = setInterval(() => this.pollAll(), POLL_INTERVAL);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🔄 Remote status poller stopped');
    }
  }

  /**
   * Poll all remote instances
   */
  private async pollAll(): Promise<void> {
    if (this.isPolling) {
      return; // Skip if previous poll is still running
    }

    this.isPolling = true;

    try {
      const db = getDatabase();

      // Get all open remote instances
      const instances = db
        .prepare(`
          SELECT id, name, working_dir, machine_id, status
          FROM instances
          WHERE machine_type = 'remote'
            AND machine_id IS NOT NULL
            AND closed_at IS NULL
        `)
        .all() as RemoteInstanceRow[];

      for (const instance of instances) {
        await this.pollInstance(instance);
      }
    } catch (error) {
      console.error('Error polling remote instances:', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Poll a single remote instance
   */
  private async pollInstance(instance: RemoteInstanceRow): Promise<void> {
    try {
      const result = await sshConnectionService.checkRemoteClaudeStatus(
        instance.machine_id,
        instance.working_dir
      );

      if (result.error) {
        // Connection error - don't change status, just log
        console.warn(`⚠️ Could not check status for ${instance.name}: ${result.error}`);
        return;
      }

      const newStatus = result.status;
      const oldStatus = instance.status;

      // Only update if status changed
      if (newStatus !== oldStatus) {
        this.updateInstanceStatus(instance.id, instance.name, oldStatus, newStatus);
      }
    } catch (error) {
      console.error(`Error polling instance ${instance.name}:`, error);
    }
  }

  /**
   * Update instance status in database and broadcast
   */
  private updateInstanceStatus(
    instanceId: string,
    instanceName: string,
    oldStatus: InstanceStatus,
    newStatus: InstanceStatus
  ): void {
    const db = getDatabase();

    // Update database
    db.prepare(`
      UPDATE instances
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, instanceId);

    // Broadcast status change
    broadcast({
      type: 'status:changed',
      instanceId,
      status: newStatus,
    });

    console.log(`📊 Remote instance ${instanceId} status changed: ${oldStatus} → ${newStatus}`);

    // Create activity events for significant transitions
    if (newStatus === 'idle' && oldStatus === 'working') {
      createActivityEvent(instanceId, instanceName, 'completed', `${instanceName} finished working`);
    } else if (newStatus === 'working' && oldStatus === 'idle') {
      createActivityEvent(instanceId, instanceName, 'started', `${instanceName} started working`);
    }
  }
}

export const remoteStatusPollerService = new RemoteStatusPollerService();
