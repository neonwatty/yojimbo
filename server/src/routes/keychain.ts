import { Router, Request, Response } from 'express';
import { execSync, spawnSync } from 'child_process';
import os from 'os';
import { keychainStorageService } from '../services/keychain-storage.service.js';
import { terminalManager } from '../services/terminal-manager.service.js';
import { getDatabase } from '../db/connection.js';

const router = Router();

interface InstanceRow {
  id: string;
  machine_id: string | null;
}

/**
 * POST /api/keychain/unlock
 * Unlocks the macOS login keychain using the provided password.
 *
 * Security considerations:
 * - Password is passed via stdin to avoid exposure in process list
 * - Only works on macOS (darwin)
 * - Password is not logged
 */
router.post('/unlock', (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
      });
    }

    // Only works on macOS
    if (os.platform() !== 'darwin') {
      return res.status(400).json({
        success: false,
        error: 'Keychain unlock is only supported on macOS',
      });
    }

    // Get the login keychain path
    const keychainPath = `${os.homedir()}/Library/Keychains/login.keychain-db`;

    // Use spawnSync to pass password via stdin (more secure than command line arg)
    const result = spawnSync('security', ['unlock-keychain', keychainPath], {
      input: password + '\n',
      encoding: 'utf8',
      timeout: 10000, // 10 second timeout
    });

    if (result.status === 0) {
      console.log('🔓 Keychain unlocked successfully');
      return res.json({
        success: true,
        message: 'Keychain unlocked successfully',
      });
    } else {
      // Check for common error patterns
      const stderr = result.stderr || '';
      let errorMessage = 'Failed to unlock keychain';

      if (stderr.includes('password') || stderr.includes('incorrect')) {
        errorMessage = 'Incorrect password';
      } else if (stderr.includes('timeout')) {
        errorMessage = 'Operation timed out';
      } else if (stderr.includes('not found')) {
        errorMessage = 'Keychain not found';
      }

      console.error('🔒 Keychain unlock failed:', stderr);
      return res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  } catch (error) {
    console.error('🔒 Keychain unlock error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while unlocking keychain',
    });
  }
});

/**
 * GET /api/keychain/status
 * Check if the keychain is currently locked.
 */
router.get('/status', (_req: Request, res: Response) => {
  try {
    // Only works on macOS
    if (os.platform() !== 'darwin') {
      return res.status(400).json({
        success: false,
        error: 'Keychain status is only supported on macOS',
      });
    }

    // Try to show keychain info - this will fail silently if locked
    // but we can check by trying a dummy operation
    const keychainPath = `${os.homedir()}/Library/Keychains/login.keychain-db`;

    try {
      // show-keychain-info returns 0 if unlocked, non-zero if locked
      execSync(`security show-keychain-info "${keychainPath}" 2>&1`, {
        timeout: 5000,
        encoding: 'utf8',
      });

      return res.json({
        success: true,
        locked: false,
        message: 'Keychain is unlocked',
      });
    } catch {
      // If the command fails, keychain is likely locked
      return res.json({
        success: true,
        locked: true,
        message: 'Keychain is locked',
      });
    }
  } catch (error) {
    console.error('Keychain status check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check keychain status',
    });
  }
});

// ============================================
// Remote Keychain Password Storage Endpoints
// ============================================
// These endpoints use the LOCAL macOS Keychain to securely store
// passwords for REMOTE machine keychains.

/**
 * POST /api/keychain/remote/:machineId/save
 * Store a remote machine's keychain password in the local keychain
 */
router.post('/remote/:machineId/save', async (req: Request, res: Response) => {
  try {
    const { machineId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
      });
    }

    const result = await keychainStorageService.storePassword(machineId, password);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Password stored securely in local keychain',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error storing remote keychain password:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to store password',
    });
  }
});

/**
 * GET /api/keychain/remote/:machineId/has-password
 * Check if a password is stored for a remote machine
 */
router.get('/remote/:machineId/has-password', async (req: Request, res: Response) => {
  try {
    const { machineId } = req.params;
    const hasPassword = await keychainStorageService.hasPassword(machineId);

    return res.json({
      success: true,
      hasPassword,
    });
  } catch (error) {
    console.error('Error checking remote keychain password:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check password status',
    });
  }
});

/**
 * DELETE /api/keychain/remote/:machineId
 * Delete a stored password for a remote machine
 */
router.delete('/remote/:machineId', async (req: Request, res: Response) => {
  try {
    const { machineId } = req.params;
    const result = await keychainStorageService.deletePassword(machineId);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Password deleted from local keychain',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error deleting remote keychain password:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete password',
    });
  }
});

/**
 * POST /api/keychain/remote/:instanceId/auto-unlock
 * Auto-unlock a remote machine's keychain using a stored password.
 * Retrieves the password from local keychain and sends the unlock command
 * to the remote terminal.
 */
router.post('/remote/:instanceId/auto-unlock', async (req: Request, res: Response) => {
  try {
    const { instanceId } = req.params;

    // Get the instance to find its machine ID
    const db = getDatabase();
    const instance = db.prepare('SELECT id, machine_id FROM instances WHERE id = ?')
      .get(instanceId) as InstanceRow | undefined;

    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
    }

    if (!instance.machine_id) {
      return res.status(400).json({
        success: false,
        error: 'Instance is not a remote instance',
      });
    }

    // Get the stored password
    const passwordResult = await keychainStorageService.getPassword(instance.machine_id);

    if (!passwordResult.success || !passwordResult.password) {
      return res.status(404).json({
        success: false,
        error: 'No stored password found for this machine. Please save the password first.',
      });
    }

    // Check if terminal exists
    if (!terminalManager.has(instanceId)) {
      return res.status(404).json({
        success: false,
        error: 'Terminal not found for this instance',
      });
    }

    // Send the unlock command to the remote terminal
    // Using the same approach as the KeychainUnlockModal
    const keychainPath = '~/Library/Keychains/login.keychain-db';
    const command = `security unlock-keychain -p "${passwordResult.password.replace(/"/g, '\\"')}" ${keychainPath}\n`;

    terminalManager.write(instanceId, command);

    console.log(`🔓 Sent auto-unlock command for instance ${instanceId}`);

    return res.json({
      success: true,
      message: 'Keychain unlock command sent to remote terminal',
    });
  } catch (error) {
    console.error('Error auto-unlocking remote keychain:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to auto-unlock keychain',
    });
  }
});

export default router;
