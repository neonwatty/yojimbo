import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import { createActivityEvent } from './feed.service.js';
import { localStatusPollerService } from './local-status-poller.service.js';
import type { InstanceStatus } from '@cc-orchestrator/shared';

// Timeout for resetting status to idle (60 seconds)
// Extended from 30s to handle compacting, long thinking, and inter-tool gaps
const ACTIVITY_TIMEOUT_MS = 60000;

// Check interval (10 seconds)
const CHECK_INTERVAL_MS = 10000;

interface InstanceActivity {
  lastActivityAt: number;
  status: InstanceStatus;
}

/**
 * Status Timeout Service
 * Tracks instance activity and resets status to 'idle' after inactivity timeout.
 * This handles the case where Claude Code stops working but doesn't send an idle event.
 */
class StatusTimeoutService {
  private activityMap = new Map<string, InstanceActivity>();
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Start the timeout checker
   */
  start(): void {
    if (this.intervalId) return;

    console.log('⏱️ Status timeout service started');
    this.intervalId = setInterval(() => this.checkTimeouts(), CHECK_INTERVAL_MS);
  }

  /**
   * Stop the timeout checker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏱️ Status timeout service stopped');
    }
  }

  /**
   * Record activity for an instance (called when hooks receive events)
   */
  recordActivity(instanceId: string, status: InstanceStatus): void {
    this.activityMap.set(instanceId, {
      lastActivityAt: Date.now(),
      status,
    });
  }

  /**
   * Remove tracking for an instance (called when instance is closed)
   */
  removeInstance(instanceId: string): void {
    this.activityMap.delete(instanceId);
  }

  /**
   * Check all tracked instances for timeout
   */
  private checkTimeouts(): void {
    const now = Date.now();
    const db = getDatabase();

    for (const [instanceId, activity] of this.activityMap.entries()) {
      // Only check instances that are currently working
      if (activity.status !== 'working') continue;

      const timeSinceActivity = now - activity.lastActivityAt;

      if (timeSinceActivity >= ACTIVITY_TIMEOUT_MS) {
        // Reset to idle
        this.resetToIdle(instanceId, db);
      }
    }
  }

  /**
   * Reset an instance status to idle
   */
  private resetToIdle(instanceId: string, db: ReturnType<typeof getDatabase>): void {
    // Get instance info (include working_dir and machine_id for file-based activity check)
    const instance = db
      .prepare('SELECT id, name, status, working_dir, machine_id FROM instances WHERE id = ? AND closed_at IS NULL')
      .get(instanceId) as { id: string; name: string; status: InstanceStatus; working_dir: string; machine_id: string | null } | undefined;

    if (!instance || instance.status !== 'working') {
      // Instance doesn't exist, is closed, or already not working
      this.activityMap.delete(instanceId);
      return;
    }

    // For local instances: check file activity before resetting
    // This handles the case where Claude is "thinking" without using tools
    if (!instance.machine_id) {
      const fileStatus = localStatusPollerService.checkLocalClaudeStatus(instance.working_dir);
      if (fileStatus === 'working') {
        // File activity detected - extend timeout instead of resetting
        console.log(`⏱️ Instance ${instanceId} has file activity, extending timeout`);
        this.activityMap.set(instanceId, {
          lastActivityAt: Date.now(),
          status: 'working',
        });
        return;
      }
    }

    // Update database
    db.prepare(`
      UPDATE instances
      SET status = 'idle', updated_at = datetime('now')
      WHERE id = ?
    `).run(instanceId);

    // Update tracking
    this.activityMap.set(instanceId, {
      lastActivityAt: Date.now(),
      status: 'idle',
    });

    // Broadcast status change
    broadcast({
      type: 'status:changed',
      instanceId,
      status: 'idle',
    });

    console.log(`⏱️ Instance ${instanceId} timed out, reset to idle`);

    // Create activity event
    createActivityEvent(instanceId, instance.name, 'completed', `${instance.name} finished working`);
  }
}

export const statusTimeoutService = new StatusTimeoutService();
