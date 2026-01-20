/**
 * Terminal Activity Service
 *
 * Tracks terminal activity via WebSocket to detect when instances are actively
 * receiving output. This is more accurate than file polling because it only
 * tracks activity from Yojimbo-managed terminals (not external Claude sessions).
 *
 * Flow:
 * 1. WebSocket server calls recordActivity() when terminal output is received
 * 2. This service updates the instance status to 'working' if it was 'idle'
 * 3. A timeout resets the status back to 'idle' after a period of inactivity
 */

import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import { hookPriorityService } from './hook-priority.service.js';
import type { InstanceStatus } from '@cc-orchestrator/shared';

interface ActivityRecord {
  lastActivityAt: number;
  timeoutHandle: NodeJS.Timeout | null;
}

class TerminalActivityService {
  // Map of instanceId -> activity record
  private activityMap = new Map<string, ActivityRecord>();

  // How long to wait before resetting to idle (ms)
  private readonly IDLE_TIMEOUT_MS = 30000; // 30 seconds

  // Minimum interval between status updates to avoid thrashing (ms)
  private readonly DEBOUNCE_MS = 1000; // 1 second

  /**
   * Record terminal activity for an instance.
   * Called by WebSocket server when terminal output is received.
   */
  recordActivity(instanceId: string): void {
    const now = Date.now();
    const existing = this.activityMap.get(instanceId);

    // Debounce: don't update if we just updated
    if (existing && now - existing.lastActivityAt < this.DEBOUNCE_MS) {
      // Still reset the timeout
      this.resetIdleTimeout(instanceId);
      return;
    }

    // Update activity timestamp
    if (existing) {
      existing.lastActivityAt = now;
    } else {
      this.activityMap.set(instanceId, {
        lastActivityAt: now,
        timeoutHandle: null,
      });
    }

    // Update status to working if currently idle
    this.updateStatusToWorking(instanceId);

    // Reset the idle timeout
    this.resetIdleTimeout(instanceId);
  }

  /**
   * Get the last activity timestamp for an instance
   */
  getLastActivity(instanceId: string): number | null {
    return this.activityMap.get(instanceId)?.lastActivityAt ?? null;
  }

  /**
   * Check if an instance has recent activity
   */
  hasRecentActivity(instanceId: string, thresholdMs: number = this.IDLE_TIMEOUT_MS): boolean {
    const record = this.activityMap.get(instanceId);
    if (!record) return false;
    return Date.now() - record.lastActivityAt < thresholdMs;
  }

  /**
   * Clear activity tracking for an instance (e.g., when closed)
   */
  clearInstance(instanceId: string): void {
    const record = this.activityMap.get(instanceId);
    if (record?.timeoutHandle) {
      clearTimeout(record.timeoutHandle);
    }
    this.activityMap.delete(instanceId);
  }

  /**
   * Update instance status to 'working' if it's currently 'idle'
   */
  private updateStatusToWorking(instanceId: string): void {
    // Check if hooks should take priority
    if (hookPriorityService.shouldDeferToHook(instanceId)) {
      return;
    }

    const db = getDatabase();

    // Get current status
    const row = db.prepare(`
      SELECT status FROM instances
      WHERE id = ? AND closed_at IS NULL
    `).get(instanceId) as { status: InstanceStatus } | undefined;

    if (!row) return;

    // Only update if currently idle
    if (row.status === 'idle') {
      db.prepare(`
        UPDATE instances
        SET status = 'working', updated_at = datetime('now')
        WHERE id = ?
      `).run(instanceId);

      // Broadcast status change
      broadcast({
        type: 'status:changed',
        instanceId,
        status: 'working',
      });

      console.log(`📊 Terminal activity: ${instanceId.slice(0, 8)} idle → working`);
    }
  }

  /**
   * Reset the idle timeout for an instance
   */
  private resetIdleTimeout(instanceId: string): void {
    const record = this.activityMap.get(instanceId);
    if (!record) return;

    // Clear existing timeout
    if (record.timeoutHandle) {
      clearTimeout(record.timeoutHandle);
    }

    // Set new timeout to reset to idle
    record.timeoutHandle = setTimeout(() => {
      this.resetToIdle(instanceId);
    }, this.IDLE_TIMEOUT_MS);
  }

  /**
   * Reset instance status to 'idle' after timeout
   */
  private resetToIdle(instanceId: string): void {
    // Check if hooks should take priority
    if (hookPriorityService.shouldDeferToHook(instanceId)) {
      return;
    }

    const db = getDatabase();

    // Get current status
    const row = db.prepare(`
      SELECT status FROM instances
      WHERE id = ? AND closed_at IS NULL
    `).get(instanceId) as { status: InstanceStatus } | undefined;

    if (!row) {
      this.activityMap.delete(instanceId);
      return;
    }

    // Only reset if currently working
    if (row.status === 'working') {
      db.prepare(`
        UPDATE instances
        SET status = 'idle', updated_at = datetime('now')
        WHERE id = ?
      `).run(instanceId);

      // Broadcast status change
      broadcast({
        type: 'status:changed',
        instanceId,
        status: 'idle',
      });

      console.log(`📊 Terminal activity timeout: ${instanceId.slice(0, 8)} working → idle`);
    }
  }
}

export const terminalActivityService = new TerminalActivityService();
