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
 */
class KeychainStorageService {
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
}

export const keychainStorageService = new KeychainStorageService();
