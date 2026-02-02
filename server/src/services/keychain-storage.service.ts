import { spawnSync } from 'child_process';
import os from 'os';
import type { KeychainVerificationResult, KeychainUnlockResult } from '@cc-orchestrator/shared';

const SERVICE_NAME = 'com.yojimbo.remote-keychain';

// Maximum number of unlock retry attempts
const MAX_UNLOCK_ATTEMPTS = 3;

// Delay between retry attempts in milliseconds
const RETRY_DELAY_MS = 1000;

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

  // ============================================
  // Keychain Verification Methods
  // ============================================
  // These methods verify keychain state via SSH

  /**
   * Verify if the remote keychain is currently unlocked by running
   * `security show-keychain-info` on the remote machine.
   *
   * @param machineId - The machine ID
   * @param executeCommand - A function to execute SSH commands
   * @returns Verification result with unlock status
   */
  async verifyKeychainUnlocked(
    machineId: string,
    executeCommand: (machineId: string, command: string) => Promise<{ success: boolean; stdout: string; stderr?: string }>
  ): Promise<KeychainVerificationResult> {
    const keychainPath = '~/Library/Keychains/login.keychain-db';
    const verifyCmd = `security show-keychain-info ${keychainPath} 2>&1`;

    try {
      const result = await executeCommand(machineId, verifyCmd);

      // Parse the output to determine lock state
      // When unlocked: "Keychain "<path>" no-timeout lock-on-sleep"
      // When locked: "Keychain "<path>" is locked" or error about locked keychain
      const output = result.stdout + (result.stderr || '');
      const isLocked =
        output.toLowerCase().includes('is locked') ||
        output.toLowerCase().includes('seckeychaincopysearchlist') ||
        output.toLowerCase().includes('error');

      if (result.success && !isLocked) {
        return {
          success: true,
          isUnlocked: true,
          verificationMethod: 'show-keychain-info',
        };
      } else {
        return {
          success: true,
          isUnlocked: false,
          verificationMethod: 'show-keychain-info',
          error: isLocked ? 'Keychain is locked' : output,
        };
      }
    } catch (error) {
      return {
        success: false,
        isUnlocked: false,
        verificationMethod: 'show-keychain-info',
        error: error instanceof Error ? error.message : 'Failed to verify keychain status',
      };
    }
  }

  /**
   * Unlock a remote machine's keychain with verification and retry logic.
   * Will attempt up to MAX_UNLOCK_ATTEMPTS times, verifying after each attempt.
   *
   * @param machineId - The machine ID
   * @param machineName - The machine name for logging
   * @param executeCommand - A function to execute SSH commands
   * @returns Unlock result with attempt count and verification status
   */
  async unlockWithVerification(
    machineId: string,
    machineName: string,
    executeCommand: (machineId: string, command: string) => Promise<{ success: boolean; stdout: string; stderr?: string }>
  ): Promise<KeychainUnlockResult> {
    // Check if already unlocked in this session
    if (this.isUnlocked(machineId)) {
      // Verify it's actually still unlocked
      const verifyResult = await this.verifyKeychainUnlocked(machineId, executeCommand);
      if (verifyResult.success && verifyResult.isUnlocked) {
        return {
          success: true,
          machineId,
          machineName,
          attempts: 0,
          verified: true,
        };
      }
      // Not actually unlocked, clear the cached state
      this.markLocked(machineId);
    }

    // Get stored password
    const passwordResult = await this.getPassword(machineId);
    if (!passwordResult.success || !passwordResult.password) {
      return {
        success: false,
        machineId,
        machineName,
        attempts: 0,
        verified: false,
        error: 'No stored password found for this machine. Please save the keychain password first.',
      };
    }

    const keychainPath = '~/Library/Keychains/login.keychain-db';
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_UNLOCK_ATTEMPTS; attempt++) {
      console.log(`🔓 Attempting to unlock keychain for ${machineName} (attempt ${attempt}/${MAX_UNLOCK_ATTEMPTS})`);

      try {
        // Execute unlock command
        const escapedPassword = passwordResult.password
          .replace(/"/g, '\\"')
          .replace(/\$/g, '\\$');
        const unlockCmd = `bash -c 'echo "${escapedPassword}" | security unlock-keychain ${keychainPath} 2>&1'`;

        const result = await executeCommand(machineId, unlockCmd);

        // Check for errors in output
        const output = result.stdout + (result.stderr || '');
        const lowerOutput = output.toLowerCase();

        // Check for password-related errors (should not retry these)
        const isPasswordError =
          lowerOutput.includes('incorrect') ||
          lowerOutput.includes('not correct') ||
          lowerOutput.includes('bad password') ||
          lowerOutput.includes('passphrase you entered');

        const hasError = isPasswordError || lowerOutput.includes('error');

        if (hasError) {
          lastError = isPasswordError
            ? 'Incorrect password - please update the stored password'
            : `Unlock failed: ${output}`;

          // Don't retry on password errors
          if (isPasswordError) {
            return {
              success: false,
              machineId,
              machineName,
              attempts: attempt,
              verified: false,
              error: lastError,
            };
          }

          if (attempt < MAX_UNLOCK_ATTEMPTS) {
            console.log(`⏳ Unlock attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }
        }

        // Verify the unlock worked
        const verifyResult = await this.verifyKeychainUnlocked(machineId, executeCommand);

        if (verifyResult.success && verifyResult.isUnlocked) {
          // Mark as unlocked for this session
          this.markUnlocked(machineId);

          console.log(`✅ Keychain unlocked and verified for ${machineName} after ${attempt} attempt(s)`);

          return {
            success: true,
            machineId,
            machineName,
            attempts: attempt,
            verified: true,
          };
        } else {
          lastError = verifyResult.error || 'Verification failed after unlock attempt';
          console.log(`❌ Unlock verification failed for ${machineName}: ${lastError}`);

          if (attempt < MAX_UNLOCK_ATTEMPTS) {
            console.log(`⏳ Retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'SSH connection failed';
        console.error(`❌ Unlock attempt ${attempt} failed with error:`, error);

        if (attempt < MAX_UNLOCK_ATTEMPTS) {
          console.log(`⏳ Retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    return {
      success: false,
      machineId,
      machineName,
      attempts: MAX_UNLOCK_ATTEMPTS,
      verified: false,
      error: lastError || `Failed to unlock keychain after ${MAX_UNLOCK_ATTEMPTS} attempts`,
    };
  }

  /**
   * Get the current keychain status for a machine via SSH verification.
   *
   * @param machineId - The machine ID
   * @param executeCommand - A function to execute SSH commands
   * @returns Object with unlocked status and verification details
   */
  async getKeychainStatus(
    machineId: string,
    executeCommand: (machineId: string, command: string) => Promise<{ success: boolean; stdout: string; stderr?: string }>
  ): Promise<{
    hasStoredPassword: boolean;
    sessionUnlocked: boolean;
    actuallyUnlocked: boolean;
    verificationError?: string;
  }> {
    const hasStoredPassword = await this.hasPassword(machineId);
    const sessionUnlocked = this.isUnlocked(machineId);

    // Actually verify via SSH
    const verification = await this.verifyKeychainUnlocked(machineId, executeCommand);

    // Update our session cache based on reality
    if (verification.success) {
      if (verification.isUnlocked && !sessionUnlocked) {
        this.markUnlocked(machineId);
      } else if (!verification.isUnlocked && sessionUnlocked) {
        this.markLocked(machineId);
      }
    }

    return {
      hasStoredPassword,
      sessionUnlocked: this.isUnlocked(machineId),
      actuallyUnlocked: verification.isUnlocked,
      verificationError: verification.success ? undefined : verification.error,
    };
  }
}

export const keychainStorageService = new KeychainStorageService();
