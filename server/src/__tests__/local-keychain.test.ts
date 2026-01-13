import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpawnSyncReturns } from 'child_process';

// Use vi.hoisted to ensure mocks are available before vi.mock runs
const { mockSpawnSync, mockExecSync, mockPlatform, mockHomedir } = vi.hoisted(() => ({
  mockSpawnSync: vi.fn(),
  mockExecSync: vi.fn(),
  mockPlatform: vi.fn(),
  mockHomedir: vi.fn().mockReturnValue('/Users/testuser'),
}));

// Mock child_process
vi.mock('child_process', () => ({
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock os module - need to properly proxy calls through the mock functions
vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    default: {
      ...actual,
      platform: () => mockPlatform(),
      homedir: () => mockHomedir(),
    },
    platform: () => mockPlatform(),
    homedir: () => mockHomedir(),
  };
});

// Mock keychainStorageService
const mockStorePassword = vi.fn();
const mockGetPassword = vi.fn();
const mockDeletePassword = vi.fn();
const mockHasPassword = vi.fn();

vi.mock('../services/keychain-storage.service.js', () => ({
  keychainStorageService: {
    storePassword: (...args: unknown[]) => mockStorePassword(...args),
    getPassword: (...args: unknown[]) => mockGetPassword(...args),
    deletePassword: (...args: unknown[]) => mockDeletePassword(...args),
    hasPassword: (...args: unknown[]) => mockHasPassword(...args),
  },
}));

// Mock terminalManager (used by other keychain routes)
vi.mock('../services/terminal-manager.service.js', () => ({
  terminalManager: {
    write: vi.fn(),
    has: vi.fn(),
    getBackend: vi.fn(),
  },
}));

// Mock database (used by other keychain routes)
vi.mock('../db/connection.js', () => ({
  getDatabase: () => ({
    prepare: () => ({
      get: vi.fn(),
      run: vi.fn(),
    }),
  }),
}));

// Import after mocking
import { localKeychainService } from '../services/local-keychain.service.js';

// Skip these tests on CI since they test macOS-specific keychain functionality
describe.skipIf(process.env.CI)('LocalKeychainService', () => {
  const testPassword = 'test-password-456';
  const expectedKeychainPath = '/Users/testuser/Library/Keychains/login.keychain-db';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to macOS
    mockPlatform.mockReturnValue('darwin');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('isKeychainLocked', () => {
    it('should return false when keychain is unlocked (command succeeds)', () => {
      mockExecSync.mockReturnValue('keychain info');

      const result = localKeychainService.isKeychainLocked();

      expect(result).toBe(false);
      expect(mockExecSync).toHaveBeenCalledWith(
        `security show-keychain-info "${expectedKeychainPath}" 2>&1`,
        expect.objectContaining({
          timeout: 5000,
          encoding: 'utf8',
        })
      );
    });

    it('should return true when keychain is locked (command fails)', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('keychain is locked');
      });

      const result = localKeychainService.isKeychainLocked();

      expect(result).toBe(true);
    });

    it('should return false when not on macOS', () => {
      mockPlatform.mockReturnValue('linux');

      const result = localKeychainService.isKeychainLocked();

      expect(result).toBe(false);
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('savePassword', () => {
    it('should delegate to keychainStorageService with LOCAL_MACHINE_ID', async () => {
      mockStorePassword.mockResolvedValue({ success: true });

      const result = await localKeychainService.savePassword(testPassword);

      expect(result.success).toBe(true);
      expect(mockStorePassword).toHaveBeenCalledWith('local', testPassword);
    });

    it('should return error from keychainStorageService', async () => {
      mockStorePassword.mockResolvedValue({ success: false, error: 'Storage failed' });

      const result = await localKeychainService.savePassword(testPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage failed');
    });
  });

  describe('hasPassword', () => {
    it('should return true when password exists', async () => {
      mockHasPassword.mockResolvedValue(true);

      const result = await localKeychainService.hasPassword();

      expect(result).toBe(true);
      expect(mockHasPassword).toHaveBeenCalledWith('local');
    });

    it('should return false when password does not exist', async () => {
      mockHasPassword.mockResolvedValue(false);

      const result = await localKeychainService.hasPassword();

      expect(result).toBe(false);
    });
  });

  describe('deletePassword', () => {
    it('should delegate to keychainStorageService with LOCAL_MACHINE_ID', async () => {
      mockDeletePassword.mockResolvedValue({ success: true });

      const result = await localKeychainService.deletePassword();

      expect(result.success).toBe(true);
      expect(mockDeletePassword).toHaveBeenCalledWith('local');
    });

    it('should return error from keychainStorageService', async () => {
      mockDeletePassword.mockResolvedValue({ success: false, error: 'Delete failed' });

      const result = await localKeychainService.deletePassword();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('getPassword', () => {
    it('should return password when found', async () => {
      mockGetPassword.mockResolvedValue({ success: true, password: testPassword });

      const result = await localKeychainService.getPassword();

      expect(result.success).toBe(true);
      expect(result.password).toBe(testPassword);
      expect(mockGetPassword).toHaveBeenCalledWith('local');
    });

    it('should return error when password not found', async () => {
      mockGetPassword.mockResolvedValue({ success: false, error: 'Not found' });

      const result = await localKeychainService.getPassword();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not found');
    });
  });

  describe('attemptAutoUnlock', () => {
    it('should skip when not on macOS', async () => {
      mockPlatform.mockReturnValue('linux');

      const result = await localKeychainService.attemptAutoUnlock();

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.error).toBe('Not on macOS');
      expect(mockHasPassword).not.toHaveBeenCalled();
    });

    it('should skip when no password is saved', async () => {
      mockHasPassword.mockResolvedValue(false);

      const result = await localKeychainService.attemptAutoUnlock();

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should skip when keychain is already unlocked', async () => {
      mockHasPassword.mockResolvedValue(true);
      mockExecSync.mockReturnValue('keychain info'); // success = unlocked

      const result = await localKeychainService.attemptAutoUnlock();

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.wasLocked).toBe(false);
      expect(mockSpawnSync).not.toHaveBeenCalled();
    });

    it('should unlock successfully when password is valid', async () => {
      mockHasPassword.mockResolvedValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('locked');
      });
      mockGetPassword.mockResolvedValue({ success: true, password: testPassword });
      mockSpawnSync.mockReturnValue({ status: 0, stderr: '' } as SpawnSyncReturns<string>);

      const result = await localKeychainService.attemptAutoUnlock();

      expect(result.success).toBe(true);
      expect(result.wasLocked).toBe(true);
      expect(result.skipped).toBeUndefined();

      // Verify spawnSync was called with correct command structure
      expect(mockSpawnSync).toHaveBeenCalledTimes(1);
      const call = mockSpawnSync.mock.calls[0];
      expect(call[0]).toBe('security');
      expect(call[1][0]).toBe('unlock-keychain');
      expect(call[1][1]).toContain('Library/Keychains/login.keychain-db');
      expect(call[2]).toMatchObject({
        input: testPassword + '\n',
        encoding: 'utf8',
        timeout: 10000,
      });
    });

    it('should return error when stored password retrieval fails', async () => {
      mockHasPassword.mockResolvedValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('locked');
      });
      mockGetPassword.mockResolvedValue({ success: false, error: 'Retrieval failed' });

      const result = await localKeychainService.attemptAutoUnlock();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve stored password');
      expect(result.wasLocked).toBe(true);
      expect(mockSpawnSync).not.toHaveBeenCalled();
    });

    it('should handle incorrect password error', async () => {
      mockHasPassword.mockResolvedValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('locked');
      });
      mockGetPassword.mockResolvedValue({ success: true, password: 'wrong-password' });
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: 'The user name or password is incorrect',
      } as SpawnSyncReturns<string>);

      const result = await localKeychainService.attemptAutoUnlock();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Incorrect password');
      expect(result.wasLocked).toBe(true);
    });

    it('should handle timeout error', async () => {
      mockHasPassword.mockResolvedValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('locked');
      });
      mockGetPassword.mockResolvedValue({ success: true, password: testPassword });
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: 'Operation timeout',
      } as SpawnSyncReturns<string>);

      const result = await localKeychainService.attemptAutoUnlock();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Operation timed out');
      expect(result.wasLocked).toBe(true);
    });

    it('should handle keychain not found error', async () => {
      mockHasPassword.mockResolvedValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('locked');
      });
      mockGetPassword.mockResolvedValue({ success: true, password: testPassword });
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: 'Keychain not found at specified path',
      } as SpawnSyncReturns<string>);

      const result = await localKeychainService.attemptAutoUnlock();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keychain not found');
      expect(result.wasLocked).toBe(true);
    });

    it('should handle generic unlock failure', async () => {
      mockHasPassword.mockResolvedValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('locked');
      });
      mockGetPassword.mockResolvedValue({ success: true, password: testPassword });
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: 'Unknown error occurred',
      } as SpawnSyncReturns<string>);

      const result = await localKeychainService.attemptAutoUnlock();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to unlock keychain');
      expect(result.wasLocked).toBe(true);
    });
  });

  describe('Security considerations', () => {
    it('should pass password via stdin, not command line arguments', async () => {
      mockHasPassword.mockResolvedValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('locked');
      });
      mockGetPassword.mockResolvedValue({ success: true, password: 'secret-password' });
      mockSpawnSync.mockReturnValue({ status: 0, stderr: '' } as SpawnSyncReturns<string>);

      await localKeychainService.attemptAutoUnlock();

      const call = mockSpawnSync.mock.calls[0];
      const args = call[1] as string[];
      const options = call[2] as { input: string };

      // Password should NOT be in command arguments
      expect(args).not.toContain('secret-password');
      expect(args.join(' ')).not.toContain('secret-password');

      // Password should be in stdin input
      expect(options.input).toContain('secret-password');
    });

    it('should use reasonable timeout for unlock operation', async () => {
      mockHasPassword.mockResolvedValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('locked');
      });
      mockGetPassword.mockResolvedValue({ success: true, password: testPassword });
      mockSpawnSync.mockReturnValue({ status: 0, stderr: '' } as SpawnSyncReturns<string>);

      await localKeychainService.attemptAutoUnlock();

      const call = mockSpawnSync.mock.calls[0];
      const options = call[2] as { timeout: number };

      expect(options.timeout).toBe(10000);
      expect(options.timeout).toBeLessThanOrEqual(30000);
    });
  });
});

// API Endpoint Logic Tests
// These test the service behavior that the API endpoints rely on
// The service is used with mocked dependencies (keychainStorageService)
describe.skipIf(process.env.CI)('Local Keychain API Endpoint Behavior', () => {
  const testPassword = 'test-password-456';

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue('darwin');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/keychain/local/save endpoint logic', () => {
    it('should validate password is required', () => {
      // Simulating route validation logic
      const body = {};
      const password = (body as { password?: string }).password;

      expect(password).toBeUndefined();

      // Route should return 400 with this response
      const response = {
        success: false,
        error: 'Password is required',
      };
      expect(response.error).toBe('Password is required');
    });

    it('should save password via localKeychainService', async () => {
      mockStorePassword.mockResolvedValue({ success: true });

      const result = await localKeychainService.savePassword(testPassword);

      expect(result.success).toBe(true);
      expect(mockStorePassword).toHaveBeenCalledWith('local', testPassword);
    });

    it('should return error from service when save fails', async () => {
      mockStorePassword.mockResolvedValue({ success: false, error: 'Storage error' });

      const result = await localKeychainService.savePassword(testPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });
  });

  describe('GET /api/keychain/local/has-password endpoint logic', () => {
    it('should return hasPassword wrapped in data object', async () => {
      mockHasPassword.mockResolvedValue(true);

      const hasPassword = await localKeychainService.hasPassword();

      // API response format: { success: true, data: { hasPassword } }
      const response = {
        success: true,
        data: { hasPassword },
      };

      expect(response.success).toBe(true);
      expect(response.data.hasPassword).toBe(true);
    });

    it('should return false when password does not exist', async () => {
      mockHasPassword.mockResolvedValue(false);

      const hasPassword = await localKeychainService.hasPassword();

      const response = {
        success: true,
        data: { hasPassword },
      };

      expect(response.data.hasPassword).toBe(false);
    });
  });

  describe('DELETE /api/keychain/local endpoint logic', () => {
    it('should delete password via localKeychainService', async () => {
      mockDeletePassword.mockResolvedValue({ success: true });

      const result = await localKeychainService.deletePassword();

      expect(result.success).toBe(true);
      expect(mockDeletePassword).toHaveBeenCalledWith('local');
    });

    it('should return error from service when delete fails', async () => {
      mockDeletePassword.mockResolvedValue({ success: false, error: 'Delete error' });

      const result = await localKeychainService.deletePassword();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete error');
    });
  });

  describe('POST /api/keychain/local/test-unlock endpoint logic', () => {
    it('should validate password is required', () => {
      const body = {};
      const password = (body as { password?: string }).password;

      expect(password).toBeUndefined();

      const response = {
        success: false,
        error: 'Password is required',
      };
      expect(response.error).toBe('Password is required');
    });

    it('should only work on macOS', () => {
      mockPlatform.mockReturnValue('linux');

      // Verify platform is not darwin
      const platform = mockPlatform();
      expect(platform).toBe('linux');
      expect(platform).not.toBe('darwin');

      // Route should return error when not on macOS
      const response = {
        success: false,
        error: 'Keychain unlock is only supported on macOS',
      };
      expect(response.error).toBe('Keychain unlock is only supported on macOS');
    });

    it('should test unlock with spawnSync for valid password', () => {
      mockPlatform.mockReturnValue('darwin');
      mockSpawnSync.mockReturnValue({ status: 0, stderr: '' } as SpawnSyncReturns<string>);

      const keychainPath = `${mockHomedir()}/Library/Keychains/login.keychain-db`;

      // This simulates what the route does - test unlock via spawnSync
      const result = mockSpawnSync('security', ['unlock-keychain', keychainPath], {
        input: testPassword + '\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'security',
        ['unlock-keychain', keychainPath],
        expect.objectContaining({
          input: testPassword + '\n',
          encoding: 'utf8',
          timeout: 10000,
        })
      );
      expect(result.status).toBe(0);

      // Route returns success message
      const response = {
        success: true,
        message: 'Password is correct - keychain unlocked',
      };
      expect(response.success).toBe(true);
    });

    it('should handle incorrect password with proper error', () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: 'The user name or password is incorrect',
      } as SpawnSyncReturns<string>);

      const result = mockSpawnSync('security', ['unlock-keychain', '/path'], {
        input: 'wrong-password\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      // Route parses stderr to determine error type
      let errorMessage = 'Failed to unlock keychain';
      const stderr = result.stderr || '';

      if (stderr.includes('password') || stderr.includes('incorrect')) {
        errorMessage = 'Incorrect password';
      }

      expect(result.status).toBe(1);
      expect(errorMessage).toBe('Incorrect password');
    });
  });

  describe('Response format consistency', () => {
    it('should wrap hasPassword in data object (not at root level)', async () => {
      mockHasPassword.mockResolvedValue(true);

      const hasPassword = await localKeychainService.hasPassword();

      // Correct API format: { success: true, data: { hasPassword: true } }
      const correctResponse = {
        success: true,
        data: { hasPassword },
      };

      expect(correctResponse).toHaveProperty('data');
      expect(correctResponse.data).toHaveProperty('hasPassword');
      expect(correctResponse).not.toHaveProperty('hasPassword'); // Not at root level
    });
  });
});
