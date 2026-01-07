/**
 * Status Analyzer Utility
 * Analyzes status logs captured from WebSocket to detect conflicts
 * between different status detection mechanisms.
 */

export type StatusLogType = 'status-change' | 'hook-received' | 'file-check' | 'timeout-check';
export type StatusSource = 'hook' | 'local-poll' | 'remote-poll' | 'timeout';

export interface StatusLogEvent {
  type: 'log:status';
  logType: StatusLogType;
  timestamp: number;
  instanceId?: string;
  instanceName?: string;
  // status-change fields
  oldStatus?: string;
  newStatus?: string;
  changed?: boolean;
  source?: StatusSource;
  reason?: string;
  metadata?: Record<string, unknown>;
  // hook-received fields
  hookType?: string;
  projectDir?: string;
  machineId?: string;
  // file-check fields
  sessionDir?: string;
  fileFound?: boolean;
  ageSeconds?: number;
  threshold?: number;
  result?: 'working' | 'idle';
  // timeout-check fields
  timeSinceActivityMs?: number;
  thresholdMs?: number;
  fileCheckResult?: 'working' | 'idle';
  action?: 'reset' | 'extend' | 'skip';
}

export interface StatusTransition {
  timestamp: number;
  relativeTime: number; // ms since test start
  source: StatusSource;
  oldStatus: string;
  newStatus: string;
  reason: string;
  isConflict: boolean;
  conflictDetails?: string;
}

export interface InstanceTimeline {
  instanceId: string;
  instanceName: string;
  workingDir?: string;
  transitions: StatusTransition[];
  conflicts: ConflictEvent[];
  finalStatus: string;
  expectedFinalStatus?: string;
}

export interface ConflictEvent {
  timestamp: number;
  relativeTime: number;
  description: string;
  sources: StatusSource[];
  statuses: string[];
}

export interface DebugReport {
  testName: string;
  startTime: number;
  duration: number;
  instances: InstanceTimeline[];
  totalTransitions: number;
  totalConflicts: number;
  summary: string;
}

/**
 * Analyzes status log events to build timelines and detect conflicts
 */
export class StatusAnalyzer {
  private logs: StatusLogEvent[] = [];
  private startTime: number = Date.now();
  private instanceTimelines: Map<string, InstanceTimeline> = new Map();

  constructor(testName: string = 'Status Debug Test') {
    this.testName = testName;
  }

  private testName: string;

  /**
   * Record the test start time
   */
  start(): void {
    this.startTime = Date.now();
    this.logs = [];
    this.instanceTimelines.clear();
  }

  /**
   * Add a log event from WebSocket
   */
  addLog(event: StatusLogEvent): void {
    this.logs.push(event);

    // Process status-change events into timelines
    if (event.logType === 'status-change' && event.instanceId) {
      this.processStatusChange(event);
    }
  }

  /**
   * Process a status change event
   */
  private processStatusChange(event: StatusLogEvent): void {
    const { instanceId, instanceName, oldStatus, newStatus, source, reason, changed } = event;

    if (!instanceId || !source || oldStatus === undefined || newStatus === undefined) return;

    let timeline = this.instanceTimelines.get(instanceId);
    if (!timeline) {
      timeline = {
        instanceId,
        instanceName: instanceName || 'Unknown',
        transitions: [],
        conflicts: [],
        finalStatus: newStatus,
      };
      this.instanceTimelines.set(instanceId, timeline);
    }

    const relativeTime = event.timestamp - this.startTime;
    const transition: StatusTransition = {
      timestamp: event.timestamp,
      relativeTime,
      source,
      oldStatus,
      newStatus,
      reason: reason || '',
      isConflict: false,
    };

    // Detect conflicts: status changed back within 5 seconds
    if (changed && timeline.transitions.length > 0) {
      const lastTransition = timeline.transitions[timeline.transitions.length - 1];
      const timeSinceLast = event.timestamp - lastTransition.timestamp;

      // Conflict: status oscillating (changed back to previous status within 5s)
      if (timeSinceLast < 5000 && lastTransition.newStatus !== newStatus && lastTransition.oldStatus === newStatus) {
        transition.isConflict = true;
        transition.conflictDetails = `Status oscillation: ${lastTransition.newStatus} → ${newStatus} in ${timeSinceLast}ms`;

        timeline.conflicts.push({
          timestamp: event.timestamp,
          relativeTime,
          description: `Status oscillation: ${source} changed status back to ${newStatus} within ${timeSinceLast}ms of ${lastTransition.source} setting it to ${lastTransition.newStatus}`,
          sources: [lastTransition.source, source],
          statuses: [lastTransition.newStatus, newStatus],
        });
      }

      // Conflict: different sources disagree on status within 2s
      if (timeSinceLast < 2000 && lastTransition.source !== source && lastTransition.newStatus !== newStatus) {
        if (!transition.isConflict) {
          transition.isConflict = true;
          transition.conflictDetails = `Source conflict: ${lastTransition.source} said ${lastTransition.newStatus}, ${source} says ${newStatus}`;

          timeline.conflicts.push({
            timestamp: event.timestamp,
            relativeTime,
            description: `Source conflict: ${lastTransition.source} set ${lastTransition.newStatus}, but ${source} immediately set ${newStatus}`,
            sources: [lastTransition.source, source],
            statuses: [lastTransition.newStatus, newStatus],
          });
        }
      }
    }

    timeline.transitions.push(transition);
    timeline.finalStatus = newStatus;
  }

  /**
   * Set expected final status for an instance
   */
  setExpectedFinalStatus(instanceId: string, status: string): void {
    const timeline = this.instanceTimelines.get(instanceId);
    if (timeline) {
      timeline.expectedFinalStatus = status;
    }
  }

  /**
   * Generate the debug report
   */
  generateReport(): DebugReport {
    const instances = Array.from(this.instanceTimelines.values());
    const totalTransitions = instances.reduce((sum, t) => sum + t.transitions.length, 0);
    const totalConflicts = instances.reduce((sum, t) => sum + t.conflicts.length, 0);

    // Generate summary
    let summary = '';
    if (totalConflicts === 0) {
      summary = `✅ No conflicts detected across ${instances.length} instance(s) with ${totalTransitions} status transitions.`;
    } else {
      summary = `⚠️ ${totalConflicts} conflict(s) detected across ${instances.length} instance(s) with ${totalTransitions} status transitions.`;
      for (const instance of instances) {
        if (instance.conflicts.length > 0) {
          summary += `\n  - ${instance.instanceName}: ${instance.conflicts.length} conflict(s)`;
        }
        if (instance.expectedFinalStatus && instance.finalStatus !== instance.expectedFinalStatus) {
          summary += `\n  - ${instance.instanceName}: Final status mismatch (expected: ${instance.expectedFinalStatus}, actual: ${instance.finalStatus})`;
        }
      }
    }

    return {
      testName: this.testName,
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
      instances,
      totalTransitions,
      totalConflicts,
      summary,
    };
  }

  /**
   * Format the report as a human-readable string
   */
  formatReport(report: DebugReport): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push(`Status Detection Debug Report: ${report.testName}`);
    lines.push('='.repeat(60));
    lines.push('');

    for (const instance of report.instances) {
      lines.push(`Instance: ${instance.instanceName} (${instance.instanceId.slice(0, 8)})`);
      if (instance.workingDir) {
        lines.push(`Working Dir: ${instance.workingDir}`);
      }
      lines.push('');
      lines.push('Timeline:');

      for (const transition of instance.transitions) {
        const timeStr = this.formatTime(transition.relativeTime);
        const arrow = transition.oldStatus !== transition.newStatus ? '→' : '=';
        const conflictMark = transition.isConflict ? ' ⚠️ CONFLICT' : '';
        lines.push(`  ${timeStr} [${transition.source.padEnd(11)}] ${transition.oldStatus} ${arrow} ${transition.newStatus} | ${transition.reason}${conflictMark}`);
      }

      if (instance.conflicts.length > 0) {
        lines.push('');
        lines.push('Anomalies Detected:');
        for (const conflict of instance.conflicts) {
          lines.push(`  - ${conflict.description}`);
        }
      }

      lines.push('');
      lines.push(`Final Status: ${instance.finalStatus}${instance.expectedFinalStatus ? ` (expected: ${instance.expectedFinalStatus})` : ''}`);
      lines.push('');
      lines.push('-'.repeat(60));
      lines.push('');
    }

    lines.push('Summary:');
    lines.push(`  Total Transitions: ${report.totalTransitions}`);
    lines.push(`  Conflicts Detected: ${report.totalConflicts}`);
    lines.push(`  Duration: ${(report.duration / 1000).toFixed(1)}s`);
    lines.push('');
    lines.push(report.summary);

    return lines.join('\n');
  }

  /**
   * Format milliseconds as MM:SS.mmm
   */
  private formatTime(ms: number): string {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
  }

  /**
   * Get all captured logs
   */
  getLogs(): StatusLogEvent[] {
    return [...this.logs];
  }

  /**
   * Get timeline for a specific instance
   */
  getInstanceTimeline(instanceId: string): InstanceTimeline | undefined {
    return this.instanceTimelines.get(instanceId);
  }

  /**
   * Check if any conflicts were detected
   */
  hasConflicts(): boolean {
    for (const timeline of this.instanceTimelines.values()) {
      if (timeline.conflicts.length > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get total conflict count
   */
  getConflictCount(): number {
    let count = 0;
    for (const timeline of this.instanceTimelines.values()) {
      count += timeline.conflicts.length;
    }
    return count;
  }
}
