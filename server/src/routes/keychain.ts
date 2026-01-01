import { Router, Request, Response } from 'express';
import { execSync, spawnSync } from 'child_process';
import os from 'os';

const router = Router();

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

export default router;
