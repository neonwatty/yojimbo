import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Hoist mocks
const mockBroadcast = vi.hoisted(() => vi.fn());

// Mock chokidar watcher
class MockWatcher extends EventEmitter {
  close = vi.fn();
}

const mockWatch = vi.hoisted(() => vi.fn());

vi.mock('chokidar', () => ({
  default: {
    watch: mockWatch,
  },
  watch: mockWatch,
}));

vi.mock('../websocket/server.js', () => ({
  broadcast: mockBroadcast,
}));

vi.mock('../config/index.js', () => ({
  CONFIG: {
    runtime: {
      fileWatcherDebounceMs: 50,
    },
  },
}));

// Import after mocks
import { startWatching, stopWatching, stopAllWatchers, isWatching } from '../services/file-watcher.service.js';

describe('FileWatcherService', () => {
  let mockWatcher: MockWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create a fresh mock watcher for each test
    mockWatcher = new MockWatcher();
    mockWatch.mockReturnValue(mockWatcher);

    // Stop any existing watchers from previous tests
    stopAllWatchers();
  });

  afterEach(() => {
    stopAllWatchers();
    vi.useRealTimers();
  });

  describe('startWatching', () => {
    it('should start watching a directory for plans', () => {
      startWatching('/test/project', 'plan');

      expect(mockWatch).toHaveBeenCalledWith(
        '/test/project/plans/**/*.md',
        expect.objectContaining({
          ignoreInitial: true,
          persistent: true,
        })
      );
    });

    it('should start watching a directory for mockups', () => {
      startWatching('/test/project', 'mockup');

      expect(mockWatch).toHaveBeenCalledWith(
        '/test/project/mockups/**/*.{html,htm}',
        expect.objectContaining({
          ignoreInitial: true,
          persistent: true,
        })
      );
    });

    it('should not start watching if already watching same directory and type', () => {
      startWatching('/test/project', 'plan');
      startWatching('/test/project', 'plan');

      // Should only be called once
      expect(mockWatch).toHaveBeenCalledTimes(1);
    });

    it('should allow watching same directory for different types', () => {
      startWatching('/test/project', 'plan');
      startWatching('/test/project', 'mockup');

      expect(mockWatch).toHaveBeenCalledTimes(2);
    });

    it('should allow watching different directories for same type', () => {
      startWatching('/test/project1', 'plan');
      startWatching('/test/project2', 'plan');

      expect(mockWatch).toHaveBeenCalledTimes(2);
    });
  });

  describe('file change events', () => {
    it('should broadcast file changed event on change', async () => {
      startWatching('/test/project', 'plan');

      // Trigger change event
      mockWatcher.emit('change', '/test/project/plans/todo.md');

      // Advance past debounce timer
      await vi.advanceTimersByTimeAsync(100);

      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'file:changed',
        fileChange: expect.objectContaining({
          fileType: 'plan',
          filePath: '/test/project/plans/todo.md',
          workingDir: '/test/project',
          changeType: 'modified',
        }),
      });
    });

    it('should broadcast file deleted event on unlink', () => {
      startWatching('/test/project', 'plan');

      // Trigger unlink event
      mockWatcher.emit('unlink', '/test/project/plans/removed.md');

      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'file:deleted',
        fileChange: expect.objectContaining({
          fileType: 'plan',
          filePath: '/test/project/plans/removed.md',
          workingDir: '/test/project',
          changeType: 'deleted',
        }),
      });
    });

    it('should debounce rapid file changes', async () => {
      startWatching('/test/project', 'plan');

      // Trigger multiple rapid change events
      mockWatcher.emit('change', '/test/project/plans/todo.md');
      await vi.advanceTimersByTimeAsync(20);
      mockWatcher.emit('change', '/test/project/plans/todo.md');
      await vi.advanceTimersByTimeAsync(20);
      mockWatcher.emit('change', '/test/project/plans/todo.md');

      // Advance past debounce timer
      await vi.advanceTimersByTimeAsync(100);

      // Should only broadcast once due to debouncing
      expect(mockBroadcast).toHaveBeenCalledTimes(1);
    });

    it('should generate stable file IDs for same path', async () => {
      startWatching('/test/project', 'plan');

      // Trigger change event twice (after debounce)
      mockWatcher.emit('change', '/test/project/plans/todo.md');
      await vi.advanceTimersByTimeAsync(100);

      const firstCall = mockBroadcast.mock.calls[0][0];
      const firstFileId = firstCall.fileChange.fileId;

      mockBroadcast.mockClear();

      // Emit again with same path
      mockWatcher.emit('change', '/test/project/plans/todo.md');
      await vi.advanceTimersByTimeAsync(100);

      const secondCall = mockBroadcast.mock.calls[0][0];
      const secondFileId = secondCall.fileChange.fileId;

      // File IDs should be the same for the same path
      expect(firstFileId).toBe(secondFileId);
    });
  });

  describe('stopWatching', () => {
    it('should stop watching a directory', () => {
      startWatching('/test/project', 'plan');

      expect(isWatching('/test/project', 'plan')).toBe(true);

      stopWatching('/test/project', 'plan');

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(isWatching('/test/project', 'plan')).toBe(false);
    });

    it('should not throw when stopping unwatched directory', () => {
      expect(() => stopWatching('/non-existent', 'plan')).not.toThrow();
    });

    it('should only stop the specific watcher', () => {
      const mockWatcher1 = new MockWatcher();
      const mockWatcher2 = new MockWatcher();
      mockWatch.mockReturnValueOnce(mockWatcher1).mockReturnValueOnce(mockWatcher2);

      startWatching('/test/project', 'plan');
      startWatching('/test/project', 'mockup');

      stopWatching('/test/project', 'plan');

      expect(mockWatcher1.close).toHaveBeenCalled();
      expect(mockWatcher2.close).not.toHaveBeenCalled();
      expect(isWatching('/test/project', 'plan')).toBe(false);
      expect(isWatching('/test/project', 'mockup')).toBe(true);
    });
  });

  describe('stopAllWatchers', () => {
    it('should stop all watchers', () => {
      const mockWatcher1 = new MockWatcher();
      const mockWatcher2 = new MockWatcher();
      mockWatch.mockReturnValueOnce(mockWatcher1).mockReturnValueOnce(mockWatcher2);

      startWatching('/test/project1', 'plan');
      startWatching('/test/project2', 'mockup');

      stopAllWatchers();

      expect(mockWatcher1.close).toHaveBeenCalled();
      expect(mockWatcher2.close).toHaveBeenCalled();
      expect(isWatching('/test/project1', 'plan')).toBe(false);
      expect(isWatching('/test/project2', 'mockup')).toBe(false);
    });

    it('should handle being called when no watchers exist', () => {
      expect(() => stopAllWatchers()).not.toThrow();
    });
  });

  describe('isWatching', () => {
    it('should return true when watching', () => {
      startWatching('/test/project', 'plan');

      expect(isWatching('/test/project', 'plan')).toBe(true);
    });

    it('should return false when not watching', () => {
      expect(isWatching('/test/project', 'plan')).toBe(false);
    });

    it('should distinguish between file types', () => {
      startWatching('/test/project', 'plan');

      expect(isWatching('/test/project', 'plan')).toBe(true);
      expect(isWatching('/test/project', 'mockup')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle watcher errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      startWatching('/test/project', 'plan');
      mockWatcher.emit('error', new Error('Watcher error'));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
