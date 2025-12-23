import { Router } from 'express';
import os from 'os';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import type { HookStatusEvent, HookNotificationEvent, HookStopEvent, InstanceStatus } from '@cc-orchestrator/shared';

const router = Router();

// Helper to find instance by working directory
function findInstanceByWorkingDir(projectDir: string): any | null {
  const db = getDatabase();

  // Normalize the path (expand ~ and resolve)
  const normalizedDir = projectDir.replace(/^~/, os.homedir());

  // Try exact match first
  let instance = db
    .prepare('SELECT * FROM instances WHERE working_dir = ? AND closed_at IS NULL')
    .get(normalizedDir);

  if (instance) return instance;

  // Try with ~ prefix
  const withTilde = projectDir.startsWith(os.homedir())
    ? projectDir.replace(os.homedir(), '~')
    : projectDir;

  instance = db
    .prepare('SELECT * FROM instances WHERE working_dir = ? AND closed_at IS NULL')
    .get(withTilde);

  if (instance) return instance;

  // Try partial match (project dir might be a subdirectory)
  instance = db
    .prepare(`
      SELECT * FROM instances
      WHERE closed_at IS NULL
      AND (? LIKE working_dir || '%' OR working_dir LIKE ? || '%')
      ORDER BY LENGTH(working_dir) DESC
      LIMIT 1
    `)
    .get(normalizedDir, normalizedDir);

  return instance || null;
}

// Update instance status
function updateInstanceStatus(instanceId: string, status: InstanceStatus): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE instances
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, instanceId);

  // Broadcast status change
  broadcast({
    type: 'status:changed',
    instanceId,
    status,
  });

  console.log(`📊 Instance ${instanceId} status changed to: ${status}`);
}

// POST /api/hooks/status - Receive status updates (working/idle)
router.post('/status', (req, res) => {
  try {
    const { event, projectDir } = req.body as HookStatusEvent;

    console.log(`🔔 Hook status event: ${event} for ${projectDir}`);

    const instance = findInstanceByWorkingDir(projectDir);

    if (instance) {
      const status: InstanceStatus = event === 'working' ? 'working' : 'idle';
      updateInstanceStatus(instance.id, status);
    } else {
      console.log(`⚠️ No instance found for: ${projectDir}`);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error processing status hook:', error);
    res.status(500).json({ ok: false, error: 'Failed to process hook' });
  }
});

// POST /api/hooks/notification - Receive notification events (awaiting input)
router.post('/notification', (req, res) => {
  try {
    const { projectDir } = req.body as HookNotificationEvent;

    console.log(`🔔 Hook notification event for ${projectDir}`);

    const instance = findInstanceByWorkingDir(projectDir);

    if (instance) {
      updateInstanceStatus(instance.id, 'awaiting');
    } else {
      console.log(`⚠️ No instance found for: ${projectDir}`);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error processing notification hook:', error);
    res.status(500).json({ ok: false, error: 'Failed to process hook' });
  }
});

// POST /api/hooks/stop - Receive stop events
router.post('/stop', (req, res) => {
  try {
    const { projectDir } = req.body as HookStopEvent;

    console.log(`🔔 Hook stop event for ${projectDir}`);

    const instance = findInstanceByWorkingDir(projectDir);

    if (instance) {
      updateInstanceStatus(instance.id, 'idle');
    } else {
      console.log(`⚠️ No instance found for: ${projectDir}`);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error processing stop hook:', error);
    res.status(500).json({ ok: false, error: 'Failed to process hook' });
  }
});

export default router;
