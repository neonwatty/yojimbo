import { describe, it, expect, vi, beforeEach } from 'vitest';
import { homedir } from 'os';
import path from 'path';

// Mock fs and child_process before importing the service
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { existsSync } from 'fs';
import { spawn } from 'child_process';
import {
  expandPath,
  extractRepoName,
  validateClonePath,
  cloneRepository,
} from '../services/git-clone.service.js';

describe('git-clone.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('expandPath', () => {
    it('should expand ~ to home directory', () => {
      const result = expandPath('~/projects/test');
      expect(result).toBe(path.join(homedir(), 'projects/test'));
    });

    it('should handle paths starting with ~/', () => {
      const result = expandPath('~/Desktop/repo');
      expect(result).toBe(path.join(homedir(), 'Desktop/repo'));
    });

    it('should return absolute paths unchanged', () => {
      const result = expandPath('/absolute/path/to/dir');
      expect(result).toBe('/absolute/path/to/dir');
    });

    it('should resolve relative paths', () => {
      const result = expandPath('./relative/path');
      expect(result).toBe(path.resolve('./relative/path'));
    });

    it('should handle just ~', () => {
      const result = expandPath('~');
      expect(result).toBe(homedir());
    });
  });

  describe('extractRepoName', () => {
    it('should extract owner/repo from HTTPS URL', () => {
      expect(extractRepoName('https://github.com/owner/repo')).toBe('owner/repo');
      expect(extractRepoName('https://github.com/owner/repo.git')).toBe('owner/repo');
    });

    it('should extract owner/repo from SSH URL', () => {
      expect(extractRepoName('git@github.com:owner/repo.git')).toBe('owner/repo');
      expect(extractRepoName('git@github.com:owner/repo')).toBe('owner/repo');
    });

    it('should handle repos with dashes and underscores', () => {
      expect(extractRepoName('https://github.com/my-org/my_repo-name')).toBe('my-org/my_repo-name');
      expect(extractRepoName('git@github.com:my-org/my_repo-name.git')).toBe('my-org/my_repo-name');
    });

    it('should handle repos with dots in name', () => {
      expect(extractRepoName('https://github.com/owner/repo.js')).toBe('owner/repo.js');
      expect(extractRepoName('https://github.com/owner/vue.js.git')).toBe('owner/vue.js');
    });

    it('should return just the name for bare repo names', () => {
      expect(extractRepoName('my-repo')).toBe('my-repo');
      expect(extractRepoName('my-repo.git')).toBe('my-repo');
    });
  });

  describe('validateClonePath', () => {
    it('should return valid: true when directory does not exist but parent does', () => {
      vi.mocked(existsSync).mockImplementation((p) => {
        // Parent exists, target doesn't
        if (String(p).endsWith('/target')) return false;
        return true;
      });

      const result = validateClonePath('/some/path/target');

      expect(result.valid).toBe(true);
      expect(result.exists).toBe(false);
      expect(result.parentExists).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid: false when directory already exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const result = validateClonePath('/existing/dir');

      expect(result.valid).toBe(false);
      expect(result.exists).toBe(true);
      expect(result.error).toBe('Directory already exists');
    });

    it('should return valid: false when parent directory does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = validateClonePath('/nonexistent/parent/target');

      expect(result.valid).toBe(false);
      expect(result.parentExists).toBe(false);
      expect(result.error).toBe('Parent directory does not exist');
    });

    it('should return valid: false for empty path', () => {
      const result = validateClonePath('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path is required');
    });

    it('should return valid: false for whitespace-only path', () => {
      const result = validateClonePath('   ');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Path is required');
    });

    it('should expand ~ in paths', () => {
      vi.mocked(existsSync).mockImplementation((p) => {
        // Parent (Desktop) exists, target doesn't
        if (String(p).includes('new-repo')) return false;
        return true;
      });

      const result = validateClonePath('~/Desktop/new-repo');

      expect(result.expandedPath).toBe(path.join(homedir(), 'Desktop/new-repo'));
    });
  });

  describe('cloneRepository', () => {
    it('should return error if target path already exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await cloneRepository('https://github.com/owner/repo', '/existing/path');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should return error if parent directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await cloneRepository('https://github.com/owner/repo', '/no/parent/target');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should call git clone with correct arguments on valid path', async () => {
      const mockOn = vi.fn();
      const mockStderr = { on: vi.fn() };

      vi.mocked(existsSync).mockImplementation((p) => {
        // Parent exists, target doesn't
        if (String(p).includes('new-repo')) return false;
        return true;
      });

      vi.mocked(spawn).mockReturnValue({
        stderr: mockStderr,
        on: mockOn,
      } as any);

      // Simulate successful clone
      mockOn.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      });

      const expandedPath = path.join(homedir(), 'Desktop/new-repo');
      const result = await cloneRepository('https://github.com/owner/repo.git', '~/Desktop/new-repo');

      expect(spawn).toHaveBeenCalledWith(
        'git',
        ['clone', 'https://github.com/owner/repo.git', expandedPath],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.repoName).toBe('owner/repo');
      expect(result.gitRemote).toBe('https://github.com/owner/repo.git');
    });

    it('should return error on clone failure', async () => {
      const mockOn = vi.fn();
      const mockStderr = {
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from('fatal: repository not found'));
          }
        })
      };

      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('new-repo')) return false;
        return true;
      });

      vi.mocked(spawn).mockReturnValue({
        stderr: mockStderr,
        on: mockOn,
      } as any);

      // Simulate failed clone
      mockOn.mockImplementation((event, callback) => {
        if (event === 'close') {
          callback(128);
        }
      });

      const result = await cloneRepository('https://github.com/owner/nonexistent', '~/Desktop/new-repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('repository not found');
    });

    it('should handle spawn errors', async () => {
      const mockOn = vi.fn();
      const mockStderr = { on: vi.fn() };

      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('new-repo')) return false;
        return true;
      });

      vi.mocked(spawn).mockReturnValue({
        stderr: mockStderr,
        on: mockOn,
      } as any);

      // Simulate spawn error
      mockOn.mockImplementation((event, callback) => {
        if (event === 'error') {
          callback(new Error('git not found'));
        }
      });

      const result = await cloneRepository('https://github.com/owner/repo', '~/Desktop/new-repo');

      expect(result.success).toBe(false);
      expect(result.error).toContain('git not found');
    });
  });
});
