/**
 * Debug Routes
 *
 * COMMENTED OUT: These debug endpoints are not currently being used.
 *
 * Original purpose: Provided debug endpoints for troubleshooting status detection:
 * - GET /api/debug/status/:instanceId - Detailed status debug info for an instance
 * - GET /api/debug/status-by-path - Status debug info by working directory path
 * - GET /api/debug/all-instances-status - Status debug info for all local instances
 */

import { Router } from 'express';
// import { getDatabase } from '../db/connection.js';
// import { localStatusPollerService } from '../services/local-status-poller.service.js';
// import { hookPriorityService } from '../services/hook-priority.service.js';
// import { terminalActivityService } from '../services/terminal-activity.service.js';
// import type { InstanceStatus, MachineType } from '@cc-orchestrator/shared';

const router = Router();

// interface InstanceRow {
//   id: string;
//   name: string;
//   working_dir: string;
//   status: InstanceStatus;
//   machine_type: MachineType;
// }

// // GET /api/debug/status/:instanceId - Get detailed status debug info for an instance
// router.get('/status/:instanceId', (req, res) => {
//   try {
//     const db = getDatabase();
//     const { instanceId } = req.params;

//     const instance = db.prepare(`
//       SELECT id, name, working_dir, status, machine_type
//       FROM instances
//       WHERE id = ? AND closed_at IS NULL
//     `).get(instanceId) as InstanceRow | undefined;

//     if (!instance) {
//       return res.status(404).json({ success: false, error: 'Instance not found' });
//     }

//     // Only local instances have file-based status detection
//     if (instance.machine_type !== 'local') {
//       return res.json({
//         success: true,
//         data: {
//           instance: {
//             id: instance.id,
//             name: instance.name,
//             workingDir: instance.working_dir,
//             currentStatus: instance.status,
//             machineType: instance.machine_type,
//           },
//           message: 'Status detection via file polling only applies to local instances',
//         },
//       });
//     }

//     // Get file-based status detection info
//     const debugInfo = localStatusPollerService.getDebugInfo(instance.working_dir);

//     // Get hook priority info
//     const hookInfo = hookPriorityService.getRecentHook(instance.id);
//     const deferToHook = hookPriorityService.shouldDeferToHook(instance.id);

//     // Get terminal activity info
//     const lastActivity = terminalActivityService.getLastActivity(instance.id);
//     const hasRecentActivity = terminalActivityService.hasRecentActivity(instance.id);

//     res.json({
//       success: true,
//       data: {
//         instance: {
//           id: instance.id,
//           name: instance.name,
//           workingDir: instance.working_dir,
//           currentStatus: instance.status,
//           machineType: instance.machine_type,
//         },
//         fileBasedStatus: {
//           ...debugInfo,
//           detectedStatus: debugInfo.status,
//           explanation: debugInfo.ageSeconds !== undefined
//             ? `Latest file is ${debugInfo.ageSeconds.toFixed(1)}s old (threshold: ${debugInfo.threshold}s) → ${debugInfo.status}`
//             : 'No session files found → idle',
//         },
//         terminalActivity: {
//           lastActivityAt: lastActivity ? new Date(lastActivity).toISOString() : null,
//           lastActivityAgeMs: lastActivity ? Date.now() - lastActivity : null,
//           hasRecentActivity,
//           explanation: hasRecentActivity
//             ? 'Terminal output received recently, status should be working'
//             : lastActivity
//               ? 'Terminal went idle (no recent output)'
//               : 'No terminal activity recorded',
//         },
//         hookPriority: {
//           deferToHook,
//           recentHook: hookInfo,
//           explanation: deferToHook
//             ? `Recent ${hookInfo?.hookType} hook takes priority over file polling`
//             : 'No recent hook activity',
//         },
//       },
//     });
//   } catch (error) {
//     console.error('Error getting status debug info:', error);
//     res.status(500).json({ success: false, error: 'Failed to get status debug info' });
//   }
// });

// // GET /api/debug/status-by-path - Get status debug info by working directory path
// router.get('/status-by-path', (req, res) => {
//   try {
//     const { path: workingDir } = req.query;

//     if (!workingDir || typeof workingDir !== 'string') {
//       return res.status(400).json({
//         success: false,
//         error: 'path query parameter is required',
//       });
//     }

//     const debugInfo = localStatusPollerService.getDebugInfo(workingDir);

//     res.json({
//       success: true,
//       data: {
//         ...debugInfo,
//         explanation: debugInfo.ageSeconds !== undefined
//           ? `Latest file is ${debugInfo.ageSeconds.toFixed(1)}s old (threshold: ${debugInfo.threshold}s) → ${debugInfo.status}`
//           : debugInfo.sessionDirExists
//             ? 'No .jsonl files found in session directory → idle'
//             : 'Session directory does not exist → idle',
//       },
//     });
//   } catch (error) {
//     console.error('Error getting status debug info:', error);
//     res.status(500).json({ success: false, error: 'Failed to get status debug info' });
//   }
// });

// // GET /api/debug/all-instances-status - Get status debug info for all local instances
// router.get('/all-instances-status', (_req, res) => {
//   try {
//     const db = getDatabase();

//     const instances = db.prepare(`
//       SELECT id, name, working_dir, status, machine_type
//       FROM instances
//       WHERE closed_at IS NULL AND machine_type = 'local'
//     `).all() as InstanceRow[];

//     const results = instances.map(instance => {
//       const debugInfo = localStatusPollerService.getDebugInfo(instance.working_dir);
//       const hookInfo = hookPriorityService.getRecentHook(instance.id);
//       const deferToHook = hookPriorityService.shouldDeferToHook(instance.id);
//       const lastActivity = terminalActivityService.getLastActivity(instance.id);
//       const hasRecentActivity = terminalActivityService.hasRecentActivity(instance.id);

//       return {
//         instance: {
//           id: instance.id,
//           name: instance.name,
//           workingDir: instance.working_dir,
//           currentStatus: instance.status,
//         },
//         fileBasedStatus: {
//           sessionDir: debugInfo.sessionDir,
//           sessionDirExists: debugInfo.sessionDirExists,
//           fileCount: debugInfo.files.length,
//           latestFileAge: debugInfo.ageSeconds?.toFixed(1),
//           detectedStatus: debugInfo.status,
//         },
//         terminalActivity: {
//           lastActivityAgeMs: lastActivity ? Date.now() - lastActivity : null,
//           hasRecentActivity,
//         },
//         hookPriority: {
//           deferToHook,
//           recentHookType: hookInfo?.hookType,
//         },
//         // Status should match if terminal activity aligns with database status
//         statusMatch: hasRecentActivity
//           ? instance.status === 'working'
//           : deferToHook
//             ? (hookInfo?.hookType === 'stop' && instance.status === 'idle') ||
//               (hookInfo?.hookType === 'notification' && instance.status === 'working')
//             : instance.status === 'idle',
//       };
//     });

//     res.json({
//       success: true,
//       data: {
//         instances: results,
//         summary: {
//           total: results.length,
//           matching: results.filter(r => r.statusMatch).length,
//           mismatched: results.filter(r => !r.statusMatch).length,
//         },
//       },
//     });
//   } catch (error) {
//     console.error('Error getting all instances status:', error);
//     res.status(500).json({ success: false, error: 'Failed to get all instances status' });
//   }
// });

export default router;
