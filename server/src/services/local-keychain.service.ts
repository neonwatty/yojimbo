import { keychainStorageService } from './keychain-storage.service.js';
import { execSync } from 'child_process';
import os from 'os';

/**
 * Local Keychain Service
 * Manages auto-unlock for the LOCAL machine's keychain on server startup.
 * Uses the same keychain storage service as remote machines, with a special "local" ID.
 */

const LOCAL_MACHINE_ID = 'local';

interface UnlockResult {
  success: boolean;
  error?: string;
  wasLocked?: boolean;
  skipped?: boolean;
}

class LocalKeychainService {
  /**
   * Check if we're running on macOS
   */
  private isMacOS(): boolean {
    return os.platform() === 'darwin';
  }

  /**
   * Check if the login keychain is currently locked
   */
  isKeychainLocked(): boolean {
    if (!this.isMacOS()) return false;

    const keychainPath = `${os.homedir()}/Library/Keychains/login.keychain-db`;

    try {
      execSync(`security show-keychain-info "${keychainPath}" 2>&1`, {
        timeout: 5000,
        encoding: 'utf8',
      });
      return false; // Command succeeded = unlocked
    } catch {
      return true; // Command failed = locked
    }
  }

  /**
   * Save the local keychain password
   */
  async savePassword(password: string): Promise<{ success: boolean; error?: string }> {
    return keychainStorageService.storePassword(LOCAL_MACHINE_ID, password);
  }

  /**
   * Check if a local keychain password is saved
   */
  async hasPassword(): Promise<boolean> {
    return keychainStorageService.hasPassword(LOCAL_MACHINE_ID);
  }

  /**
   * Delete the saved local keychain password
   */
  async deletePassword(): Promise<{ success: boolean; error?: string }> {
    return keychainStorageService.deletePassword(LOCAL_MACHINE_ID);
  }

  /**
   * Get the saved local keychain password
   */
  async getPassword(): Promise<{ success: boolean; password?: string; error?: string }> {
    return keychainStorageService.getPassword(LOCAL_MACHINE_ID);
  }

  /**
   * Attempt to auto-unlock the local keychain using stored password.
   * Returns result indicating success, failure, or if unlock was skipped.
   */
  async attemptAutoUnlock(): Promise<UnlockResult> {
    if (!this.isMacOS()) {
      return { success: true, skipped: true, error: 'Not on macOS' };
    }

    // Check if we have a stored password
    const hasStoredPassword = await this.hasPassword();
    if (!hasStoredPassword) {
      console.log('🔐 No local keychain password saved, skipping auto-unlock');
      return { success: true, skipped: true };
    }

    // Check if keychain is already unlocked
    const isLocked = this.isKeychainLocked();
    if (!isLocked) {
      console.log('🔓 Local keychain already unlocked, skipping');
      return { success: true, skipped: true, wasLocked: false };
    }

    console.log('🔐 Local keychain is locked, attempting auto-unlock...');

    // Get the stored password
    const passwordResult = await this.getPassword();
    if (!passwordResult.success || !passwordResult.password) {
      console.error('🔐 Failed to retrieve stored password:', passwordResult.error);
      return { success: false, error: 'Failed to retrieve stored password', wasLocked: true };
    }

    // Attempt to unlock
    const { spawnSync } = await import('child_process');
    const keychainPath = `${os.homedir()}/Library/Keychains/login.keychain-db`;

    const result = spawnSync('security', ['unlock-keychain', keychainPath], {
      input: passwordResult.password + '\n',
      encoding: 'utf8',
      timeout: 10000,
    });

    if (result.status === 0) {
      console.log('🔓 Local keychain auto-unlocked successfully');
      return { success: true, wasLocked: true };
    } else {
      const stderr = result.stderr || '';
      let errorMessage = 'Failed to unlock keychain';

      if (stderr.includes('password') || stderr.includes('incorrect')) {
        errorMessage = 'Incorrect password';
      } else if (stderr.includes('timeout')) {
        errorMessage = 'Operation timed out';
      } else if (stderr.includes('not found')) {
        errorMessage = 'Keychain not found';
      }

      console.error('🔒 Local keychain auto-unlock failed:', errorMessage);
      return { success: false, error: errorMessage, wasLocked: true };
    }
  }
}

export const localKeychainService = new LocalKeychainService();
