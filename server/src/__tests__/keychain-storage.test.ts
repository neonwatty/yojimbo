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

  describe('verifyKeychainUnlocked', () => {
    const machineId = 'verify-test-machine';

    beforeEach(() => {
      keychainStorageService.clearAllUnlockState();
    });

    it('should return isUnlocked: true when keychain is unlocked', async () => {
      const mockExecuteCommand = vi.fn().mockResolvedValue({
        success: true,
        stdout: 'Keychain "/Users/test/Library/Keychains/login.keychain-db" no-timeout lock-on-sleep',
        stderr: '',
      });

      const result = await keychainStorageService.verifyKeychainUnlocked(
        machineId,
        mockExecuteCommand
      );

      expect(result.success).toBe(true);
      expect(result.isUnlocked).toBe(true);
      expect(result.verificationMethod).toBe('show-keychain-info');
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        machineId,
        'security show-keychain-info ~/Library/Keychains/login.keychain-db 2>&1'
      );
    });

    it('should return isUnlocked: false when keychain is locked', async () => {
      const mockExecuteCommand = vi.fn().mockResolvedValue({
        success: true,
        stdout: 'Keychain "/Users/test/Library/Keychains/login.keychain-db" is locked',
        stderr: '',
      });

      const result = await keychainStorageService.verifyKeychainUnlocked(
        machineId,
        mockExecuteCommand
      );

      expect(result.success).toBe(true);
      expect(result.isUnlocked).toBe(false);
      expect(result.error).toBe('Keychain is locked');
    });

    it('should handle SSH command failures', async () => {
      const mockExecuteCommand = vi.fn().mockRejectedValue(new Error('SSH connection failed'));

      const result = await keychainStorageService.verifyKeychainUnlocked(
        machineId,
        mockExecuteCommand
      );

      expect(result.success).toBe(false);
      expect(result.isUnlocked).toBe(false);
      expect(result.error).toBe('SSH connection failed');
    });
  });

  describe('unlockWithVerification', () => {
    const machineId = 'unlock-verify-test';
    const machineName = 'Test Machine';

    beforeEach(() => {
      keychainStorageService.clearAllUnlockState();
      // Mock getPassword to return a test password
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: 'test-password\n',
        stderr: '',
      } as SpawnSyncReturns<string>);
    });

    it('should return already unlocked when machine is verified unlocked', async () => {
      // Mark as unlocked in session cache
      keychainStorageService.markUnlocked(machineId);

      const mockExecuteCommand = vi.fn().mockResolvedValue({
        success: true,
        stdout: 'Keychain unlocked with no-timeout',
        stderr: '',
      });

      const result = await keychainStorageService.unlockWithVerification(
        machineId,
        machineName,
        mockExecuteCommand
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(0);
      expect(result.verified).toBe(true);
    });

    it('should unlock and verify successfully', async () => {
      const mockExecuteCommand = vi.fn()
        .mockResolvedValueOnce({
          success: true,
          stdout: '',
          stderr: '',
        })
        .mockResolvedValueOnce({
          success: true,
          stdout: 'Keychain no-timeout lock-on-sleep',
          stderr: '',
        });

      const result = await keychainStorageService.unlockWithVerification(
        machineId,
        machineName,
        mockExecuteCommand
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.verified).toBe(true);
      expect(keychainStorageService.isUnlocked(machineId)).toBe(true);
    });

    it('should fail immediately on incorrect password', async () => {
      const mockExecuteCommand = vi.fn().mockResolvedValue({
        success: false,
        stdout: 'security: SecKeychainUnlock: The user name or passphrase you entered is not correct.',
        stderr: '',
      });

      const result = await keychainStorageService.unlockWithVerification(
        machineId,
        machineName,
        mockExecuteCommand
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.error).toContain('Incorrect password');
      expect(keychainStorageService.isUnlocked(machineId)).toBe(false);
    });

    it('should return error when no stored password', async () => {
      // Mock no password stored
      mockSpawnSync.mockReturnValue({
        status: 44,
        stdout: '',
        stderr: 'security: SecKeychainSearchCopyNext: The specified item could not be found.',
      } as SpawnSyncReturns<string>);

      const mockExecuteCommand = vi.fn();

      const result = await keychainStorageService.unlockWithVerification(
        machineId,
        machineName,
        mockExecuteCommand
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No stored password found');
      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    it('should retry on verification failure up to max attempts', async () => {
      // All verification attempts fail (keychain appears locked)
      const mockExecuteCommand = vi.fn()
        .mockResolvedValue({
          success: true,
          stdout: 'Keychain is locked',
          stderr: '',
        });

      const result = await keychainStorageService.unlockWithVerification(
        machineId,
        machineName,
        mockExecuteCommand
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // MAX_UNLOCK_ATTEMPTS
      expect(result.error).toContain('Keychain is locked');
    }, 10000); // Increase timeout due to retry delays
  });

  describe('getKeychainStatus', () => {
    const machineId = 'status-test-machine';

    beforeEach(() => {
      keychainStorageService.clearAllUnlockState();
    });

    it('should return full status with SSH verification', async () => {
      // Mock password exists
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: 'test-password',
        stderr: '',
      } as SpawnSyncReturns<string>);

      const mockExecuteCommand = vi.fn().mockResolvedValue({
        success: true,
        stdout: 'Keychain no-timeout lock-on-sleep',
        stderr: '',
      });

      const status = await keychainStorageService.getKeychainStatus(
        machineId,
        mockExecuteCommand
      );

      expect(status.hasStoredPassword).toBe(true);
      expect(status.actuallyUnlocked).toBe(true);
      // Should update session cache to reflect reality
      expect(status.sessionUnlocked).toBe(true);
      expect(keychainStorageService.isUnlocked(machineId)).toBe(true);
    });

    it('should update session cache when verification shows locked', async () => {
      // Mark as unlocked in session
      keychainStorageService.markUnlocked(machineId);

      // Mock password exists
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: 'test-password',
        stderr: '',
      } as SpawnSyncReturns<string>);

      // But verification shows locked
      const mockExecuteCommand = vi.fn().mockResolvedValue({
        success: true,
        stdout: 'Keychain is locked',
        stderr: '',
      });

      const status = await keychainStorageService.getKeychainStatus(
        machineId,
        mockExecuteCommand
      );

      expect(status.actuallyUnlocked).toBe(false);
      // Session should be updated to match reality
      expect(status.sessionUnlocked).toBe(false);
      expect(keychainStorageService.isUnlocked(machineId)).toBe(false);
    });

    it('should return verification error when SSH fails', async () => {
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: 'test-password',
        stderr: '',
      } as SpawnSyncReturns<string>);

      const mockExecuteCommand = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const status = await keychainStorageService.getKeychainStatus(
        machineId,
        mockExecuteCommand
      );

      expect(status.hasStoredPassword).toBe(true);
      expect(status.verificationError).toBe('Connection refused');
    });
  });
});
