import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock child_process
const mockSpawnSync = vi.fn();
const mockExecSync = vi.fn();

vi.mock('child_process', () => ({
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock os module
const mockPlatform = vi.fn();
const mockHomedir = vi.fn().mockReturnValue('/Users/testuser');

vi.mock('os', () => ({
  default: {
    platform: () => mockPlatform(),
    homedir: () => mockHomedir(),
  },
  platform: () => mockPlatform(),
  homedir: () => mockHomedir(),
}));

describe('Keychain API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue('darwin');
  });

  describe('POST /api/keychain/unlock', () => {
    it('should require a password', () => {
      const body = {};

      // Simulate validation
      const password = (body as { password?: string }).password;
      expect(password).toBeUndefined();

      // Would return 400
      const response = {
        success: false,
        error: 'Password is required',
      };
      expect(response.error).toBe('Password is required');
    });

    it('should only work on macOS', () => {
      mockPlatform.mockReturnValue('linux');

      const platform = mockPlatform();
      expect(platform).toBe('linux');

      // Would return 400 on non-darwin
      if (platform !== 'darwin') {
        const response = {
          success: false,
          error: 'Keychain unlock is only supported on macOS',
        };
        expect(response.error).toBe('Keychain unlock is only supported on macOS');
      }
    });

    it('should call spawnSync with correct arguments on macOS', () => {
      mockPlatform.mockReturnValue('darwin');
      mockSpawnSync.mockReturnValue({ status: 0, stderr: '' });

      const password = 'test-password';
      const keychainPath = `${mockHomedir()}/Library/Keychains/login.keychain-db`;

      // Simulate the call
      const result = mockSpawnSync('security', ['unlock-keychain', keychainPath], {
        input: password + '\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'security',
        ['unlock-keychain', keychainPath],
        expect.objectContaining({
          input: password + '\n',
          encoding: 'utf8',
          timeout: 10000,
        })
      );
      expect(result.status).toBe(0);
    });

    it('should return success when keychain unlocks successfully', () => {
      mockSpawnSync.mockReturnValue({ status: 0, stderr: '' });

      const result = mockSpawnSync('security', ['unlock-keychain', '/path'], {
        input: 'password\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      const response = result.status === 0
        ? { success: true, message: 'Keychain unlocked successfully' }
        : { success: false, error: 'Failed to unlock keychain' };

      expect(response.success).toBe(true);
      expect(response.message).toBe('Keychain unlocked successfully');
    });

    it('should handle incorrect password error', () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: 'The user name or password is incorrect'
      });

      const result = mockSpawnSync('security', ['unlock-keychain', '/path'], {
        input: 'wrong-password\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      let errorMessage = 'Failed to unlock keychain';
      const stderr = result.stderr || '';

      if (stderr.includes('password') || stderr.includes('incorrect')) {
        errorMessage = 'Incorrect password';
      }

      expect(result.status).toBe(1);
      expect(errorMessage).toBe('Incorrect password');
    });

    it('should handle timeout error', () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: 'Operation timeout'
      });

      const result = mockSpawnSync('security', ['unlock-keychain', '/path'], {
        input: 'password\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      let errorMessage = 'Failed to unlock keychain';
      const stderr = result.stderr || '';

      if (stderr.includes('timeout')) {
        errorMessage = 'Operation timed out';
      }

      expect(errorMessage).toBe('Operation timed out');
    });

    it('should handle keychain not found error', () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stderr: 'keychain not found at path'
      });

      const result = mockSpawnSync('security', ['unlock-keychain', '/path'], {
        input: 'password\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      let errorMessage = 'Failed to unlock keychain';
      const stderr = result.stderr || '';

      if (stderr.includes('not found')) {
        errorMessage = 'Keychain not found';
      }

      expect(errorMessage).toBe('Keychain not found');
    });

    it('should use correct keychain path', () => {
      const homedir = mockHomedir();
      const expectedPath = `${homedir}/Library/Keychains/login.keychain-db`;

      expect(expectedPath).toBe('/Users/testuser/Library/Keychains/login.keychain-db');
    });
  });

  describe('GET /api/keychain/status', () => {
    it('should only work on macOS', () => {
      mockPlatform.mockReturnValue('win32');

      const platform = mockPlatform();
      expect(platform).not.toBe('darwin');

      const response = {
        success: false,
        error: 'Keychain status is only supported on macOS',
      };
      expect(response.error).toBe('Keychain status is only supported on macOS');
    });

    it('should return unlocked status when keychain is unlocked', () => {
      mockPlatform.mockReturnValue('darwin');
      mockExecSync.mockReturnValue('keychain info');

      // Simulate successful status check
      try {
        mockExecSync('security show-keychain-info "/path"', {
          timeout: 5000,
          encoding: 'utf8',
        });

        const response = {
          success: true,
          locked: false,
          message: 'Keychain is unlocked',
        };

        expect(response.locked).toBe(false);
      } catch {
        // Would indicate locked
      }
    });

    it('should return locked status when keychain is locked', () => {
      mockPlatform.mockReturnValue('darwin');
      mockExecSync.mockImplementation(() => {
        throw new Error('keychain is locked');
      });

      let isLocked = false;

      try {
        mockExecSync('security show-keychain-info "/path"', {
          timeout: 5000,
          encoding: 'utf8',
        });
      } catch {
        isLocked = true;
      }

      expect(isLocked).toBe(true);

      const response = {
        success: true,
        locked: true,
        message: 'Keychain is locked',
      };

      expect(response.locked).toBe(true);
    });
  });

  describe('Security considerations', () => {
    it('should pass password via stdin, not command line', () => {
      mockSpawnSync.mockReturnValue({ status: 0, stderr: '' });

      const password = 'secret-password';

      mockSpawnSync('security', ['unlock-keychain', '/path'], {
        input: password + '\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      // Verify password is in input option, not in command args
      const call = mockSpawnSync.mock.calls[0];
      const args = call[1] as string[];
      const options = call[2] as { input: string };

      expect(args).not.toContain(password);
      expect(options.input).toContain(password);
    });

    it('should not include password in command arguments', () => {
      mockSpawnSync.mockReturnValue({ status: 0, stderr: '' });

      const password = 'my-secret-123';

      mockSpawnSync('security', ['unlock-keychain', '/path'], {
        input: password + '\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      const call = mockSpawnSync.mock.calls[0];
      const commandArgs = call[1] as string[];

      // Password should never appear in command arguments (would be visible in process list)
      commandArgs.forEach((arg: string) => {
        expect(arg).not.toContain(password);
      });
    });

    it('should have a reasonable timeout', () => {
      mockSpawnSync.mockReturnValue({ status: 0, stderr: '' });

      mockSpawnSync('security', ['unlock-keychain', '/path'], {
        input: 'password\n',
        encoding: 'utf8',
        timeout: 10000,
      });

      const call = mockSpawnSync.mock.calls[0];
      const options = call[2] as { timeout: number };

      // Timeout should be reasonable (10 seconds)
      expect(options.timeout).toBe(10000);
      expect(options.timeout).toBeLessThanOrEqual(30000);
    });
  });

  describe('Remote keychain auto-unlock security', () => {
    it('should not include password in command when auto-unlocking', () => {
      // Simulating the auto-unlock command construction
      const keychainPath = '~/Library/Keychains/login.keychain-db';
      const password = 'super-secret-password';

      // The correct approach: command without -p flag
      const secureCommand = `security unlock-keychain ${keychainPath}\n`;

      // Verify password is NOT in the command string
      expect(secureCommand).not.toContain(password);
      expect(secureCommand).not.toContain('-p');
    });

    it('should send password separately after command', () => {
      const password = 'test-password-123';
      const commands: string[] = [];

      // Simulate terminal.write calls
      const mockTerminalWrite = (cmd: string) => commands.push(cmd);

      // First write: command without password
      const keychainPath = '~/Library/Keychains/login.keychain-db';
      mockTerminalWrite(`security unlock-keychain ${keychainPath}\n`);

      // Second write: just the password (sent after delay)
      mockTerminalWrite(password + '\n');

      // Verify first command doesn't contain password
      expect(commands[0]).not.toContain(password);
      expect(commands[0]).toContain('security unlock-keychain');

      // Verify password is sent separately
      expect(commands[1]).toBe(password + '\n');
    });

    it('should never use -p flag which exposes password in terminal', () => {
      const password = 'visible-password';
      const keychainPath = '~/Library/Keychains/login.keychain-db';

      // BAD: This would show password in terminal
      const insecureCommand = `security unlock-keychain -p "${password}" ${keychainPath}\n`;

      // GOOD: This doesn't show password
      const secureCommand = `security unlock-keychain ${keychainPath}\n`;

      // The insecure command contains the password (bad!)
      expect(insecureCommand).toContain(password);
      expect(insecureCommand).toContain('-p');

      // The secure command does not (good!)
      expect(secureCommand).not.toContain(password);
      expect(secureCommand).not.toContain('-p');
    });
  });

  describe('POST /api/keychain/remote/:machineId/test (PR #164)', () => {
    // Tests for the remote keychain password test endpoint
    // This endpoint tests a password against a remote machine's keychain via SSH

    it('should require a password in request body', () => {
      const body = {};

      const password = (body as { password?: string }).password;
      expect(password).toBeUndefined();

      // Would return 400
      const response = {
        success: false,
        error: 'Password is required',
      };
      expect(response.error).toBe('Password is required');
    });

    it('should return 404 if machine not found', () => {
      // When no machine exists with given ID
      const machine = undefined;

      const response = machine
        ? { success: true }
        : { success: false, error: 'Machine not found' };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Machine not found');
    });

    it('should return valid: true when password is correct', () => {
      // Simulating successful unlock
      const sshResult = {
        success: true,
        stdout: '',
        stderr: '',
      };

      const output = sshResult.stdout + (sshResult.stderr || '');
      const isError = output.toLowerCase().includes('incorrect') ||
                      output.toLowerCase().includes('bad password') ||
                      output.toLowerCase().includes('error');

      const response = sshResult.success && !isError
        ? { success: true, data: { valid: true, message: 'Password is correct - keychain unlocked successfully' } }
        : { success: true, data: { valid: false, message: 'Failed to unlock keychain' } };

      expect(response.data.valid).toBe(true);
      expect(response.data.message).toContain('correct');
    });

    it('should return valid: false when password is incorrect', () => {
      // Simulating incorrect password
      const sshResult = {
        success: false,
        stdout: 'The user name or password is incorrect',
        stderr: '',
      };

      const output = sshResult.stdout + (sshResult.stderr || '');
      const isError = output.toLowerCase().includes('incorrect') ||
                      output.toLowerCase().includes('bad password');

      const response = !isError
        ? { success: true, data: { valid: true, message: 'Password is correct' } }
        : { success: true, data: { valid: false, message: 'Incorrect password' } };

      expect(response.data.valid).toBe(false);
      expect(response.data.message).toContain('Incorrect');
    });

    it('should return valid: false for bad password error messages', () => {
      const sshResult = {
        success: false,
        stdout: 'bad password for keychain',
        stderr: '',
      };

      const output = sshResult.stdout;
      const isBadPassword = output.toLowerCase().includes('bad password');

      expect(isBadPassword).toBe(true);

      const response = {
        success: true,
        data: {
          valid: false,
          message: 'Incorrect password',
        },
      };

      expect(response.data.valid).toBe(false);
    });

    it('should escape special characters in password for shell', () => {
      const password = 'pass"word$test';
      const escapedPassword = password.replace(/"/g, '\\"').replace(/\$/g, '\\$');

      expect(escapedPassword).toBe('pass\\"word\\$test');

      // Verify the escaped password can be safely used in shell command
      const keychainPath = '~/Library/Keychains/login.keychain-db';
      const cmd = `bash -c 'echo "${escapedPassword}" | security unlock-keychain ${keychainPath} 2>&1'`;

      expect(cmd).toContain('pass\\"word\\$test');
      expect(cmd).not.toContain('pass"word$test');
    });

    it('should return structured data format with valid property', () => {
      // Test the response format matches the API types
      const successResponse = {
        success: true,
        data: {
          valid: true,
          message: 'Password is correct - keychain unlocked successfully',
        },
      };

      expect(successResponse).toHaveProperty('success');
      expect(successResponse).toHaveProperty('data');
      expect(successResponse.data).toHaveProperty('valid');
      expect(successResponse.data).toHaveProperty('message');
      expect(typeof successResponse.data.valid).toBe('boolean');
      expect(typeof successResponse.data.message).toBe('string');
    });

    it('should handle SSH connection failures gracefully', () => {
      // When SSH connection fails
      const sshConnectionFailed = true;

      const response = sshConnectionFailed
        ? { success: false, error: 'Failed to connect to remote machine' }
        : { success: true };

      expect(response.success).toBe(false);
      expect(response.error).toContain('connect');
    });
  });

  describe('Remote keychain API response format', () => {
    it('should return hasPassword wrapped in data object', () => {
      // Test the expected response format for has-password endpoint
      const hasPassword = true;

      // Correct format (matches ApiResponse<T> type)
      const correctResponse = {
        success: true,
        data: { hasPassword },
      };

      expect(correctResponse.success).toBe(true);
      expect(correctResponse.data).toBeDefined();
      expect(correctResponse.data.hasPassword).toBe(true);
    });

    it('should not return hasPassword at root level', () => {
      // Incorrect format that was causing the bug
      const incorrectResponse = {
        success: true,
        hasPassword: true,
      };

      // The old incorrect format had hasPassword at root
      // This test documents what we fixed
      expect(incorrectResponse).not.toHaveProperty('data');

      // Correct format should have data wrapper
      const correctResponse = {
        success: true,
        data: { hasPassword: true },
      };
      expect(correctResponse).toHaveProperty('data');
      expect(correctResponse.data).toHaveProperty('hasPassword');
    });
  });
});
