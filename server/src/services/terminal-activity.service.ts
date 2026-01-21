/**
 * Terminal Activity Service
 *
 * COMMENTED OUT: This feature is not currently being used.
 *
 * Original purpose: Tracks terminal activity via WebSocket for UI display purposes.
 * This service does NOT change instance status - it only tracks activity
 * timestamps so the UI can show "Possibly Active" indicators.
 *
 * Status changes are handled by:
 * 1. Hooks (highest priority) - Claude Code sends status/notification/stop hooks
 * 2. File polling (fallback) - checks .jsonl file modification times
 *
 * This service provides:
 * - Activity timestamps for UI display
 * - "hasRecentActivity" check for showing activity indicators
 */

// interface ActivityRecord {
//   lastActivityAt: number;
// }

// class TerminalActivityService {
//   // Map of instanceId -> activity record
//   private activityMap = new Map<string, ActivityRecord>();

//   // How long before we consider terminal "inactive" for UI purposes (ms)
//   private readonly ACTIVITY_THRESHOLD_MS = 30000; // 30 seconds

//   /**
//    * Record terminal activity for an instance.
//    * Called by WebSocket server when terminal output is received.
//    * NOTE: This only updates the activity timestamp for UI display,
//    * it does NOT change the instance status.
//    */
//   recordActivity(instanceId: string): void {
//     const now = Date.now();

//     // Update activity timestamp
//     const existing = this.activityMap.get(instanceId);
//     if (existing) {
//       existing.lastActivityAt = now;
//     } else {
//       this.activityMap.set(instanceId, {
//         lastActivityAt: now,
//       });
//     }
//   }

//   /**
//    * Get the last activity timestamp for an instance
//    */
//   getLastActivity(instanceId: string): number | null {
//     return this.activityMap.get(instanceId)?.lastActivityAt ?? null;
//   }

//   /**
//    * Check if an instance has recent activity (for UI display)
//    */
//   hasRecentActivity(instanceId: string, thresholdMs: number = this.ACTIVITY_THRESHOLD_MS): boolean {
//     const record = this.activityMap.get(instanceId);
//     if (!record) return false;
//     return Date.now() - record.lastActivityAt < thresholdMs;
//   }

//   /**
//    * Clear activity tracking for an instance (e.g., when closed)
//    */
//   clearInstance(instanceId: string): void {
//     this.activityMap.delete(instanceId);
//   }
// }

// Stub export to avoid breaking imports - these are no-ops
export const terminalActivityService = {
  recordActivity: (_instanceId: string): void => {},
  getLastActivity: (_instanceId: string): number | null => null,
  hasRecentActivity: (_instanceId: string, _thresholdMs?: number): boolean => false,
  clearInstance: (_instanceId: string): void => {},
};
