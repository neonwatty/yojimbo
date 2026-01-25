import { spawnSync } from 'child_process';
import os from 'os';

const SERVICE_NAME = 'com.yojimbo.remote-keychain';

interface KeychainResult {
  success: boolean;
  error?: string;
}

interface PasswordResult extends KeychainResult {
  password?: string;
}

/**
 * Keychain Storage Service
 * Uses the LOCAL macOS Keychain to securely store remote machine keychain passwords.
 * This leverages OS-level encryption and Touch ID/password protection.
 *
 * Also tracks which remote machines have unlocked keychains in this server session
 * to avoid redundant unlock attempts.
 */
class KeychainStorageService {
  // Track which machines have unlocked keychains in this server session
  // Note: This resets when the server restarts (by design - keychains lock on sleep/reboot)
  private unlockedMachines: Set<string> = new Set();
  /**
   * Check if we're running on macOS
   */
  private isMacOS(): boolean {
    return os.platform() === 'darwin';
  }

  /**
   * Store a remote machine's keychain password in the local keychain
   */
  async storePassword(machineId: string, password: string): Promise<KeychainResult> {
    if (!this.isMacOS()) {
      return { success: false, error: 'Keychain storage is only supported on macOS' };
    }

    if (!machineId || !password) {
      return { success: false, error: 'Machine ID and password are required' };
    }

    const accountName = `remote-${machineId}`;

    // First, try to delete any existing entry (ignore errors)
    spawnSync('security', [
      'delete-generic-password',
      '-a', accountName,
      '-s', SERVICE_NAME,
    ], { encoding: 'utf8' });

    // Now add the new password
    const result = spawnSync('security', [
      'add-generic-password',
      '-a', accountName,
      '-s', SERVICE_NAME,
      '-w', password,
      '-U', // Update if exists
    ], {
      encoding: 'utf8',
      timeout: 10000,
    });

    if (result.status === 0) {
      console.log(`🔐 Stored keychain password for machine ${machineId}`);
      return { success: true };
    } else {
      const stderr = result.stderr || '';
      console.error(`🔐 Failed to store keychain password:`, stderr);
      return { success: false, error: stderr || 'Failed to store password in keychain' };
    }
  }

  /**
   * Retrieve a remote machine's keychain password from the local keychain
   */
  async getPassword(machineId: string): Promise<PasswordResult> {
    if (!this.isMacOS()) {
      return { success: false, error: 'Keychain storage is only supported on macOS' };
    }

    if (!machineId) {
      return { success: false, error: 'Machine ID is required' };
    }

    const accountName = `remote-${machineId}`;

    const result = spawnSync('security', [
      'find-generic-password',
      '-a', accountName,
      '-s', SERVICE_NAME,
      '-w', // Output password only
    ], {
      encoding: 'utf8',
      timeout: 10000,
    });

    if (result.status === 0) {
      const password = result.stdout.trim();
      return { success: true, password };
    } else {
      // Check if it's just not found vs an actual error
      const stderr = result.stderr || '';
      if (stderr.includes('could not be found') || stderr.includes('SecKeychainSearchCopyNext')) {
        return { success: false, error: 'No stored password found for this machine' };
      }
      return { success: false, error: stderr || 'Failed to retrieve password from keychain' };
    }
  }

  /**
   * Delete a remote machine's keychain password from the local keychain
   */
  async deletePassword(machineId: string): Promise<KeychainResult> {
    if (!this.isMacOS()) {
      return { success: false, error: 'Keychain storage is only supported on macOS' };
    }

    if (!machineId) {
      return { success: false, error: 'Machine ID is required' };
    }

    const accountName = `remote-${machineId}`;

    const result = spawnSync('security', [
      'delete-generic-password',
      '-a', accountName,
      '-s', SERVICE_NAME,
    ], {
      encoding: 'utf8',
      timeout: 10000,
    });

    if (result.status === 0) {
      console.log(`🔐 Deleted keychain password for machine ${machineId}`);
      return { success: true };
    } else {
      const stderr = result.stderr || '';
      if (stderr.includes('could not be found') || stderr.includes('SecKeychainSearchCopyNext')) {
        // Already deleted or never existed - that's fine
        return { success: true };
      }
      return { success: false, error: stderr || 'Failed to delete password from keychain' };
    }
  }

  /**
   * Check if a password is stored for a remote machine
   */
  async hasPassword(machineId: string): Promise<boolean> {
    const result = await this.getPassword(machineId);
    return result.success && !!result.password;
  }

  // ============================================
  // Machine Unlock State Tracking
  // ============================================
  // Tracks which machines have had their keychains unlocked in this session.
  // This allows us to skip redundant unlock attempts for multiple instances
  // on the same machine.

  /**
   * Check if a machine's keychain has been unlocked in this session
   */
  isUnlocked(machineId: string): boolean {
    return this.unlockedMachines.has(machineId);
  }

  /**
   * Mark a machine's keychain as unlocked for this session
   */
  markUnlocked(machineId: string): void {
    this.unlockedMachines.add(machineId);
    console.log(`🔓 Machine ${machineId} keychain marked as unlocked for this session`);
  }

  /**
   * Mark a machine's keychain as locked (e.g., after sleep/disconnect)
   */
  markLocked(machineId: string): void {
    this.unlockedMachines.delete(machineId);
    console.log(`🔒 Machine ${machineId} keychain marked as locked`);
  }

  /**
   * Clear all unlock state (e.g., on server restart)
   */
  clearAllUnlockState(): void {
    this.unlockedMachines.clear();
  }
}

export const keychainStorageService = new KeychainStorageService();
