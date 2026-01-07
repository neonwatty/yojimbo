/**
 * Status Logger Service
 * Centralized logging for all status detection mechanisms.
 * Helps diagnose conflicts between hooks, polling, and timeouts.
 * Broadcasts logs via WebSocket for real-time test monitoring.
 */

import { broadcast } from '../websocket/server.js';

export type StatusSource = 'hook' | 'local-poll' | 'remote-poll' | 'timeout';

export type StatusLogType = 'status-change' | 'hook-received' | 'instance-lookup' | 'file-check' | 'timeout-check';

export interface StatusLogParams {
  instanceId: string;
  instanceName: string;
  oldStatus: string;
  newStatus: string;
  source: StatusSource;
  reason: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a status change event with source and reason
 */
export function logStatusChange(params: StatusLogParams): void {
  const { instanceId, instanceName, oldStatus, newStatus, source, reason, metadata } = params;

  const changed = oldStatus !== newStatus;
  const symbol = changed ? '→' : '=';
  const prefix = changed ? '📊 STATUS CHANGE' : '📊 STATUS CHECK';

  const metaStr = metadata ? ` | ${JSON.stringify(metadata)}` : '';

  console.log(
    `${prefix} [${source}] ${instanceName} (${instanceId.slice(0, 8)}): ${oldStatus} ${symbol} ${newStatus} | ${reason}${metaStr}`
  );

  // Broadcast for real-time test monitoring
  broadcast({
    type: 'log:status',
    logType: 'status-change' as StatusLogType,
    timestamp: Date.now(),
    instanceId,
    instanceName,
    oldStatus,
    newStatus,
    changed,
    source,
    reason,
    metadata,
  });
}

/**
 * Log when a hook event is received (before processing)
 */
export function logHookReceived(params: {
  hookType: string;
  projectDir: string;
  instanceId?: string;
  machineId?: string;
}): void {
  const { hookType, projectDir, instanceId, machineId } = params;
  console.log(
    `🔔 HOOK RECEIVED [${hookType}] dir=${projectDir} | instanceId=${instanceId || 'none'} machineId=${machineId || 'local'}`
  );

  // Broadcast for real-time test monitoring
  broadcast({
    type: 'log:status',
    logType: 'hook-received' as StatusLogType,
    timestamp: Date.now(),
    hookType,
    projectDir,
    instanceId,
    machineId,
  });
}

/**
 * Log instance lookup result
 */
export function logInstanceLookup(params: {
  found: boolean;
  method: 'id' | 'directory' | 'none';
  instanceId?: string;
  instanceName?: string;
  projectDir: string;
}): void {
  const { found, method, instanceId, instanceName, projectDir } = params;
  if (found) {
    console.log(
      `📍 INSTANCE FOUND by ${method}: ${instanceName} (${instanceId?.slice(0, 8)}) for ${projectDir}`
    );
  } else {
    console.log(`⚠️ INSTANCE NOT FOUND for ${projectDir}`);
  }
}

/**
 * Log file activity check result
 */
export function logFileActivityCheck(params: {
  instanceName: string;
  sessionDir: string;
  fileFound: boolean;
  ageSeconds?: number;
  threshold: number;
  result: 'working' | 'idle';
}): void {
  const { instanceName, sessionDir, fileFound, ageSeconds, threshold, result } = params;
  if (!fileFound) {
    console.log(`📁 FILE CHECK ${instanceName}: No session files in ${sessionDir} → ${result}`);
  } else {
    console.log(
      `📁 FILE CHECK ${instanceName}: age=${ageSeconds?.toFixed(1)}s threshold=${threshold}s → ${result}`
    );
  }

  // Broadcast for real-time test monitoring
  broadcast({
    type: 'log:status',
    logType: 'file-check' as StatusLogType,
    timestamp: Date.now(),
    instanceName,
    sessionDir,
    fileFound,
    ageSeconds,
    threshold,
    result,
  });
}

/**
 * Log timeout check
 */
export function logTimeoutCheck(params: {
  instanceId: string;
  instanceName: string;
  timeSinceActivity: number;
  threshold: number;
  fileCheckResult?: 'working' | 'idle';
  action: 'reset' | 'extend' | 'skip';
}): void {
  const { instanceId, instanceName, timeSinceActivity, threshold, fileCheckResult, action } = params;
  const fileInfo = fileCheckResult ? ` fileCheck=${fileCheckResult}` : '';
  console.log(
    `⏱️ TIMEOUT CHECK ${instanceName} (${instanceId.slice(0, 8)}): inactive=${(timeSinceActivity/1000).toFixed(1)}s threshold=${threshold/1000}s${fileInfo} → ${action}`
  );

  // Broadcast for real-time test monitoring
  broadcast({
    type: 'log:status',
    logType: 'timeout-check' as StatusLogType,
    timestamp: Date.now(),
    instanceId,
    instanceName,
    timeSinceActivityMs: timeSinceActivity,
    thresholdMs: threshold,
    fileCheckResult,
    action,
  });
}
