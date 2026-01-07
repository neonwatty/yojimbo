import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import { hookPriorityService } from './hook-priority.service.js';
import { logStatusChange, logFileActivityCheck } from './status-logger.service.js';
import type { InstanceStatus } from '@cc-orchestrator/shared';

interface LocalInstanceRow {
  id: string;
  name: string;
  working_dir: string;
  status: InstanceStatus;
}

/**
 * Local Status Poller Service
 * Periodically checks Claude Code session files for local instances
 * to determine if they are actively working
 */
class LocalStatusPollerService {
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 15000; // 15 seconds - faster detection
  private readonly ACTIVITY_THRESHOLD_SECONDS = 60; // Consider "working" if activity within 60s

  /**
   * Start the polling service
   */
  start(): void {
    if (this.pollInterval) {
      console.log('⚠️ Local status poller already running');
      return;
    }

    console.log('🔍 Starting local status poller service');

    // Run immediately on start
    this.pollAllLocalInstances().catch(console.error);

    // Then poll at regular intervals
    this.pollInterval = setInterval(() => {
      this.pollAllLocalInstances().catch(console.error);
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Stop the polling service
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('🛑 Stopped local status poller service');
    }
  }

  /**
   * Poll all local instances for status updates
   */
  async pollAllLocalInstances(): Promise<void> {
    const db = getDatabase();

    // Get all open local instances
    const instances = db.prepare(`
      SELECT id, name, working_dir, status
      FROM instances
      WHERE closed_at IS NULL
        AND machine_type = 'local'
    `).all() as LocalInstanceRow[];

    for (const instance of instances) {
      try {
        // Check if a recent hook should take priority over polling
        if (hookPriorityService.shouldDeferToHook(instance.id)) {
          const hookInfo = hookPriorityService.getRecentHook(instance.id);
          logStatusChange({
            instanceId: instance.id,
            instanceName: instance.name,
            oldStatus: instance.status,
            newStatus: instance.status, // No change - deferred to hook
            source: 'local-poll',
            reason: `Deferred to recent ${hookInfo?.hookType} hook (within grace period)`,
            metadata: { deferredToHook: true, hookType: hookInfo?.hookType },
          });
          continue; // Skip this instance - trust the hook
        }

        const { status: newStatus, ageSeconds } = this.checkLocalClaudeStatus(instance.working_dir, instance.name);

        // Log status decision (whether changed or not)
        logStatusChange({
          instanceId: instance.id,
          instanceName: instance.name,
          oldStatus: instance.status,
          newStatus,
          source: 'local-poll',
          reason: ageSeconds !== undefined
            ? `File age: ${ageSeconds.toFixed(1)}s (threshold: ${this.ACTIVITY_THRESHOLD_SECONDS}s)`
            : 'No session files found',
          metadata: { ageSeconds, threshold: this.ACTIVITY_THRESHOLD_SECONDS },
        });

        // Only update if status changed
        if (newStatus !== instance.status) {
          this.updateInstanceStatus(instance.id, instance.name, instance.status, newStatus);
        }
      } catch (error) {
        console.error(`Error checking local status for ${instance.name}:`, error);
      }
    }
  }

  /**
   * Check Claude Code status by examining local session files
   * Returns 'working' if recent activity (within threshold), 'idle' otherwise
   */
  checkLocalClaudeStatus(workingDir: string, instanceName?: string): { status: InstanceStatus; ageSeconds?: number; sessionDir: string } {
    // Expand ~ to home directory
    const expandedDir = workingDir.replace(/^~/, os.homedir());

    // Encode the working directory path like Claude does (replace / with -)
    // Note: Claude keeps the leading dash (e.g., -Users-jeremywatt-Desktop-...)
    const encodedDir = expandedDir.replace(/\//g, '-');

    // Claude session directory
    const sessionDir = path.join(os.homedir(), '.claude', 'projects', encodedDir);

    // Check if session directory exists
    if (!fs.existsSync(sessionDir)) {
      if (instanceName) {
        logFileActivityCheck({
          instanceName,
          sessionDir,
          fileFound: false,
          threshold: this.ACTIVITY_THRESHOLD_SECONDS,
          result: 'idle',
        });
      }
      return { status: 'idle', sessionDir };
    }

    try {
      // Find the most recently modified .jsonl file
      const files = fs.readdirSync(sessionDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
          name: f,
          path: path.join(sessionDir, f),
          mtime: fs.statSync(path.join(sessionDir, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length === 0) {
        if (instanceName) {
          logFileActivityCheck({
            instanceName,
            sessionDir,
            fileFound: false,
            threshold: this.ACTIVITY_THRESHOLD_SECONDS,
            result: 'idle',
          });
        }
        return { status: 'idle', sessionDir };
      }

      const latestFile = files[0];
      const now = Date.now();
      const ageSeconds = (now - latestFile.mtime) / 1000;

      // If file was modified within threshold, consider it working
      const result: InstanceStatus = ageSeconds <= this.ACTIVITY_THRESHOLD_SECONDS ? 'working' : 'idle';

      if (instanceName) {
        logFileActivityCheck({
          instanceName,
          sessionDir,
          fileFound: true,
          ageSeconds,
          threshold: this.ACTIVITY_THRESHOLD_SECONDS,
          result,
        });
      }

      return { status: result, ageSeconds, sessionDir };
    } catch (error) {
      // If we can't read the directory, assume idle
      if (instanceName) {
        logFileActivityCheck({
          instanceName,
          sessionDir,
          fileFound: false,
          threshold: this.ACTIVITY_THRESHOLD_SECONDS,
          result: 'idle',
        });
      }
      return { status: 'idle', sessionDir };
    }
  }

  /**
   * Update instance status in database and broadcast change
   */
  private updateInstanceStatus(instanceId: string, instanceName: string, oldStatus: InstanceStatus, newStatus: InstanceStatus): void {
    const db = getDatabase();

    db.prepare(`
      UPDATE instances
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, instanceId);

    // Broadcast status change via WebSocket
    broadcast({
      type: 'status:changed',
      instanceId,
      status: newStatus,
    });

    // Log is already done in pollAllLocalInstances, this is just the DB update
    console.log(`📊 Local poll: ${instanceName} (${instanceId.slice(0, 8)}) DB updated: ${oldStatus} → ${newStatus}`);
  }
}

export const localStatusPollerService = new LocalStatusPollerService();
