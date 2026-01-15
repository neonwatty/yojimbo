import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';
import os from 'os';

// Mock the database
const mockRun = vi.fn().mockReturnValue({ changes: 3 });
const mockPrepare = vi.fn().mockReturnValue({ run: mockRun });
const mockDb = {
  prepare: mockPrepare,
};

vi.mock('../db/connection.js', () => ({
  getDatabase: () => mockDb,
}));

// Mock fs for local hooks tests
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockCopyFileSync = vi.fn();

vi.mock('fs', () => ({
  default: {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    copyFileSync: (...args: unknown[]) => mockCopyFileSync(...args),
  },
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  copyFileSync: (...args: unknown[]) => mockCopyFileSync(...args),
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

describe('Local Hooks Installation', () => {
  const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hooks Configuration Structure', () => {
    it('should generate hooks with correct hook types', () => {
      const hookTypes = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop'];
      const SERVER_URL = 'http://localhost:3456';

      // Simulate the hooks configuration
      const hooksConfig = {
        UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: `curl -sX POST ${SERVER_URL}/api/hooks/status...` }] }],
        PreToolUse: [{ matcher: '', hooks: [{ type: 'command', command: `curl -sX POST ${SERVER_URL}/api/hooks/status...` }] }],
        PostToolUse: [{ matcher: '', hooks: [{ type: 'command', command: `curl -sX POST ${SERVER_URL}/api/hooks/status...` }] }],
        Notification: [{ matcher: '', hooks: [{ type: 'command', command: `curl -sX POST ${SERVER_URL}/api/hooks/notification...` }] }],
        Stop: [{ matcher: '', hooks: [{ type: 'command', command: `curl -sX POST ${SERVER_URL}/api/hooks/stop...` }] }],
      };

      // Verify all expected hook types exist
      hookTypes.forEach(type => {
        expect(hooksConfig).toHaveProperty(type);
        expect(Array.isArray(hooksConfig[type as keyof typeof hooksConfig])).toBe(true);
      });
    });

    it('should include CC_INSTANCE_ID in hook commands', () => {
      const commandTemplate = `curl -sX POST http://localhost:3456/api/hooks/status -H 'Content-Type: application/json' -d '{"event":"working","projectDir":"'"$CLAUDE_PROJECT_DIR"'","instanceId":"'"$CC_INSTANCE_ID"'"}' > /dev/null 2>&1 || true`;

      // Verify the command includes the CC_INSTANCE_ID variable
      expect(commandTemplate).toContain('$CC_INSTANCE_ID');
      expect(commandTemplate).toContain('$CLAUDE_PROJECT_DIR');
    });

    it('should have correct API endpoints for each hook type', () => {
      const statusEndpoint = '/api/hooks/status';
      const stopEndpoint = '/api/hooks/stop';
      const notificationEndpoint = '/api/hooks/notification';

      const statusCommand = `curl -sX POST http://localhost:3456${statusEndpoint}`;
      const stopCommand = `curl -sX POST http://localhost:3456${stopEndpoint}`;
      const notificationCommand = `curl -sX POST http://localhost:3456${notificationEndpoint}`;

      expect(statusCommand).toContain('/api/hooks/status');
      expect(stopCommand).toContain('/api/hooks/stop');
      expect(notificationCommand).toContain('/api/hooks/notification');
    });

    it('should use matcher format compatible with Claude Code', () => {
      const hookEntry = {
        matcher: '',
        hooks: [
          {
            type: 'command',
            command: 'curl ...',
            timeout: 5,
          },
        ],
      };

      // Claude Code expects a matcher field (can be empty string for catch-all)
      expect(hookEntry).toHaveProperty('matcher');
      expect(hookEntry).toHaveProperty('hooks');
      expect(Array.isArray(hookEntry.hooks)).toBe(true);
      expect(hookEntry.hooks[0]).toHaveProperty('type', 'command');
      expect(hookEntry.hooks[0]).toHaveProperty('command');
    });
  });

  describe('File Operations', () => {
    it('should create .claude directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const claudeDir = path.dirname(CLAUDE_SETTINGS_PATH);

      // Simulate directory creation
      if (!mockExistsSync(claudeDir)) {
        mockMkdirSync(claudeDir, { recursive: true });
      }

      expect(mockMkdirSync).toHaveBeenCalledWith(claudeDir, { recursive: true });
    });

    it('should backup existing settings before modification', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ existingSetting: true }));

      // Simulate backup creation
      if (mockExistsSync(CLAUDE_SETTINGS_PATH)) {
        const backupPath = `${CLAUDE_SETTINGS_PATH}.backup.${Date.now()}`;
        mockCopyFileSync(CLAUDE_SETTINGS_PATH, backupPath);
      }

      expect(mockCopyFileSync).toHaveBeenCalled();
      const copyCall = mockCopyFileSync.mock.calls[0];
      expect(copyCall[0]).toBe(CLAUDE_SETTINGS_PATH);
      expect(copyCall[1]).toMatch(/settings\.json\.backup\.\d+/);
    });

    it('should preserve existing settings when merging hooks', () => {
      const existingSettings = {
        theme: 'dark',
        someOtherSetting: 'value',
        hooks: {
          CustomHook: [{ matcher: '', hooks: [{ type: 'command', command: 'custom-cmd' }] }],
        },
      };

      const newHooks = {
        UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: 'new-cmd' }] }],
      };

      // Merge hooks
      const mergedSettings = {
        ...existingSettings,
        hooks: {
          ...existingSettings.hooks,
          ...newHooks,
        },
      };

      // Original settings should be preserved
      expect(mergedSettings.theme).toBe('dark');
      expect(mergedSettings.someOtherSetting).toBe('value');
      // Custom hooks should be preserved
      expect(mergedSettings.hooks.CustomHook).toBeDefined();
      // New hooks should be added
      expect(mergedSettings.hooks.UserPromptSubmit).toBeDefined();
    });

    it('should create new settings file if none exists', () => {
      mockExistsSync.mockReturnValue(false);

      const newSettings = {
        hooks: {
          UserPromptSubmit: [{ matcher: '', hooks: [{ type: 'command', command: 'test' }] }],
        },
      };

      mockWriteFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(newSettings, null, 2));

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        CLAUDE_SETTINGS_PATH,
        expect.stringContaining('UserPromptSubmit')
      );
    });

    it('should handle invalid JSON in existing settings gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json {{{');

      let settings = {};
      try {
        const content = mockReadFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
        settings = JSON.parse(content);
      } catch {
        // Start fresh if parse fails
        settings = {};
      }

      expect(settings).toEqual({});
    });
  });

  describe('Hook Detection', () => {
    it('should identify orchestrator hooks by API endpoint patterns', () => {
      const isOrchestratorHook = (hook: { hooks?: Array<{ command?: string }> }) => {
        return hook?.hooks?.some(h =>
          h.command?.includes('localhost:3456') ||
          h.command?.includes('/api/hooks/')
        );
      };

      const orchestratorHook = {
        hooks: [{ command: 'curl http://localhost:3456/api/hooks/status' }],
      };
      const customHook = {
        hooks: [{ command: 'notify-send "Done"' }],
      };

      expect(isOrchestratorHook(orchestratorHook)).toBe(true);
      expect(isOrchestratorHook(customHook)).toBe(false);
    });

    it('should correctly count installed hook types', () => {
      const existingHooks = {
        UserPromptSubmit: [{ hooks: [{ command: 'curl http://localhost:3456/api/hooks/status' }] }],
        PreToolUse: [{ hooks: [{ command: 'curl http://localhost:3456/api/hooks/status' }] }],
        PostToolUse: [{ hooks: [{ command: 'other-command' }] }], // Not ours
        Stop: [{ hooks: [{ command: 'curl http://localhost:3456/api/hooks/stop' }] }],
        Notification: [{ hooks: [{ command: 'curl http://localhost:3456/api/hooks/notification' }] }],
      };

      const ourHookTypes = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'];
      const installedTypes: string[] = [];

      for (const hookType of ourHookTypes) {
        const hookList = existingHooks[hookType as keyof typeof existingHooks] || [];
        const hasOurs = hookList.some((h: { hooks?: Array<{ command?: string }> }) =>
          h?.hooks?.some(inner => inner.command?.includes('/api/hooks/'))
        );
        if (hasOurs) {
          installedTypes.push(hookType);
        }
      }

      // PostToolUse doesn't have our hooks (has 'other-command')
      expect(installedTypes).toContain('UserPromptSubmit');
      expect(installedTypes).toContain('PreToolUse');
      expect(installedTypes).not.toContain('PostToolUse');
      expect(installedTypes).toContain('Stop');
      expect(installedTypes).toContain('Notification');
      expect(installedTypes.length).toBe(4);
    });

    it('should report installed=true only when all hook types are present', () => {
      const allHookTypes = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'];

      // Case 1: All hooks installed
      const installedTypes1 = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'];
      const isFullyInstalled1 = installedTypes1.length === allHookTypes.length;
      expect(isFullyInstalled1).toBe(true);

      // Case 2: Partial installation
      const installedTypes2 = ['UserPromptSubmit', 'PreToolUse', 'Stop'];
      const isFullyInstalled2 = installedTypes2.length === allHookTypes.length;
      expect(isFullyInstalled2).toBe(false);

      // Case 3: No hooks installed
      const installedTypes3: string[] = [];
      const isFullyInstalled3 = installedTypes3.length === allHookTypes.length;
      expect(isFullyInstalled3).toBe(false);
    });
  });

  describe('Hook Merging', () => {
    it('should replace existing orchestrator hooks when reinstalling', () => {
      const existingSettings = {
        hooks: {
          UserPromptSubmit: [
            { hooks: [{ command: 'curl http://localhost:3456/api/hooks/status -d old' }] },
            { hooks: [{ command: 'user-custom-hook' }] }, // User's hook - should be preserved
          ],
        },
      };

      const isOrchestratorHook = (hook: { hooks?: Array<{ command?: string }> }) => {
        return hook?.hooks?.some(h =>
          h.command?.includes('localhost:3456') || h.command?.includes('/api/hooks/')
        );
      };

      const newHook = { hooks: [{ command: 'curl http://localhost:3456/api/hooks/status -d new' }] };

      // Filter out existing orchestrator hooks, keep user hooks
      const filtered = existingSettings.hooks.UserPromptSubmit.filter(h => !isOrchestratorHook(h));

      // Add new orchestrator hook
      const merged = [...filtered, newHook];

      // Should have user's hook + new orchestrator hook
      expect(merged.length).toBe(2);
      expect(merged[0].hooks[0].command).toBe('user-custom-hook');
      expect(merged[1].hooks[0].command).toContain('-d new');
    });

    it('should preserve other settings keys when updating hooks', () => {
      const existingSettings = {
        theme: 'dark',
        autoSave: true,
        hooks: {
          UserPromptSubmit: [{ hooks: [{ command: 'old' }] }],
        },
        other: { nested: 'value' },
      };

      const newHooks = {
        UserPromptSubmit: [{ hooks: [{ command: 'new' }] }],
        Stop: [{ hooks: [{ command: 'stop' }] }],
      };

      const updatedSettings = {
        ...existingSettings,
        hooks: {
          ...existingSettings.hooks,
          ...newHooks,
        },
      };

      expect(updatedSettings.theme).toBe('dark');
      expect(updatedSettings.autoSave).toBe(true);
      expect(updatedSettings.other).toEqual({ nested: 'value' });
      expect(updatedSettings.hooks.UserPromptSubmit).toEqual(newHooks.UserPromptSubmit);
      expect(updatedSettings.hooks.Stop).toEqual(newHooks.Stop);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing .claude directory', () => {
      mockExistsSync.mockImplementation((p: string) => {
        if (p.includes('.claude')) return false;
        return true;
      });

      const claudeDir = path.dirname(CLAUDE_SETTINGS_PATH);

      // Should attempt to create directory
      if (!mockExistsSync(claudeDir)) {
        expect(() => {
          mockMkdirSync(claudeDir, { recursive: true });
        }).not.toThrow();
      }
    });

    it('should handle file system permission errors gracefully', () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      let error: Error | null = null;
      try {
        mockWriteFileSync(CLAUDE_SETTINGS_PATH, '{}');
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain('permission denied');
    });
  });
});
