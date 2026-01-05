import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock modules before any imports that use them
vi.mock('../db/connection.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue([]),
      run: vi.fn(),
    }),
  })),
}));

vi.mock('../websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  },
}));

// Import after mocking
import { localStatusPollerService } from '../services/local-status-poller.service.js';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';

describe('LocalStatusPollerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStatusPollerService.stop();
    vi.useRealTimers();
  });

  describe('checkLocalClaudeStatus', () => {
    it('should return idle when session directory does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const status = localStatusPollerService.checkLocalClaudeStatus('/test/project');

      expect(status).toBe('idle');
    });

    it('should return idle when no session files exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.readdirSync).mockReturnValue([] as any);

      const status = localStatusPollerService.checkLocalClaudeStatus('/test/project');

      expect(status).toBe('idle');
    });

    it('should return working when session file was modified within 60 seconds', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.readdirSync).mockReturnValue(['session.jsonl'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 10000, // 10 seconds ago
      } as fs.Stats);

      const status = localStatusPollerService.checkLocalClaudeStatus('/test/project');

      expect(status).toBe('working');
    });

    it('should return idle when session file was modified more than 60 seconds ago', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.readdirSync).mockReturnValue(['session.jsonl'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 120000, // 120 seconds ago (more than 60s threshold)
      } as fs.Stats);

      const status = localStatusPollerService.checkLocalClaudeStatus('/test/project');

      expect(status).toBe('idle');
    });

    it('should expand tilde in working directory path', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      localStatusPollerService.checkLocalClaudeStatus('~/projects/test');

      // The session directory should be checked with the home directory
      const homeDir = os.homedir();
      const encodedDir = `${homeDir}/projects/test`.replace(/\//g, '-').replace(/^-/, '');
      const expectedPath = path.join(homeDir, '.claude', 'projects', encodedDir);

      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
    });

    it('should use most recently modified session file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.readdirSync).mockReturnValue([
        'old-session.jsonl',
        'new-session.jsonl',
      ] as any);

      // Mock statSync to return different times for different files
      vi.mocked(fs.statSync).mockImplementation((filePath: fs.PathLike) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('new-session')) {
          return { mtimeMs: Date.now() - 5000 } as fs.Stats; // 5 seconds ago
        }
        return { mtimeMs: Date.now() - 120000 } as fs.Stats; // 2 minutes ago
      });

      const status = localStatusPollerService.checkLocalClaudeStatus('/test/project');

      // Should be working because the newest file was modified 5 seconds ago
      expect(status).toBe('working');
    });
  });

  describe('pollAllLocalInstances', () => {
    it('should update status when it changes', async () => {
      const mockInstances = [
        { id: 'instance-1', name: 'Test Instance', working_dir: '/test/project', status: 'idle' },
      ];

      vi.mocked(getDatabase).mockReturnValue({
        prepare: vi.fn((sql: string) => {
          if (sql.includes('SELECT')) {
            return { all: () => mockInstances };
          }
          return { run: vi.fn() };
        }),
      } as unknown as ReturnType<typeof getDatabase>);

      // Mock that session file was recently modified
      vi.mocked(fs.existsSync).mockReturnValue(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(fs.readdirSync).mockReturnValue(['session.jsonl'] as any);
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: Date.now() - 5000, // 5 seconds ago
      } as fs.Stats);

      await localStatusPollerService.pollAllLocalInstances();

      // Should have broadcast the status change
      expect(broadcast).toHaveBeenCalledWith({
        type: 'status:changed',
        instanceId: 'instance-1',
        status: 'working',
      });
    });

    it('should not update status when it has not changed', async () => {
      const mockInstances = [
        { id: 'instance-1', name: 'Test Instance', working_dir: '/test/project', status: 'idle' },
      ];

      vi.mocked(getDatabase).mockReturnValue({
        prepare: vi.fn((sql: string) => {
          if (sql.includes('SELECT')) {
            return { all: () => mockInstances };
          }
          return { run: vi.fn() };
        }),
      } as unknown as ReturnType<typeof getDatabase>);

      // Mock that no session file exists (should remain idle)
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await localStatusPollerService.pollAllLocalInstances();

      // Should not have broadcast anything since status didn't change
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  describe('start/stop', () => {
    it('should start polling and can be stopped', () => {
      localStatusPollerService.start();

      // Advance timers to trigger polling
      vi.advanceTimersByTime(30000);

      localStatusPollerService.stop();

      // Should be able to restart after stopping
      localStatusPollerService.start();
      localStatusPollerService.stop();
    });
  });
});
