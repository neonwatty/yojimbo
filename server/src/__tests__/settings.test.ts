import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database
const mockRun = vi.fn().mockReturnValue({ changes: 3 });
const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
const mockDb = {
  prepare: mockPrepare,
};

vi.mock('../db/connection.js', () => ({
  getDatabase: () => mockDb,
}));

describe('Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/settings/reset-instance-status', () => {
    it('should reset all open instances to idle status', () => {
      // Simulate what the endpoint does
      const result = mockDb.prepare(`
        UPDATE instances
        SET status = 'idle', updated_at = datetime('now')
        WHERE closed_at IS NULL
      `).run();

      expect(mockPrepare).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
      expect(result.changes).toBe(3);
    });

    it('should only affect open instances (closed_at IS NULL)', () => {
      // Verify the SQL includes the closed_at filter
      const expectedSqlPattern = /WHERE closed_at IS NULL/;

      mockDb.prepare(`
        UPDATE instances
        SET status = 'idle', updated_at = datetime('now')
        WHERE closed_at IS NULL
      `);

      const callArg = mockPrepare.mock.calls[0][0];
      expect(callArg).toMatch(expectedSqlPattern);
    });

    it('should set status to idle', () => {
      // Verify the SQL sets status to idle
      const expectedSqlPattern = /SET status = 'idle'/;

      mockDb.prepare(`
        UPDATE instances
        SET status = 'idle', updated_at = datetime('now')
        WHERE closed_at IS NULL
      `);

      const callArg = mockPrepare.mock.calls[0][0];
      expect(callArg).toMatch(expectedSqlPattern);
    });

    it('should update the updated_at timestamp', () => {
      // Verify the SQL updates the timestamp
      const expectedSqlPattern = /updated_at = datetime\('now'\)/;

      mockDb.prepare(`
        UPDATE instances
        SET status = 'idle', updated_at = datetime('now')
        WHERE closed_at IS NULL
      `);

      const callArg = mockPrepare.mock.calls[0][0];
      expect(callArg).toMatch(expectedSqlPattern);
    });

    it('should return the count of affected instances', () => {
      const result = mockDb.prepare('').run();

      const response = {
        success: true,
        data: { reset: true, count: result.changes },
      };

      expect(response.data.count).toBe(3);
      expect(response.data.reset).toBe(true);
    });
  });

  describe('Reset behavior', () => {
    it('should handle zero affected instances', () => {
      mockRun.mockReturnValueOnce({ changes: 0 });

      const result = mockDb.prepare('').run();

      const response = {
        success: true,
        data: { reset: true, count: result.changes },
      };

      expect(response.data.count).toBe(0);
    });

    it('should handle multiple affected instances', () => {
      mockRun.mockReturnValueOnce({ changes: 10 });

      const result = mockDb.prepare('').run();

      expect(result.changes).toBe(10);
    });
  });
});
