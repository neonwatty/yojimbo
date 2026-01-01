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

  describe('hook format', () => {
    it('should generate hooks in the new matcher-based format', async () => {
      // Access the private method via the prototype for testing
      const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
      const service = new HookInstallerService();

      // Call the private method directly
      const config = service['generateHooksConfig']('test-instance-id', 'http://localhost:3456');

      // Verify the structure matches Claude Code's expected format
      expect(config).toHaveProperty('hooks');

      const hooks = (config as any).hooks;

      // Check each hook type has the new format
      const hookTypes = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'];

      for (const hookType of hookTypes) {
        expect(hooks).toHaveProperty(hookType);
        expect(Array.isArray(hooks[hookType])).toBe(true);
        expect(hooks[hookType].length).toBeGreaterThan(0);

        const hookEntry = hooks[hookType][0];

        // Each entry must have a matcher
        expect(hookEntry).toHaveProperty('matcher');
        expect(hookEntry.matcher).toBe('.');

        // Each entry must have hooks array with command objects
        expect(hookEntry).toHaveProperty('hooks');
        expect(Array.isArray(hookEntry.hooks)).toBe(true);
        expect(hookEntry.hooks.length).toBeGreaterThan(0);

        const hookCommand = hookEntry.hooks[0];
        expect(hookCommand).toHaveProperty('type', 'command');
        expect(hookCommand).toHaveProperty('command');
        expect(typeof hookCommand.command).toBe('string');
        expect(hookCommand.command).toContain('curl');
        expect(hookCommand.command).toContain('test-instance-id');
      }
    });

    it('should include correct API endpoints in hook commands', async () => {
      const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
      const service = new HookInstallerService();

      const config = service['generateHooksConfig']('my-instance', 'http://example.com:3456');
      const hooks = (config as any).hooks;

      // Status hooks should call /api/hooks/status
      const statusCmd = hooks.UserPromptSubmit[0].hooks[0].command;
      expect(statusCmd).toContain('/api/hooks/status');
      expect(statusCmd).toContain('http://example.com:3456');

      // Stop hook should call /api/hooks/stop
      const stopCmd = hooks.Stop[0].hooks[0].command;
      expect(stopCmd).toContain('/api/hooks/stop');

      // Notification hook should call /api/hooks/notification
      const notifCmd = hooks.Notification[0].hooks[0].command;
      expect(notifCmd).toContain('/api/hooks/notification');
    });

    it('should generate valid JSON when stringified', async () => {
      const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
      const service = new HookInstallerService();

      const config = service['generateHooksConfig']('test-instance', 'http://localhost:3456');

      // The config object should be serializable to valid JSON
      const jsonString = JSON.stringify(config, null, 2);

      // Should not throw when parsing
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Parse and verify structure is preserved
      const parsed = JSON.parse(jsonString);
      expect(parsed).toHaveProperty('hooks');
      expect(parsed.hooks).toHaveProperty('UserPromptSubmit');
    });

    it('should produce valid JSON that Claude Code can parse as settings.json', async () => {
      const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
      const service = new HookInstallerService();

      const config = service['generateHooksConfig']('test-id', 'http://192.168.1.25:3456');

      // Simulate what happens when writing to settings.json
      const jsonString = JSON.stringify(config, null, 2);

      // Parse it back - this is what Claude Code does when reading settings.json
      const parsed = JSON.parse(jsonString);

      // Verify commands don't have broken escaping
      const command = parsed.hooks.UserPromptSubmit[0].hooks[0].command;

      // Command should be a valid string
      expect(typeof command).toBe('string');

      // Command should contain the curl call
      expect(command).toContain('curl');

      // Command should contain proper JSON structure for -d argument
      // The -d argument should have valid JSON (with shell variable substitution pattern)
      expect(command).toMatch(/-d\s+'/); // -d followed by single quote
      expect(command).toContain('"event":"working"');
      expect(command).toContain('"projectDir":"');
      expect(command).toContain('$CWD'); // Variable should be present for expansion
    });
  });
});
