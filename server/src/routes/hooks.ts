import { Router } from 'express';
import os from 'os';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import { createActivityEvent } from '../services/feed.service.js';
import type { HookStatusEvent, HookNotificationEvent, HookStopEvent, InstanceStatus } from '@cc-orchestrator/shared';

const router = Router();

// Database row type for instances (subset needed by hooks)
interface InstanceRow {
  id: string;
  name: string;
  working_dir: string;
  status: InstanceStatus;
}

// Helper to find instance by ID
function findInstanceById(instanceId: string): InstanceRow | null {
  if (!instanceId) return null;
  const db = getDatabase();
  return (db
    .prepare('SELECT * FROM instances WHERE id = ? AND closed_at IS NULL')
    .get(instanceId) as InstanceRow | undefined) || null;
}

// Helper to find instance by working directory (fallback)
function findInstanceByWorkingDir(projectDir: string): InstanceRow | null {
  const db = getDatabase();

  // Normalize the path (expand ~ and resolve)
  const normalizedDir = projectDir.replace(/^~/, os.homedir());

  // Try exact match first
  let instance = db
    .prepare('SELECT * FROM instances WHERE working_dir = ? AND closed_at IS NULL')
    .get(normalizedDir) as InstanceRow | undefined;

  if (instance) return instance;

  // Try with ~ prefix
  const withTilde = projectDir.startsWith(os.homedir())
    ? projectDir.replace(os.homedir(), '~')
    : projectDir;

  instance = db
    .prepare('SELECT * FROM instances WHERE working_dir = ? AND closed_at IS NULL')
    .get(withTilde) as InstanceRow | undefined;

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
    .get(normalizedDir, normalizedDir) as InstanceRow | undefined;

  return instance || null;
}

// Update instance status
function updateInstanceStatus(instanceId: string, status: InstanceStatus): void {
  const db = getDatabase();

  // Get instance name and previous status
  const instance = db.prepare('SELECT name, status FROM instances WHERE id = ?')
    .get(instanceId) as { name: string; status: string } | undefined;

  if (!instance) return;

  const previousStatus = instance.status;

  // Update database
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

  // Create activity events for significant transitions
  if (status === 'idle' && previousStatus === 'working') {
    createActivityEvent(instanceId, instance.name, 'completed', `${instance.name} finished working`);
  } else if (status === 'awaiting' && previousStatus !== 'awaiting') {
    createActivityEvent(instanceId, instance.name, 'awaiting', `${instance.name} needs attention`);
  } else if (status === 'error' && previousStatus !== 'error') {
    createActivityEvent(instanceId, instance.name, 'error', `${instance.name} encountered an error`);
  } else if (status === 'working' && previousStatus === 'idle') {
    createActivityEvent(instanceId, instance.name, 'started', `${instance.name} started working`);
  }
}

// POST /api/hooks/status - Receive status updates (working/idle)
router.post('/status', (req, res) => {
  try {
    const { event, projectDir, instanceId } = req.body as HookStatusEvent & { instanceId?: string };

    console.log(`🔔 Hook status event: ${event} for ${projectDir} (instanceId: ${instanceId || 'none'})`);

    // Prefer matching by instanceId (more reliable)
    let instance = findInstanceById(instanceId || '');

    // Only fall back to directory matching if no instanceId was provided
    if (!instance && !instanceId) {
      instance = findInstanceByWorkingDir(projectDir);
      if (instance) {
        console.log(`📍 Matched by directory: ${projectDir} -> ${instance.id}`);
      }
    }

    if (instance) {
      const status: InstanceStatus = event === 'working' ? 'working' : 'idle';
      updateInstanceStatus(instance.id, status);
    } else if (instanceId) {
      console.log(`⚠️ No instance found with ID: ${instanceId}`);
    } else {
      console.log(`⚠️ No instance found for directory: ${projectDir}`);
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
    const { projectDir, instanceId } = req.body as HookNotificationEvent & { instanceId?: string };

    console.log(`🔔 Hook notification event for ${projectDir} (instanceId: ${instanceId || 'none'})`);

    // Prefer matching by instanceId (more reliable)
    let instance = findInstanceById(instanceId || '');

    // Only fall back to directory matching if no instanceId was provided
    if (!instance && !instanceId) {
      instance = findInstanceByWorkingDir(projectDir);
      if (instance) {
        console.log(`📍 Matched by directory: ${projectDir} -> ${instance.id}`);
      }
    }

    if (instance) {
      updateInstanceStatus(instance.id, 'awaiting');
    } else if (instanceId) {
      console.log(`⚠️ No instance found with ID: ${instanceId}`);
    } else {
      console.log(`⚠️ No instance found for directory: ${projectDir}`);
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
    const { projectDir, instanceId } = req.body as HookStopEvent & { instanceId?: string };

    console.log(`🔔 Hook stop event for ${projectDir} (instanceId: ${instanceId || 'none'})`);

    // Prefer matching by instanceId (more reliable)
    let instance = findInstanceById(instanceId || '');

    // Only fall back to directory matching if no instanceId was provided
    if (!instance && !instanceId) {
      instance = findInstanceByWorkingDir(projectDir);
      if (instance) {
        console.log(`📍 Matched by directory: ${projectDir} -> ${instance.id}`);
      }
    }

    if (instance) {
      updateInstanceStatus(instance.id, 'idle');
    } else if (instanceId) {
      console.log(`⚠️ No instance found with ID: ${instanceId}`);
    } else {
      console.log(`⚠️ No instance found for directory: ${projectDir}`);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error processing stop hook:', error);
    res.status(500).json({ ok: false, error: 'Failed to process hook' });
  }
});

export default router;
