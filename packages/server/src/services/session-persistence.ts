import { getDb } from '../db/index.js';
import { getTerminalManager } from './terminal-manager.js';
import type { InstanceStatus } from '@cc-orchestrator/shared';

interface StoredInstance {
  id: string;
  name: string;
  working_dir: string;
  status: InstanceStatus;
  pinned: number;
  created_at: string;
  last_activity_at: string | null;
}

/**
 * Save current session state to database
 * Called during graceful shutdown
 */
export function saveSessionState(): void {
  const db = getDb();
  const terminalManager = getTerminalManager();

  // Update last_activity_at for all active terminals
  const activeTerminals = terminalManager.list();

  for (const id of activeTerminals) {
    db.prepare(
      `UPDATE instances SET last_activity_at = datetime('now') WHERE id = ?`
    ).run(id);
  }

  console.log(`Session state saved: ${activeTerminals.length} active terminals`);
}

/**
 * Restore session by spawning terminals for existing instances
 * Called during server startup
 */
export function restoreSession(): { restored: number; failed: number } {
  const db = getDb();
  const terminalManager = getTerminalManager();

  // Get all instances from database
  const instances = db
    .prepare(
      `SELECT id, name, working_dir, status, pinned, created_at, last_activity_at
       FROM instances`
    )
    .all() as StoredInstance[];

  let restored = 0;
  let failed = 0;

  for (const instance of instances) {
    try {
      // Check if terminal already exists (shouldn't, but be safe)
      if (terminalManager.has(instance.id)) {
        console.log(`Terminal ${instance.id} already exists, skipping`);
        continue;
      }

      // Spawn terminal for this instance
      terminalManager.spawn({
        id: instance.id,
        workingDir: instance.working_dir,
      });

      // Update status to idle (terminal restored but not active)
      db.prepare(
        `UPDATE instances SET status = 'idle', last_activity_at = datetime('now') WHERE id = ?`
      ).run(instance.id);

      restored++;
      console.log(`Restored terminal for instance: ${instance.name} (${instance.id})`);
    } catch (error) {
      failed++;
      console.error(`Failed to restore instance ${instance.id}:`, error);

      // Mark instance as error in database
      db.prepare(
        `UPDATE instances SET status = 'error' WHERE id = ?`
      ).run(instance.id);
    }
  }

  return { restored, failed };
}

/**
 * Clear all instances (fresh start)
 */
export function clearSession(): void {
  const db = getDb();
  const terminalManager = getTerminalManager();

  // Kill all terminals
  terminalManager.killAll();

  // Clear database
  db.prepare('DELETE FROM status_events').run();
  db.prepare('DELETE FROM instances').run();

  console.log('Session cleared');
}

/**
 * Export current session as JSON (for manual save)
 */
export function exportSession(): {
  instances: Array<{
    id: string;
    name: string;
    workingDir: string;
    status: InstanceStatus;
    pinned: boolean;
  }>;
  exportedAt: string;
} {
  const db = getDb();

  const instances = db
    .prepare(
      `SELECT id, name, working_dir, status, pinned FROM instances`
    )
    .all() as StoredInstance[];

  return {
    instances: instances.map((i) => ({
      id: i.id,
      name: i.name,
      workingDir: i.working_dir,
      status: i.status,
      pinned: Boolean(i.pinned),
    })),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Get session statistics
 */
export function getSessionStats(): {
  totalInstances: number;
  activeTerminals: number;
  byStatus: Record<InstanceStatus, number>;
} {
  const db = getDb();
  const terminalManager = getTerminalManager();

  const counts = db
    .prepare(
      `SELECT status, COUNT(*) as count FROM instances GROUP BY status`
    )
    .all() as Array<{ status: InstanceStatus; count: number }>;

  const byStatus: Record<InstanceStatus, number> = {
    working: 0,
    awaiting: 0,
    idle: 0,
    error: 0,
  };

  for (const row of counts) {
    byStatus[row.status] = row.count;
  }

  return {
    totalInstances: Object.values(byStatus).reduce((a, b) => a + b, 0),
    activeTerminals: terminalManager.list().length,
    byStatus,
  };
}
