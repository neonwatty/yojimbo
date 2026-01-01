import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockPrepare = vi.fn();
const mockGet = vi.fn();

vi.mock('../db/connection.js', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => {
      mockPrepare(sql);
      return { get: mockGet };
    },
  }),
}));

vi.mock('ssh2', () => ({
  Client: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnThis(),
    connect: vi.fn(),
    end: vi.fn(),
  })),
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-key')),
    existsSync: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('os', () => ({
  default: {
    homedir: () => '/home/testuser',
  },
}));

describe('HookInstallerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('installHooksForInstance', () => {
    it('should return error for non-existent instance', async () => {
      mockGet.mockReturnValue(undefined);

      const { hookInstallerService } = await import('../services/hook-installer.service.js');

      const result = await hookInstallerService.installHooksForInstance(
        'non-existent-id',
        'http://localhost:3456'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Instance not found');
    });

    it('should return error for local instance (no machine_id)', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        working_dir: '/test',
        machine_id: null, // Local instance - no machine_id
      });

      const { hookInstallerService } = await import('../services/hook-installer.service.js');

      const result = await hookInstallerService.installHooksForInstance(
        'test-instance',
        'http://localhost:3456'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Instance is not a remote instance');
    });

    it('should query instances table with machine_id column', async () => {
      mockGet.mockReturnValue(undefined);

      const { hookInstallerService } = await import('../services/hook-installer.service.js');

      await hookInstallerService.installHooksForInstance(
        'test-id',
        'http://localhost:3456'
      );

      // Verify the SQL query uses machine_id (not remote_machine_id)
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('machine_id')
      );

      // Should NOT contain the old incorrect column name
      const sqlCalls = mockPrepare.mock.calls.map(c => c[0]);
      sqlCalls.forEach(sql => {
        expect(sql).not.toContain('remote_machine_id');
      });
    });

    it('should return error when remote machine not found', async () => {
      // First call returns instance, second returns undefined (no machine)
      mockGet
        .mockReturnValueOnce({
          id: 'test-instance',
          working_dir: '/test',
          machine_id: 'machine-123',
        })
        .mockReturnValueOnce(undefined); // Machine not found

      const { hookInstallerService } = await import('../services/hook-installer.service.js');

      const result = await hookInstallerService.installHooksForInstance(
        'test-instance',
        'http://localhost:3456'
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Remote machine not found');
    });
  });

  describe('uninstallHooksForInstance', () => {
    it('should return error for non-existent instance', async () => {
      mockGet.mockReturnValue(undefined);

      const { hookInstallerService } = await import('../services/hook-installer.service.js');

      const result = await hookInstallerService.uninstallHooksForInstance('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Instance not found');
    });

    it('should return error for local instance', async () => {
      mockGet.mockReturnValue({
        id: 'test-instance',
        working_dir: '/test',
        machine_id: null,
      });

      const { hookInstallerService } = await import('../services/hook-installer.service.js');

      const result = await hookInstallerService.uninstallHooksForInstance('test-instance');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Instance is not a remote instance');
    });
  });
});
