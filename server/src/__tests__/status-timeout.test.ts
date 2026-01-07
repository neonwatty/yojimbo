import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before any imports
const mockRun = vi.fn();
const mockGet = vi.fn();

vi.mock('../db/connection.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      get: mockGet,
      run: mockRun,
    }),
  })),
}));

vi.mock('../websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../services/feed.service.js', () => ({
  createActivityEvent: vi.fn(),
}));

vi.mock('../services/local-status-poller.service.js', () => ({
  localStatusPollerService: {
    checkLocalClaudeStatus: vi.fn().mockReturnValue('idle'),
  },
}));

vi.mock('../services/status-logger.service.js', () => ({
  logStatusChange: vi.fn(),
  logTimeoutCheck: vi.fn(),
}));

// Import after mocking
import { statusTimeoutService } from '../services/status-timeout.service.js';
import { broadcast } from '../websocket/server.js';
import { createActivityEvent } from '../services/feed.service.js';

describe('StatusTimeoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    statusTimeoutService.stop();
    vi.useRealTimers();
  });

  describe('start/stop', () => {
    it('should start the timeout checker', () => {
      statusTimeoutService.start();
      // Should not throw and can be stopped
      statusTimeoutService.stop();
    });

    it('should not start twice if already running', () => {
      statusTimeoutService.start();
      statusTimeoutService.start(); // Should be a no-op
      statusTimeoutService.stop();
    });

    it('should stop gracefully when not running', () => {
      // Should not throw
      statusTimeoutService.stop();
      statusTimeoutService.stop();
    });
  });

  describe('recordActivity', () => {
    it('should record activity for an instance', () => {
      statusTimeoutService.recordActivity('instance-1', 'working');
      // Activity is recorded internally - tested via timeout behavior
    });

    it('should update activity timestamp on subsequent calls', () => {
      statusTimeoutService.recordActivity('instance-1', 'working');
      vi.advanceTimersByTime(5000);
      statusTimeoutService.recordActivity('instance-1', 'working');
      // Should reset the activity timer
    });
  });

  describe('removeInstance', () => {
    it('should remove instance from tracking', () => {
      statusTimeoutService.recordActivity('instance-1', 'working');
      statusTimeoutService.removeInstance('instance-1');
      // Instance should no longer be tracked
    });

    it('should not throw when removing non-existent instance', () => {
      // Should not throw
      statusTimeoutService.removeInstance('non-existent');
    });
  });

  describe('timeout behavior', () => {
    it('should reset status to idle after 60 seconds of inactivity', () => {
      // Mock instance exists and is working
      mockGet.mockReturnValue({
        id: 'instance-1',
        name: 'Test Instance',
        status: 'working',
        working_dir: '/test/project',
        machine_id: null, // local instance
      });
      mockRun.mockReturnValue({ changes: 1 });

      // Start service and record activity
      statusTimeoutService.start();
      statusTimeoutService.recordActivity('instance-1', 'working');

      // Advance past timeout (60s) + check interval (10s)
      vi.advanceTimersByTime(70000);

      // Should have broadcast status change
      expect(broadcast).toHaveBeenCalledWith({
        type: 'status:changed',
        instanceId: 'instance-1',
        status: 'idle',
      });

      // Should have created activity event
      expect(createActivityEvent).toHaveBeenCalledWith(
        'instance-1',
        'Test Instance',
        'completed',
        'Test Instance finished working'
      );
    });

    it('should not reset status if activity is recorded within timeout', () => {
      mockGet.mockReturnValue({
        id: 'instance-1',
        name: 'Test Instance',
        status: 'working',
        working_dir: '/test/project',
        machine_id: null,
      });

      statusTimeoutService.start();
      statusTimeoutService.recordActivity('instance-1', 'working');

      // Advance 30 seconds (less than 60s timeout)
      vi.advanceTimersByTime(30000);

      // Record new activity
      statusTimeoutService.recordActivity('instance-1', 'working');

      // Advance another 40 seconds (total 70s but only 40s since last activity)
      vi.advanceTimersByTime(40000);

      // Should NOT have broadcast because activity was recorded (40s < 60s timeout)
      expect(broadcast).not.toHaveBeenCalled();
    });

    it('should not reset status for idle instances', () => {
      statusTimeoutService.start();
      statusTimeoutService.recordActivity('instance-1', 'idle');

      // Advance past timeout (60s + 10s check interval)
      vi.advanceTimersByTime(70000);

      // Should not have broadcast anything
      expect(broadcast).not.toHaveBeenCalled();
    });

    it('should not reset status for error instances', () => {
      statusTimeoutService.start();
      statusTimeoutService.recordActivity('instance-1', 'error');

      // Advance past timeout (60s + 10s check interval)
      vi.advanceTimersByTime(70000);

      // Should not have broadcast anything
      expect(broadcast).not.toHaveBeenCalled();
    });

    it('should handle instance not found in database', () => {
      mockGet.mockReturnValue(undefined);

      statusTimeoutService.start();
      statusTimeoutService.recordActivity('instance-1', 'working');

      // Advance past timeout (60s + 10s check interval)
      vi.advanceTimersByTime(70000);

      // Should not throw, and should remove from tracking
      expect(broadcast).not.toHaveBeenCalled();
    });

    it('should handle instance status already changed in database', () => {
      // Instance is now idle in DB but was working when tracked
      mockGet.mockReturnValue({
        id: 'instance-1',
        name: 'Test Instance',
        status: 'idle', // Already idle
        working_dir: '/test/project',
        machine_id: null,
      });

      statusTimeoutService.start();
      statusTimeoutService.recordActivity('instance-1', 'working');

      // Advance past timeout (60s + 10s check interval)
      vi.advanceTimersByTime(70000);

      // Should not broadcast since status is already idle
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  describe('multiple instances', () => {
    it('should track multiple instances independently', () => {
      mockGet.mockImplementation((id: string) => ({
        id,
        name: `Instance ${id}`,
        status: 'working',
        working_dir: '/test/project',
        machine_id: null,
      }));
      mockRun.mockReturnValue({ changes: 1 });

      statusTimeoutService.start();

      // Record activity for first instance
      statusTimeoutService.recordActivity('instance-1', 'working');

      // Advance 40 seconds
      vi.advanceTimersByTime(40000);

      // Record activity for second instance (now 40s behind instance-1)
      statusTimeoutService.recordActivity('instance-2', 'working');

      // Advance 25 more seconds - instance-1 should timeout (65s > 60s), instance-2 at 25s
      vi.advanceTimersByTime(25000);

      // Only instance-1 should have been reset
      expect(broadcast).toHaveBeenCalledTimes(1);
      expect(broadcast).toHaveBeenCalledWith({
        type: 'status:changed',
        instanceId: 'instance-1',
        status: 'idle',
      });
    });
  });
});
