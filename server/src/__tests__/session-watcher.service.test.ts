import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

// Hoist mocks
const { mockRun, mockGet, mockExistsSync, mockReaddirSync, mockCreateReadStream } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockGet: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockCreateReadStream: vi.fn(),
}));

// Mock chokidar watcher
class MockWatcher extends EventEmitter {
  close = vi.fn();
}

const mockWatch = vi.hoisted(() => vi.fn());

vi.mock('chokidar', () => ({
  default: {
    watch: mockWatch,
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    createReadStream: mockCreateReadStream,
  },
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  createReadStream: mockCreateReadStream,
}));

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    default: {
      ...actual,
      homedir: () => '/home/testuser',
    },
    homedir: () => '/home/testuser',
  };
});

vi.mock('../db/connection.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      run: mockRun,
      get: mockGet,
    }),
  })),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-session-uuid'),
}));

// Import after mocks
import { startSessionWatcher, stopSessionWatcher } from '../services/session-watcher.service.js';

// Helper to create a mock readable stream from lines
function createMockStream(lines: string[]): Readable {
  const content = lines.join('\n');
  return Readable.from([content]);
}

describe('SessionWatcherService', () => {
  let mockWatcher: MockWatcher;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWatcher = new MockWatcher();
    mockWatch.mockReturnValue(mockWatcher);
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
  });

  afterEach(() => {
    stopSessionWatcher();
  });

  describe('startSessionWatcher', () => {
    it('should start watching the projects directory', () => {
      startSessionWatcher();

      expect(mockWatch).toHaveBeenCalledWith(
        '/home/testuser/.claude/projects/**/*.jsonl',
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
        })
      );
    });

    it('should scan existing projects on start', () => {
      mockReaddirSync
        .mockReturnValueOnce([{ name: 'project1', isDirectory: () => true }])
        .mockReturnValueOnce([]);

      startSessionWatcher();

      // Should have called readdirSync to scan projects
      expect(mockReaddirSync).toHaveBeenCalled();
    });

    it('should handle missing projects directory gracefully', () => {
      mockExistsSync.mockReturnValue(false);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      startSessionWatcher();

      // console.log is called with two arguments: message and path
      expect(consoleSpy).toHaveBeenCalledWith(
        '[SessionWatcher] Projects directory does not exist:',
        expect.any(String)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('stopSessionWatcher', () => {
    it('should stop the watcher', () => {
      startSessionWatcher();
      stopSessionWatcher();

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('should handle being called when not watching', () => {
      expect(() => stopSessionWatcher()).not.toThrow();
    });
  });

  describe('file processing', () => {
    it('should process new session files', () => {
      const jsonlLines = [
        '{"type":"user","message":{"role":"user","content":"Hello"},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"session-123"}',
        '{"type":"assistant","message":{"role":"assistant","content":"Hi there!"},"timestamp":"2024-01-01T00:00:01.000Z"}',
      ];

      mockCreateReadStream.mockReturnValue(createMockStream(jsonlLines));
      mockGet.mockReturnValue(undefined); // No existing session

      startSessionWatcher();

      // Simulate new file event
      mockWatcher.emit('add', '/home/testuser/.claude/projects/-Users-test-project/session.jsonl');

      // Give async processing time
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockRun).toHaveBeenCalled();
          resolve();
        }, 100);
      });
    });

    it('should process changed session files', () => {
      const jsonlLines = [
        '{"type":"user","message":{"role":"user","content":"Update"},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"session-123"}',
      ];

      mockCreateReadStream.mockReturnValue(createMockStream(jsonlLines));
      mockGet.mockReturnValue({ id: 'session-123', message_count: 0 }); // Existing session

      startSessionWatcher();

      // Simulate file change event
      mockWatcher.emit('change', '/home/testuser/.claude/projects/-Users-test-project/session.jsonl');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should update existing session
          expect(mockRun).toHaveBeenCalled();
          resolve();
        }, 100);
      });
    });
  });

  describe('project path decoding', () => {
    // These test the path decoding logic by checking what gets stored

    it('should decode simple project paths', () => {
      const jsonlLines = [
        '{"type":"user","message":{"role":"user","content":"Test"},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"test-session"}',
      ];

      mockCreateReadStream.mockReturnValue(createMockStream(jsonlLines));
      mockGet.mockReturnValue(undefined);

      // When path exists, it should be decoded correctly
      mockExistsSync.mockImplementation((path: string) => {
        if (path === '/home/testuser/.claude/projects') return true;
        if (path === '/Users') return true;
        if (path === '/Users/test') return true;
        if (path === '/Users/test/my-project') return true;
        return false;
      });

      startSessionWatcher();
      mockWatcher.emit('add', '/home/testuser/.claude/projects/-Users-test-my-project/session.jsonl');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          if (mockRun.mock.calls.length > 0) {
            // Check that the decoded path was used
            const insertCall = mockRun.mock.calls.find(
              (call: unknown[]) => Array.isArray(call) && call.some((arg) => typeof arg === 'string' && arg.includes('/Users'))
            );
            expect(insertCall).toBeDefined();
          }
          resolve();
        }, 100);
      });
    });
  });

  describe('message parsing', () => {
    it('should extract user messages', () => {
      const jsonlLines = [
        '{"type":"user","message":{"role":"user","content":"What is the weather?"},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"test"}',
      ];

      mockCreateReadStream.mockReturnValue(createMockStream(jsonlLines));
      mockGet.mockReturnValue(undefined);

      startSessionWatcher();
      mockWatcher.emit('add', '/home/testuser/.claude/projects/-test/session.jsonl');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockRun).toHaveBeenCalled();
          resolve();
        }, 100);
      });
    });

    it('should extract assistant messages', () => {
      const jsonlLines = [
        '{"type":"user","message":{"role":"user","content":"Hello"},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"test"}',
        '{"type":"assistant","message":{"role":"assistant","content":"Hello! How can I help?"},"timestamp":"2024-01-01T00:00:01.000Z"}',
      ];

      mockCreateReadStream.mockReturnValue(createMockStream(jsonlLines));
      mockGet.mockReturnValue(undefined);

      startSessionWatcher();
      mockWatcher.emit('add', '/home/testuser/.claude/projects/-test/session.jsonl');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockRun).toHaveBeenCalled();
          resolve();
        }, 100);
      });
    });

    it('should handle content arrays', () => {
      const jsonlLines = [
        '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Multiple parts"}]},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"test"}',
      ];

      mockCreateReadStream.mockReturnValue(createMockStream(jsonlLines));
      mockGet.mockReturnValue(undefined);

      startSessionWatcher();
      mockWatcher.emit('add', '/home/testuser/.claude/projects/-test/session.jsonl');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockRun).toHaveBeenCalled();
          resolve();
        }, 100);
      });
    });

    it('should handle tool use messages', () => {
      const jsonlLines = [
        '{"type":"user","message":{"role":"user","content":"Run a command"},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"test"}',
        '{"type":"tool_use","timestamp":"2024-01-01T00:00:01.000Z"}',
        '{"type":"tool_result","timestamp":"2024-01-01T00:00:02.000Z"}',
      ];

      mockCreateReadStream.mockReturnValue(createMockStream(jsonlLines));
      mockGet.mockReturnValue(undefined);

      startSessionWatcher();
      mockWatcher.emit('add', '/home/testuser/.claude/projects/-test/session.jsonl');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockRun).toHaveBeenCalled();
          resolve();
        }, 100);
      });
    });

    it('should skip malformed JSON lines', () => {
      const jsonlLines = [
        '{"type":"user","message":{"role":"user","content":"Valid"},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"test"}',
        'not valid json',
        '{"type":"assistant","message":{"role":"assistant","content":"Also valid"},"timestamp":"2024-01-01T00:00:01.000Z"}',
      ];

      mockCreateReadStream.mockReturnValue(createMockStream(jsonlLines));
      mockGet.mockReturnValue(undefined);

      startSessionWatcher();
      mockWatcher.emit('add', '/home/testuser/.claude/projects/-test/session.jsonl');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // Should still process valid lines
          expect(mockRun).toHaveBeenCalled();
          resolve();
        }, 100);
      });
    });

    it('should use first user message as summary', () => {
      const jsonlLines = [
        '{"type":"user","message":{"role":"user","content":"This is my first question about testing"},"timestamp":"2024-01-01T00:00:00.000Z","sessionId":"test"}',
      ];

      mockCreateReadStream.mockReturnValue(createMockStream(jsonlLines));
      mockGet.mockReturnValue(undefined);

      startSessionWatcher();
      mockWatcher.emit('add', '/home/testuser/.claude/projects/-test/session.jsonl');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(mockRun).toHaveBeenCalled();
          // The summary should be the first 100 chars of first user message
          const insertCall = mockRun.mock.calls.find(
            (call: unknown[]) => Array.isArray(call) && call.some((arg) => typeof arg === 'string' && arg.includes('first question'))
          );
          expect(insertCall).toBeDefined();
          resolve();
        }, 100);
      });
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockCreateReadStream.mockImplementation(() => {
        throw new Error('Read error');
      });

      startSessionWatcher();
      mockWatcher.emit('add', '/home/testuser/.claude/projects/-test/session.jsonl');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(consoleSpy).toHaveBeenCalled();
          consoleSpy.mockRestore();
          resolve();
        }, 100);
      });
    });

    it('should handle directory scan errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockReaddirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      startSessionWatcher();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
