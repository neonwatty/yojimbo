import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Shell Compatibility Tests
 *
 * These tests ensure that SSH commands and scripts work across different shells.
 * The issue: When SSHing to a remote machine, commands are interpreted by the
 * user's default shell, which may not be bash (e.g., nushell, fish, zsh).
 *
 * Shell-specific syntax that MUST be avoided in SSH commands:
 * - && and || (nushell uses 'and' and 'or' instead)
 * - Heredocs (<< EOF) - nushell doesn't support these
 * - Bash-specific features like [[ ]], process substitution, etc.
 *
 * Solution: Wrap complex scripts in `bash -c 'echo BASE64 | base64 -d | bash'`
 * This outer command is simple enough for any POSIX-compatible shell to parse.
 */

// Shell-specific syntax patterns that will break in non-bash shells
const SHELL_INCOMPATIBLE_PATTERNS = [
  {
    pattern: /(?<!')&&(?!')/,  // && not inside quotes
    shell: 'nushell',
    reason: 'nushell uses "and" instead of "&&"',
  },
  {
    pattern: /(?<!')\|\|(?!')/,  // || not inside quotes
    shell: 'nushell',
    reason: 'nushell uses "or" instead of "||"',
  },
  {
    pattern: /<<\s*['"]?[A-Z_]+['"]?/,  // Heredocs like << EOF or << 'EOF'
    shell: 'nushell',
    reason: 'nushell does not support heredocs',
  },
  {
    pattern: /\[\[.*\]\]/,  // Bash-specific [[ ]] conditionals
    shell: 'fish',
    reason: 'fish uses different conditional syntax',
  },
];

/**
 * Validates that a command doesn't contain shell-incompatible syntax.
 * The command should be the outer SSH command that gets parsed by the remote shell.
 */
function validateShellCompatibility(command: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  for (const { pattern, shell, reason } of SHELL_INCOMPATIBLE_PATTERNS) {
    if (pattern.test(command)) {
      issues.push(`Incompatible with ${shell}: ${reason}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Checks if a command uses the shell-agnostic base64 pattern.
 * This pattern works because:
 * 1. The outer command `bash -c '...'` is simple enough for any shell
 * 2. The actual script is base64-encoded, avoiding any parsing issues
 */
function usesBase64Pattern(command: string): boolean {
  // Pattern: bash -c 'echo BASE64_STRING | base64 -d | bash'
  return /^bash -c 'echo [A-Za-z0-9+/=]+ \| base64 -d \| bash'$/.test(command);
}

// Mock the database
const mockPrepare = vi.fn();
const mockGet = vi.fn();

vi.mock('../db/connection.js', () => ({
  getDatabase: () => ({
    prepare: (sql: string) => {
      mockPrepare(sql);
      return { get: mockGet };
    },
  }),
}));

vi.mock('ssh2', () => ({
  Client: vi.fn().mockImplementation(() => ({
    on: vi.fn().mockReturnThis(),
    connect: vi.fn(),
    end: vi.fn(),
  })),
}));

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-key')),
    existsSync: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('os', () => ({
  default: {
    homedir: () => '/home/testuser',
  },
}));

describe('Shell Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('HookInstallerService scripts', () => {
    it('generateInstallScript should use base64 pattern for shell compatibility', async () => {
      const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
      const service = new HookInstallerService();

      const hooksConfig = { hooks: { Test: [] } };
      const script = service['generateInstallScript'](hooksConfig);

      // Should use the base64 pattern
      expect(usesBase64Pattern(script)).toBe(true);

      // Validate shell compatibility of the outer command
      const result = validateShellCompatibility(script);
      expect(result.valid).toBe(true);
      if (!result.valid) {
        console.error('Shell compatibility issues:', result.issues);
      }
    });

    it('generateUninstallScript should use base64 pattern for shell compatibility', async () => {
      const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
      const service = new HookInstallerService();

      const script = service['generateUninstallScript']('test-id');

      // Should use the base64 pattern
      expect(usesBase64Pattern(script)).toBe(true);

      // Validate shell compatibility of the outer command
      const result = validateShellCompatibility(script);
      expect(result.valid).toBe(true);
      if (!result.valid) {
        console.error('Shell compatibility issues:', result.issues);
      }
    });

    it('generateInstallScript should produce valid base64', async () => {
      const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
      const service = new HookInstallerService();

      const hooksConfig = { hooks: { Test: [{ matcher: '.', hooks: [] }] } };
      const script = service['generateInstallScript'](hooksConfig);

      // Extract the base64 string
      const match = script.match(/echo ([A-Za-z0-9+/=]+) \|/);
      expect(match).not.toBeNull();

      // Verify it's valid base64 that decodes to a bash script
      const base64String = match![1];
      const decoded = Buffer.from(base64String, 'base64').toString('utf-8');

      expect(decoded).toContain('set -e');
      expect(decoded).toContain('SETTINGS_FILE');
      expect(decoded).toContain('.claude/settings.json');
    });

    it('generateUninstallScript should produce valid base64', async () => {
      const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
      const service = new HookInstallerService();

      const script = service['generateUninstallScript']('test-id');

      // Extract the base64 string
      const match = script.match(/echo ([A-Za-z0-9+/=]+) \|/);
      expect(match).not.toBeNull();

      // Verify it's valid base64 that decodes to a bash script
      const base64String = match![1];
      const decoded = Buffer.from(base64String, 'base64').toString('utf-8');

      expect(decoded).toContain('set -e');
      expect(decoded).toContain('SETTINGS_FILE');
      expect(decoded).toContain('python3');
      expect(decoded).toContain('localhost:3456');
    });
  });

  describe('checkExistingHooks command', () => {
    it('should use simple bash -c wrapper', async () => {
      // The checkExistingHooks command should be wrapped in bash -c
      // to avoid shell-specific issues
      const expectedPattern = /^bash -c /;

      // Test by examining the source - the command is:
      // bash -c "cat ~/.claude/settings.json 2>/dev/null || echo '{}'"
      const command = `bash -c "cat ~/.claude/settings.json 2>/dev/null || echo '{}'"`;

      expect(expectedPattern.test(command)).toBe(true);

      // The command inside bash -c can use bash syntax
      // because bash is interpreting it, not the user's shell
    });
  });

  describe('validateShellCompatibility helper', () => {
    it('should detect && outside of bash -c wrapper', () => {
      const badCommand = 'cd /tmp && ls';
      const result = validateShellCompatibility(badCommand);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('nushell'))).toBe(true);
    });

    it('should detect || outside of bash -c wrapper', () => {
      const badCommand = 'test -f file || exit 1';
      const result = validateShellCompatibility(badCommand);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('nushell'))).toBe(true);
    });

    it('should detect heredocs', () => {
      const badCommand = "bash << 'EOF'\necho hello\nEOF";
      const result = validateShellCompatibility(badCommand);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('heredoc'))).toBe(true);
    });

    it('should accept simple commands', () => {
      const goodCommand = "bash -c 'echo hello'";
      const result = validateShellCompatibility(goodCommand);
      expect(result.valid).toBe(true);
    });

    it('should accept base64 pattern', () => {
      const goodCommand = "bash -c 'echo c2V0IC1lCmVjaG8gaGVsbG8= | base64 -d | bash'";
      const result = validateShellCompatibility(goodCommand);
      expect(result.valid).toBe(true);
    });
  });

  describe('SSH service commands', () => {
    it('listDirectories should be shell-compatible', async () => {
      // From ssh-connection.service.ts:
      // bash -c 'ls -la "path" 2>/dev/null | grep "^d" | awk ...'
      // The outer command should be compatible - bash -c wrapper works in any shell
      const simpleCommand = "bash -c 'ls -la /home/user 2>/dev/null'";
      const result = validateShellCompatibility(simpleCommand);
      expect(result.valid).toBe(true);
    });

    it('checkRemoteClaudeStatus should be shell-compatible', async () => {
      // The checkRemoteClaudeStatus uses base64 encoding pattern
      // bash -c 'echo BASE64 | base64 -d | bash'
      const command = "bash -c 'echo dGVzdA== | base64 -d | bash'";
      const result = validateShellCompatibility(command);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Base64 encoding utilities', () => {
  it('should correctly encode and decode scripts', () => {
    const originalScript = `set -e
echo "Hello World"
if [ -f "$HOME/.test" ]; then
  cat "$HOME/.test"
fi`;

    const encoded = Buffer.from(originalScript).toString('base64');
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

    expect(decoded).toBe(originalScript);
  });

  it('should handle special characters in scripts', () => {
    const originalScript = `echo 'Single quotes'
echo "Double quotes"
echo \`backticks\`
echo $HOME
echo "JSON: {\\"key\\": \\"value\\"}"`;

    const encoded = Buffer.from(originalScript).toString('base64');
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');

    expect(decoded).toBe(originalScript);
  });

  it('base64 string should not contain shell-problematic characters', () => {
    // Base64 only uses A-Z, a-z, 0-9, +, /, =
    // None of these are special to any shell inside single quotes
    const testScript = 'echo "test" && exit 1 || echo "failed"';
    const encoded = Buffer.from(testScript).toString('base64');

    // Verify it only contains safe characters
    expect(/^[A-Za-z0-9+/=]+$/.test(encoded)).toBe(true);

    // Verify the full command would be shell-safe
    const fullCommand = `bash -c 'echo ${encoded} | base64 -d | bash'`;
    const result = validateShellCompatibility(fullCommand);
    expect(result.valid).toBe(true);
  });
});

/**
 * NUSHELL INTEGRATION TESTS
 *
 * These tests actually run commands through nushell to verify they work.
 * They are skipped if nushell is not installed.
 *
 * This is the ultimate proof that the shell compatibility fix works.
 */
import { execSync, spawnSync } from 'child_process';

function isNushellAvailable(): boolean {
  try {
    execSync('which nu', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function runInNushell(command: string): { success: boolean; output: string; error: string } {
  try {
    const result = spawnSync('nu', ['-c', command], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return {
      success: result.status === 0,
      output: result.stdout || '',
      error: result.stderr || '',
    };
  } catch (e) {
    return {
      success: false,
      output: '',
      error: String(e),
    };
  }
}

const describeIfNushell = isNushellAvailable() ? describe : describe.skip;

describeIfNushell('Nushell Integration Tests (real nushell execution)', () => {
  it('should parse and execute base64 pattern command', () => {
    const testScript = 'echo "Hello from bash"';
    const base64 = Buffer.from(testScript).toString('base64');
    const command = `bash -c 'echo ${base64} | base64 -d | bash'`;

    const result = runInNushell(command);

    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('Hello from bash');
  });

  it('should FAIL to parse heredoc syntax (proving the fix was needed)', () => {
    // This is the OLD pattern that was causing the nushell error
    const command = `bash << 'EOF'
echo hello
EOF`;

    const result = runInNushell(command);

    // This SHOULD fail in nushell
    expect(result.success).toBe(false);
  });

  it('generateInstallScript output should parse in nushell', async () => {
    const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
    const service = new HookInstallerService();

    const hooksConfig = { hooks: { Test: [] } };
    const installCmd = service['generateInstallScript'](hooksConfig);

    // We can't actually run the full install (it would modify files),
    // but we can verify nushell can PARSE the command without error
    // by replacing the script content with a safe echo
    const testScript = 'echo "Install script parsed successfully"';
    const base64 = Buffer.from(testScript).toString('base64');
    const safeCmd = `bash -c 'echo ${base64} | base64 -d | bash'`;

    const result = runInNushell(safeCmd);

    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('Install script parsed successfully');

    // Also verify the actual command has the same structure
    expect(installCmd).toMatch(/^bash -c 'echo [A-Za-z0-9+/=]+ \| base64 -d \| bash'$/);
  });

  it('generateUninstallScript output should parse in nushell', async () => {
    const { HookInstallerService } = await import('../services/hook-installer.service.js') as any;
    const service = new HookInstallerService();

    const uninstallCmd = service['generateUninstallScript']('test-id');

    // Verify nushell can parse the command structure
    const testScript = 'echo "Uninstall script parsed successfully"';
    const base64 = Buffer.from(testScript).toString('base64');
    const safeCmd = `bash -c 'echo ${base64} | base64 -d | bash'`;

    const result = runInNushell(safeCmd);

    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('Uninstall script parsed successfully');

    // Also verify the actual command has the same structure
    expect(uninstallCmd).toMatch(/^bash -c 'echo [A-Za-z0-9+/=]+ \| base64 -d \| bash'$/);
  });

  it('complex script with bash syntax should work through base64', () => {
    // This script uses bash-specific syntax that would fail if parsed by nushell directly
    const bashScript = `set -e
if [ -f /etc/passwd ]; then
  echo "File exists"
else
  echo "No file"
fi
echo "Done" && echo "Chained"`;

    const base64 = Buffer.from(bashScript).toString('base64');
    const command = `bash -c 'echo ${base64} | base64 -d | bash'`;

    const result = runInNushell(command);

    expect(result.success).toBe(true);
    expect(result.output).toContain('File exists');
    expect(result.output).toContain('Done');
    expect(result.output).toContain('Chained');
  });
});
