/**
 * Hook Priority Service
 *
 * Tracks when authoritative hooks (stop, notification) were received
 * so that local polling can defer to them for a grace period.
 *
 * This prevents the race condition where:
 * 1. Stop hook fires → status set to idle
 * 2. Local poll runs → sees recent file → sets status back to working
 */

interface HookRecord {
  timestamp: number;
  hookType: 'stop' | 'notification';
}

class HookPriorityService {
  // Map of instanceId → last authoritative hook received
  private recentHooks: Map<string, HookRecord> = new Map();

  // Grace period: don't let polling override hooks within this window
  private readonly GRACE_PERIOD_MS = 10000; // 10 seconds

  /**
   * Record that an authoritative hook was received for an instance
   */
  recordHook(instanceId: string, hookType: 'stop' | 'notification'): void {
    this.recentHooks.set(instanceId, {
      timestamp: Date.now(),
      hookType,
    });
  }

  /**
   * Check if polling should defer to a recent hook
   * Returns true if a hook was received within the grace period
   */
  shouldDeferToHook(instanceId: string): boolean {
    const record = this.recentHooks.get(instanceId);
    if (!record) return false;

    const elapsed = Date.now() - record.timestamp;
    if (elapsed < this.GRACE_PERIOD_MS) {
      return true;
    }

    // Grace period expired, clean up
    this.recentHooks.delete(instanceId);
    return false;
  }

  /**
   * Get info about a recent hook (for logging)
   */
  getRecentHook(instanceId: string): HookRecord | undefined {
    const record = this.recentHooks.get(instanceId);
    if (!record) return undefined;

    const elapsed = Date.now() - record.timestamp;
    if (elapsed < this.GRACE_PERIOD_MS) {
      return record;
    }

    return undefined;
  }

  /**
   * Clear hook record for an instance (e.g., when instance is closed)
   */
  clearInstance(instanceId: string): void {
    this.recentHooks.delete(instanceId);
  }
}

export const hookPriorityService = new HookPriorityService();
