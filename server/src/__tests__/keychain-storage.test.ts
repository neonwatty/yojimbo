import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnSync, SpawnSyncReturns } from 'child_process';
import os from 'os';

// Mock the modules
vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}));

vi.mock('os', () => ({
  default: {
    platform: vi.fn(),
  },
}));

// Import after mocking
import { keychainStorageService } from '../services/keychain-storage.service.js';

const mockSpawnSync = spawnSync as unknown as ReturnType<typeof vi.fn>;
const mockPlatform = os.platform as unknown as ReturnType<typeof vi.fn>;

// Skip these tests on CI since they test macOS-specific keychain functionality
describe.skipIf(process.env.CI)('KeychainStorageService', () => {
  const testMachineId = 'test-machine-123';
  const testPassword = 'test-password-456';
  const expectedAccountName = `remote-${testMachineId}`;
  const expectedServiceName = 'com.yojimbo.remote-keychain';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to macOS
    mockPlatform.mockReturnValue('darwin');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('storePassword', () => {
    it('should store password successfully on macOS', async () => {
      // First call is delete (ignore result), second is add
      mockSpawnSync
        .mockReturnValueOnce({ status: 0 } as SpawnSyncReturns<string>) // delete
        .mockReturnValueOnce({ status: 0, stderr: '' } as SpawnSyncReturns<string>); // add

      const result = await keychainStorageService.storePassword(testMachineId, testPassword);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      // Verify delete was called first
      expect(mockSpawnSync).toHaveBeenNthCalledWith(1, 'security', [
        'delete-generic-password',
        '-a', expectedAccountName,
        '-s', expectedServiceName,
      ], { encoding: 'utf8' });

      // Verify add was called with correct params
      expect(mockSpawnSync).toHaveBeenNthCalledWith(2, 'security', [
        'add-generic-password',
        '-a', expectedAccountName,
        '-s', expectedServiceName,
        '-w', testPassword,
        '-U',
      ], { encoding: 'utf8', timeout: 10000 });
    });

    it('should return error when not on macOS', async () => {
      mockPlatform.mockReturnValue('linux');

      const result = await keychainStorageService.storePassword(testMachineId, testPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keychain storage is only supported on macOS');
      expect(mockSpawnSync).not.toHaveBeenCalled();
    });

    it('should return error when machineId is missing', async () => {
      const result = await keychainStorageService.storePassword('', testPassword);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Machine ID and password are required');
    });

    it('should return error when password is missing', async () => {
      const result = await keychainStorageService.storePassword(testMachineId, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Machine ID and password are required');
    });

    it('should handle keychain add failure', async () => {
      mockSpawnSync
        .mockReturnValueOnce({ status: 0 } as SpawnSyncReturns<string>) // delete
        .mockReturnValueOnce({
          status: 1,
          stderr: 'security: SecItemAdd: The specified item already exists in the keychain.'
        } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.storePassword(testMachineId, testPassword);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('getPassword', () => {
    it('should retrieve password successfully', async () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: testPassword + '\n',
        stderr: '',
      } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.getPassword(testMachineId);

      expect(result.success).toBe(true);
      expect(result.password).toBe(testPassword);

      expect(mockSpawnSync).toHaveBeenCalledWith('security', [
        'find-generic-password',
        '-a', expectedAccountName,
        '-s', expectedServiceName,
        '-w',
      ], { encoding: 'utf8', timeout: 10000 });
    });

    it('should return error when not on macOS', async () => {
      mockPlatform.mockReturnValue('win32');

      const result = await keychainStorageService.getPassword(testMachineId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keychain storage is only supported on macOS');
    });

    it('should return error when machineId is missing', async () => {
      const result = await keychainStorageService.getPassword('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Machine ID is required');
    });

    it('should handle password not found', async () => {
      mockSpawnSync.mockReturnValue({
        status: 44,
        stdout: '',
        stderr: 'security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.',
      } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.getPassword(testMachineId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No stored password found for this machine');
    });

    it('should handle other keychain errors', async () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'security: Unknown error occurred',
      } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.getPassword(testMachineId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
    });
  });

  describe('deletePassword', () => {
    it('should delete password successfully', async () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stderr: '',
      } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.deletePassword(testMachineId);

      expect(result.success).toBe(true);

      expect(mockSpawnSync).toHaveBeenCalledWith('security', [
        'delete-generic-password',
        '-a', expectedAccountName,
        '-s', expectedServiceName,
      ], { encoding: 'utf8', timeout: 10000 });
    });

    it('should return error when not on macOS', async () => {
      mockPlatform.mockReturnValue('linux');

      const result = await keychainStorageService.deletePassword(testMachineId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Keychain storage is only supported on macOS');
    });

    it('should return error when machineId is missing', async () => {
      const result = await keychainStorageService.deletePassword('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Machine ID is required');
    });

    it('should succeed even when password does not exist', async () => {
      mockSpawnSync.mockReturnValue({
        status: 44,
        stderr: 'security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.',
      } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.deletePassword(testMachineId);

      // Should still succeed - deleting something that doesn't exist is fine
      expect(result.success).toBe(true);
    });

    it('should handle other keychain errors', async () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: 'security: Access denied',
      } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.deletePassword(testMachineId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Access denied');
    });
  });

  describe('hasPassword', () => {
    it('should return true when password exists', async () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: testPassword,
        stderr: '',
      } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.hasPassword(testMachineId);

      expect(result).toBe(true);
    });

    it('should return false when password does not exist', async () => {
      mockSpawnSync.mockReturnValue({
        status: 44,
        stdout: '',
        stderr: 'security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.',
      } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.hasPassword(testMachineId);

      expect(result).toBe(false);
    });

    it('should return false when not on macOS', async () => {
      mockPlatform.mockReturnValue('linux');

      const result = await keychainStorageService.hasPassword(testMachineId);

      expect(result).toBe(false);
    });

    it('should return false on keychain error', async () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'security: Unknown error',
      } as SpawnSyncReturns<string>);

      const result = await keychainStorageService.hasPassword(testMachineId);

      expect(result).toBe(false);
    });
  });

  describe('Machine Unlock State Tracking', () => {
    const machineId1 = 'machine-1';
    const machineId2 = 'machine-2';

    beforeEach(() => {
      // Clear any existing unlock state
      keychainStorageService.clearAllUnlockState();
    });

    it('should initially report machines as not unlocked', () => {
      expect(keychainStorageService.isUnlocked(machineId1)).toBe(false);
      expect(keychainStorageService.isUnlocked(machineId2)).toBe(false);
    });

    it('should mark a machine as unlocked', () => {
      keychainStorageService.markUnlocked(machineId1);

      expect(keychainStorageService.isUnlocked(machineId1)).toBe(true);
      expect(keychainStorageService.isUnlocked(machineId2)).toBe(false);
    });

    it('should mark multiple machines as unlocked independently', () => {
      keychainStorageService.markUnlocked(machineId1);
      keychainStorageService.markUnlocked(machineId2);

      expect(keychainStorageService.isUnlocked(machineId1)).toBe(true);
      expect(keychainStorageService.isUnlocked(machineId2)).toBe(true);
    });

    it('should mark a machine as locked', () => {
      keychainStorageService.markUnlocked(machineId1);
      expect(keychainStorageService.isUnlocked(machineId1)).toBe(true);

      keychainStorageService.markLocked(machineId1);
      expect(keychainStorageService.isUnlocked(machineId1)).toBe(false);
    });

    it('should handle marking a non-unlocked machine as locked (no-op)', () => {
      keychainStorageService.markLocked(machineId1);
      expect(keychainStorageService.isUnlocked(machineId1)).toBe(false);
    });

    it('should clear all unlock state', () => {
      keychainStorageService.markUnlocked(machineId1);
      keychainStorageService.markUnlocked(machineId2);

      keychainStorageService.clearAllUnlockState();

      expect(keychainStorageService.isUnlocked(machineId1)).toBe(false);
      expect(keychainStorageService.isUnlocked(machineId2)).toBe(false);
    });

    it('should be idempotent for multiple unlock calls', () => {
      keychainStorageService.markUnlocked(machineId1);
      keychainStorageService.markUnlocked(machineId1);
      keychainStorageService.markUnlocked(machineId1);

      expect(keychainStorageService.isUnlocked(machineId1)).toBe(true);

      keychainStorageService.markLocked(machineId1);
      expect(keychainStorageService.isUnlocked(machineId1)).toBe(false);
    });
  });
});
