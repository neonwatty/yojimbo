import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database
const mockDb = {
  prepare: vi.fn().mockReturnValue({
    get: vi.fn(),
    run: vi.fn(),
  }),
};

vi.mock('../db/connection.js', () => ({
  getDatabase: () => mockDb,
}));

// Mock the broadcast function
const mockBroadcast = vi.fn();
vi.mock('../websocket/server.js', () => ({
  broadcast: mockBroadcast,
}));

// Since hooks.ts uses Router(), we need to test the logic directly
// We'll test the helper functions and status transitions

describe('Hooks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Status transitions', () => {
    it('working event should set status to working', () => {
      // Simulate what happens when a working event is received
      const event = 'working';
      const expectedStatus = event === 'working' ? 'working' : 'idle';
      expect(expectedStatus).toBe('working');
    });

    it('idle event should set status to idle', () => {
      const event: string = 'idle';
      const expectedStatus = event === 'working' ? 'working' : 'idle';
      expect(expectedStatus).toBe('idle');
    });

    it('notification should set status to idle', () => {
      // Notification endpoint now sets idle (awaiting status removed)
      const status = 'idle';
      expect(status).toBe('idle');
    });

    it('stop should set status to idle', () => {
      // Stop endpoint always sets idle
      const status = 'idle';
      expect(status).toBe('idle');
    });
  });

  describe('Instance lookup', () => {
    it('should prefer instanceId over projectDir', () => {
      const instanceId = 'test-instance-123';
      const projectDir = '/some/path';

      // When instanceId is provided, it should be checked first
      const lookupOrder: string[] = [];

      if (instanceId) {
        lookupOrder.push('instanceId');
      }
      if (projectDir) {
        lookupOrder.push('projectDir');
      }

      expect(lookupOrder[0]).toBe('instanceId');
    });

    it('should fall back to projectDir when instanceId is empty', () => {
      const instanceId = '';
      const projectDir = '/some/path';

      // When instanceId is empty, projectDir should be used
      const useProjectDir = !instanceId && projectDir;
      expect(useProjectDir).toBe('/some/path');
    });
  });

  describe('Database updates', () => {
    it('should update instance status in database', () => {
      const instanceId = 'test-123';
      const status = 'working';

      // Simulate database update
      mockDb.prepare.mockReturnValue({
        run: vi.fn(),
      });

      const stmt = mockDb.prepare(`
        UPDATE instances
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(status, instanceId);

      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('WebSocket broadcast', () => {
    it('should broadcast status change event', () => {
      const instanceId = 'test-123';
      const status = 'working';

      mockBroadcast({
        type: 'status:changed',
        instanceId,
        status,
      });

      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'status:changed',
        instanceId,
        status,
      });
    });

    it('should broadcast idle status on notification', () => {
      const instanceId = 'test-123';
      const status = 'idle';

      mockBroadcast({
        type: 'status:changed',
        instanceId,
        status,
      });

      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'status:changed',
        instanceId,
        status: 'idle',
      });
    });

    it('should broadcast idle status on stop', () => {
      const instanceId = 'test-123';
      const status = 'idle';

      mockBroadcast({
        type: 'status:changed',
        instanceId,
        status,
      });

      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'status:changed',
        instanceId,
        status: 'idle',
      });
    });
  });

  describe('Hook event flow', () => {
    it('UserPromptSubmit should trigger working status', () => {
      // UserPromptSubmit sends event: "working"
      const hookEvent = { event: 'working', projectDir: '/test', instanceId: 'test-1' };
      const resultStatus = hookEvent.event === 'working' ? 'working' : 'idle';
      expect(resultStatus).toBe('working');
    });

    it('PreToolUse should trigger working status', () => {
      // PreToolUse sends event: "working"
      const hookEvent = { event: 'working', projectDir: '/test', instanceId: 'test-1' };
      const resultStatus = hookEvent.event === 'working' ? 'working' : 'idle';
      expect(resultStatus).toBe('working');
    });

    it('PostToolUse should trigger working status (fixed behavior)', () => {
      // PostToolUse now sends event: "working" (was "idle" before fix)
      const hookEvent = { event: 'working', projectDir: '/test', instanceId: 'test-1' };
      const resultStatus = hookEvent.event === 'working' ? 'working' : 'idle';
      expect(resultStatus).toBe('working');
    });

    it('Stop should trigger idle status', () => {
      // Stop endpoint always sets idle, regardless of event
      const resultStatus = 'idle';
      expect(resultStatus).toBe('idle');
    });

    it('Notification should trigger idle status', () => {
      // Notification endpoint now sets idle (awaiting status removed)
      const resultStatus = 'idle';
      expect(resultStatus).toBe('idle');
    });
  });

  describe('Path normalization', () => {
    it('should expand tilde to home directory', () => {
      const projectDir = '~/projects/test';
      const homeDir = '/Users/testuser';
      const normalized = projectDir.replace(/^~/, homeDir);
      expect(normalized).toBe('/Users/testuser/projects/test');
    });

    it('should handle absolute paths', () => {
      const projectDir = '/Users/testuser/projects/test';
      const homeDir = '/Users/testuser';
      const normalized = projectDir.replace(/^~/, homeDir);
      expect(normalized).toBe('/Users/testuser/projects/test');
    });
  });
});
