import { Router } from 'express';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import { createActivityEvent } from '../services/feed.service.js';
import { statusTimeoutService } from '../services/status-timeout.service.js';
import { hookPriorityService } from '../services/hook-priority.service.js';
import { logStatusChange, logHookReceived, logInstanceLookup } from '../services/status-logger.service.js';
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

// Helper to find instance by machineId and projectDir (for remote machines)
function findInstanceByMachineAndDir(machineId: string, projectDir: string): InstanceRow | null {
  if (!machineId || !projectDir) return null;
  const db = getDatabase();

  // Log for debugging
  console.log(`[Hook Lookup] Looking for instance: machineId=${machineId}, projectDir=${projectDir}`);

  // First try exact match
  let instance = db
    .prepare('SELECT * FROM instances WHERE machine_id = ? AND working_dir = ? AND closed_at IS NULL')
    .get(machineId, projectDir) as InstanceRow | undefined;

  if (instance) {
    console.log(`[Hook Lookup] Found by exact match: ${instance.name}`);
    return instance;
  }

  // Try matching "~" working_dir to home directory paths
  // If projectDir looks like a home directory (/Users/..., /home/..., or C:\Users\...)
  // and instance working_dir is "~", that's a match
  const isHomeDirPath = /^(\/Users\/|\/home\/|C:\\Users\\)/i.test(projectDir);
  if (isHomeDirPath) {
    instance = db
      .prepare('SELECT * FROM instances WHERE machine_id = ? AND working_dir = ? AND closed_at IS NULL')
      .get(machineId, '~') as InstanceRow | undefined;

    if (instance) {
      console.log(`[Hook Lookup] Found by ~ match (home dir): ${instance.name}`);
      return instance;
    }
  }

  // Try matching ~/subdir to /Users/user/subdir
  // Extract the relative path from projectDir and try matching with ~
  const homeMatch = projectDir.match(/^\/(?:Users|home)\/[^/]+(.*)$/);
  if (homeMatch) {
    const relativePath = homeMatch[1]; // e.g., "" or "/projects/foo"
    const tildeDir = relativePath ? `~${relativePath}` : '~';

    instance = db
      .prepare('SELECT * FROM instances WHERE machine_id = ? AND working_dir = ? AND closed_at IS NULL')
      .get(machineId, tildeDir) as InstanceRow | undefined;

    if (instance) {
      console.log(`[Hook Lookup] Found by tilde path match: ${instance.name} (${tildeDir})`);
      return instance;
    }
  }

  // Try the reverse: if projectDir starts with ~, expand to match full paths
  if (projectDir.startsWith('~')) {
    instance = db
      .prepare(`SELECT * FROM instances WHERE machine_id = ? AND working_dir LIKE ? AND closed_at IS NULL`)
      .get(machineId, `%${projectDir.slice(1)}`) as InstanceRow | undefined;

    if (instance) {
      console.log(`[Hook Lookup] Found by tilde expansion: ${instance.name}`);
      return instance;
    }
  }

  console.log(`[Hook Lookup] No instance found for machineId=${machineId}, projectDir=${projectDir}`);
  return null;
}

// Update instance status
function updateInstanceStatus(instanceId: string, status: InstanceStatus, hookType: string): void {
  const db = getDatabase();

  // Get instance name and previous status
  const instance = db.prepare('SELECT name, status FROM instances WHERE id = ?')
    .get(instanceId) as { name: string; status: string } | undefined;

  if (!instance) return;

  const previousStatus = instance.status as InstanceStatus;

  // Log the status change decision
  logStatusChange({
    instanceId,
    instanceName: instance.name,
    oldStatus: previousStatus,
    newStatus: status,
    source: 'hook',
    reason: `${hookType} hook received`,
  });

  // Record activity for timeout tracking
  statusTimeoutService.recordActivity(instanceId, status);

  // Only update database if status actually changed
  if (previousStatus !== status) {
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

    // Create activity events for significant transitions
    if (status === 'idle' && previousStatus === 'working') {
      createActivityEvent(instanceId, instance.name, 'completed', `${instance.name} finished working`);
    } else if (status === 'error' && previousStatus !== 'error') {
      createActivityEvent(instanceId, instance.name, 'error', `${instance.name} encountered an error`);
    } else if (status === 'working' && previousStatus === 'idle') {
      createActivityEvent(instanceId, instance.name, 'started', `${instance.name} started working`);
    }
  }
}

// POST /api/hooks/status - Receive status updates (working/idle)
router.post('/status', (req, res) => {
  try {
    const { event, projectDir, instanceId, machineId } = req.body as HookStatusEvent & { instanceId?: string; machineId?: string };

    logHookReceived({ hookType: `status:${event}`, projectDir, instanceId, machineId });

    // Try to find instance by instanceId first (local instances with CC_INSTANCE_ID)
    // Then try machineId + projectDir (remote instances via hooks)
    let instance = findInstanceById(instanceId || '');
    let lookupMethod: 'id' | 'directory' | 'machine+dir' | 'none' = instance ? 'id' : 'none';

    if (!instance && machineId && projectDir) {
      instance = findInstanceByMachineAndDir(machineId, projectDir);
      lookupMethod = instance ? 'machine+dir' : 'none';
    }

    logInstanceLookup({
      found: !!instance,
      method: lookupMethod,
      instanceId: instance?.id,
      instanceName: instance?.name,
      projectDir,
    });

    if (instance) {
      const status: InstanceStatus = event === 'working' ? 'working' : 'idle';
      updateInstanceStatus(instance.id, status, `status:${event}`);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error processing status hook:', error);
    res.status(500).json({ ok: false, error: 'Failed to process hook' });
  }
});

// POST /api/hooks/notification - Receive notification events
// Note: We no longer distinguish 'awaiting' status - notifications just confirm activity
router.post('/notification', (req, res) => {
  try {
    const { projectDir, instanceId, machineId } = req.body as HookNotificationEvent & { instanceId?: string; machineId?: string };

    logHookReceived({ hookType: 'notification', projectDir, instanceId, machineId });

    // Try to find instance by instanceId first, then machineId + projectDir
    let instance = findInstanceById(instanceId || '');
    let lookupMethod: 'id' | 'directory' | 'machine+dir' | 'none' = instance ? 'id' : 'none';

    if (!instance && machineId && projectDir) {
      instance = findInstanceByMachineAndDir(machineId, projectDir);
      lookupMethod = instance ? 'machine+dir' : 'none';
    }

    logInstanceLookup({
      found: !!instance,
      method: lookupMethod,
      instanceId: instance?.id,
      instanceName: instance?.name,
      projectDir,
    });

    if (instance) {
      // Record this hook to prevent local polling from overriding
      hookPriorityService.recordHook(instance.id, 'notification');
      // Notification events now set to idle (Claude is done working, waiting for user)
      updateInstanceStatus(instance.id, 'idle', 'notification');
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
    const { projectDir, instanceId, machineId } = req.body as HookStopEvent & { instanceId?: string; machineId?: string };

    logHookReceived({ hookType: 'stop', projectDir, instanceId, machineId });

    // Try to find instance by instanceId first, then machineId + projectDir
    let instance = findInstanceById(instanceId || '');
    let lookupMethod: 'id' | 'directory' | 'machine+dir' | 'none' = instance ? 'id' : 'none';

    if (!instance && machineId && projectDir) {
      instance = findInstanceByMachineAndDir(machineId, projectDir);
      lookupMethod = instance ? 'machine+dir' : 'none';
    }

    logInstanceLookup({
      found: !!instance,
      method: lookupMethod,
      instanceId: instance?.id,
      instanceName: instance?.name,
      projectDir,
    });

    if (instance) {
      // Record this hook to prevent local polling from overriding
      hookPriorityService.recordHook(instance.id, 'stop');
      updateInstanceStatus(instance.id, 'idle', 'stop');
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error processing stop hook:', error);
    res.status(500).json({ ok: false, error: 'Failed to process hook' });
  }
});

export default router;
