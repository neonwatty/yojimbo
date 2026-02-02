import { sshConnectionService } from './ssh-connection.service.js';
import { hookInstallerService } from './hook-installer.service.js';
import { reverseTunnelService } from './reverse-tunnel.service.js';
import { keychainStorageService } from './keychain-storage.service.js';
import { getDatabase } from '../db/connection.js';

/**
 * Result of a single preflight check
 */
export interface PreflightCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  details?: string;
}

/**
 * Aggregated preflight check results for a machine
 */
export interface PreflightResult {
  machineId: string;
  machineName: string;
  timestamp: string;
  overall: 'ready' | 'warnings' | 'not_ready';
  checks: PreflightCheckResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

interface RemoteMachineRow {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  ssh_key_path: string | null;
}

/**
 * Preflight Check Service
 * Verifies a remote machine is ready for instance creation
 */
class PreflightCheckService {
  /**
   * Run all preflight checks for a machine
   */
  async runAllChecks(machineId: string): Promise<PreflightResult> {
    const db = getDatabase();
    const machine = db
      .prepare('SELECT * FROM remote_machines WHERE id = ?')
      .get(machineId) as RemoteMachineRow | undefined;

    if (!machine) {
      return {
        machineId,
        machineName: 'Unknown',
        timestamp: new Date().toISOString(),
        overall: 'not_ready',
        checks: [{
          name: 'machine_exists',
          status: 'fail',
          message: 'Machine not found in database',
        }],
        summary: { passed: 0, failed: 1, warnings: 0, skipped: 0 },
      };
    }

    const checks: PreflightCheckResult[] = [];

    // 1. SSH Connectivity
    const sshCheck = await this.checkSSHConnectivity(machineId);
    checks.push(sshCheck);

    // If SSH fails, skip the rest (they all require SSH)
    if (sshCheck.status === 'fail') {
      const skippedChecks = [
        'required_tools',
        'claude_code',
        'keychain_status',
        'hooks_installed',
        'tunnel_connectivity',
      ];
      for (const name of skippedChecks) {
        checks.push({
          name,
          status: 'skip',
          message: 'Skipped due to SSH connection failure',
        });
      }
    } else {
      // 2. Required Tools (jq, curl, python3)
      const toolsCheck = await this.checkRequiredTools(machineId);
      checks.push(toolsCheck);

      // 3. Claude Code availability
      const claudeCheck = await this.checkClaudeCode(machineId);
      checks.push(claudeCheck);

      // 4. Keychain status (macOS only)
      const keychainCheck = await this.checkKeychainStatus(machineId);
      checks.push(keychainCheck);

      // 5. Hooks installed
      const hooksCheck = await this.checkHooksInstalled(machineId);
      checks.push(hooksCheck);

      // 6. Tunnel connectivity (if tunnel exists)
      const tunnelCheck = await this.checkTunnelConnectivity(machineId, machine);
      checks.push(tunnelCheck);
    }

    // Calculate summary
    const summary = {
      passed: checks.filter(c => c.status === 'pass').length,
      failed: checks.filter(c => c.status === 'fail').length,
      warnings: checks.filter(c => c.status === 'warn').length,
      skipped: checks.filter(c => c.status === 'skip').length,
    };

    // Determine overall status
    let overall: 'ready' | 'warnings' | 'not_ready';
    if (summary.failed > 0) {
      overall = 'not_ready';
    } else if (summary.warnings > 0) {
      overall = 'warnings';
    } else {
      overall = 'ready';
    }

    return {
      machineId,
      machineName: machine.name,
      timestamp: new Date().toISOString(),
      overall,
      checks,
      summary,
    };
  }

  /**
   * Check SSH connectivity
   */
  async checkSSHConnectivity(machineId: string): Promise<PreflightCheckResult> {
    const result = await sshConnectionService.testConnection(machineId);

    if (result.success) {
      return {
        name: 'ssh_connectivity',
        status: 'pass',
        message: 'SSH connection successful',
      };
    } else {
      return {
        name: 'ssh_connectivity',
        status: 'fail',
        message: 'SSH connection failed',
        details: result.error,
      };
    }
  }

  /**
   * Check required tools (jq, curl, python3, bash)
   */
  async checkRequiredTools(machineId: string): Promise<PreflightCheckResult> {
    const tools = ['jq', 'curl', 'python3', 'bash'];
    const missing: string[] = [];
    const found: string[] = [];

    for (const tool of tools) {
      const result = await sshConnectionService.executeCommand(
        machineId,
        `bash -c 'which ${tool} 2>/dev/null && echo "FOUND" || echo "NOT_FOUND"'`
      );

      if (result.stdout.includes('FOUND')) {
        found.push(tool);
      } else {
        missing.push(tool);
      }
    }

    if (missing.length === 0) {
      return {
        name: 'required_tools',
        status: 'pass',
        message: 'All required tools installed',
        details: `Found: ${found.join(', ')}`,
      };
    } else {
      return {
        name: 'required_tools',
        status: 'fail',
        message: `Missing required tools: ${missing.join(', ')}`,
        details: `Found: ${found.join(', ')}. Missing: ${missing.join(', ')}. Install missing tools with your package manager.`,
      };
    }
  }

  /**
   * Check Claude Code availability
   */
  async checkClaudeCode(machineId: string): Promise<PreflightCheckResult> {
    const result = await sshConnectionService.executeCommand(
      machineId,
      "bash -c 'which claude 2>/dev/null && claude --version 2>/dev/null || echo \"NOT_FOUND\"'"
    );

    if (result.stdout.includes('NOT_FOUND') || !result.success) {
      return {
        name: 'claude_code',
        status: 'fail',
        message: 'Claude Code not found',
        details: 'Install Claude Code on the remote machine: https://docs.anthropic.com/claude-code',
      };
    }

    const lines = result.stdout.trim().split('\n');
    const path = lines[0];
    const version = lines[1]?.match(/[\d.]+/)?.[0] || 'unknown';

    return {
      name: 'claude_code',
      status: 'pass',
      message: `Claude Code installed (v${version})`,
      details: `Path: ${path}`,
    };
  }

  /**
   * Check keychain status (macOS only)
   */
  async checkKeychainStatus(machineId: string): Promise<PreflightCheckResult> {
    // First check if this is macOS
    const osResult = await sshConnectionService.executeCommand(
      machineId,
      "bash -c 'uname -s'"
    );

    if (!osResult.stdout.includes('Darwin')) {
      return {
        name: 'keychain_status',
        status: 'skip',
        message: 'Not macOS - keychain check not applicable',
        details: `Detected OS: ${osResult.stdout.trim()}`,
      };
    }

    // Check if we have a stored password for this machine
    const hasStoredPassword = await keychainStorageService.hasPassword(machineId);

    // Check if keychain is already unlocked in this session
    const isUnlockedInSession = keychainStorageService.isUnlocked(machineId);

    // Check actual keychain status on remote
    const keychainResult = await sshConnectionService.executeCommand(
      machineId,
      "bash -c 'security show-keychain-info ~/Library/Keychains/login.keychain-db 2>&1'"
    );

    const output = keychainResult.stdout + keychainResult.stderr;
    const isLocked = output.toLowerCase().includes('locked') ||
                     output.toLowerCase().includes('the user name or passphrase');
    const isUnlocked = output.includes('keychain:') && !isLocked;

    if (isUnlocked) {
      return {
        name: 'keychain_status',
        status: 'pass',
        message: 'Keychain is unlocked',
        details: isUnlockedInSession ? 'Unlocked in this session' : 'Already unlocked on remote',
      };
    } else if (isLocked && hasStoredPassword) {
      return {
        name: 'keychain_status',
        status: 'warn',
        message: 'Keychain is locked (password stored - will auto-unlock)',
        details: 'The keychain will be automatically unlocked when creating an instance',
      };
    } else if (isLocked && !hasStoredPassword) {
      return {
        name: 'keychain_status',
        status: 'fail',
        message: 'Keychain is locked and no password stored',
        details: 'Store the keychain password in Remote Machines settings, or unlock manually on remote',
      };
    } else {
      return {
        name: 'keychain_status',
        status: 'warn',
        message: 'Keychain status unknown',
        details: output.substring(0, 200),
      };
    }
  }

  /**
   * Check if Yojimbo hooks are installed
   */
  async checkHooksInstalled(machineId: string): Promise<PreflightCheckResult> {
    const result = await hookInstallerService.checkExistingHooksForMachine(machineId);

    if (!result.success) {
      return {
        name: 'hooks_installed',
        status: 'warn',
        message: 'Could not check hooks status',
        details: result.error,
      };
    }

    const expectedHooks = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'];
    const installedHooks = result.existingHooks;
    const missingHooks = expectedHooks.filter(h => !installedHooks.includes(h));

    if (missingHooks.length === 0) {
      return {
        name: 'hooks_installed',
        status: 'pass',
        message: 'All hooks installed',
        details: `Hooks: ${installedHooks.join(', ')}`,
      };
    } else if (installedHooks.length === 0) {
      return {
        name: 'hooks_installed',
        status: 'warn',
        message: 'No hooks installed',
        details: 'Install hooks to enable status tracking. Use "Install Hooks" in machine settings.',
      };
    } else {
      return {
        name: 'hooks_installed',
        status: 'warn',
        message: `Partial hooks installed (${installedHooks.length}/${expectedHooks.length})`,
        details: `Installed: ${installedHooks.join(', ')}. Missing: ${missingHooks.join(', ')}`,
      };
    }
  }

  /**
   * Check tunnel connectivity
   */
  async checkTunnelConnectivity(
    machineId: string,
    machine: RemoteMachineRow
  ): Promise<PreflightCheckResult> {
    // First check if tunnel exists
    const hasTunnel = reverseTunnelService.hasMachineTunnel(machineId);

    if (!hasTunnel) {
      return {
        name: 'tunnel_connectivity',
        status: 'warn',
        message: 'No reverse tunnel active',
        details: 'Tunnel will be created when hooks are installed or instance is started',
      };
    }

    // Test tunnel by curling through it
    const tunnelResult = await sshConnectionService.testTunnelConnectivity(
      machine.hostname,
      machine.port,
      machine.username,
      machine.ssh_key_path || undefined,
      3456
    );

    if (tunnelResult.tunnelWorking) {
      return {
        name: 'tunnel_connectivity',
        status: 'pass',
        message: 'Reverse tunnel is working',
        details: 'Hooks can reach the Yojimbo server through the tunnel',
      };
    } else {
      return {
        name: 'tunnel_connectivity',
        status: 'fail',
        message: 'Reverse tunnel not working',
        details: tunnelResult.error || 'Could not reach server through tunnel',
      };
    }
  }

  /**
   * Run a quick check (SSH + required tools only)
   * Useful for fast validation before instance creation
   */
  async runQuickCheck(machineId: string): Promise<{
    ready: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // SSH check
    const sshResult = await sshConnectionService.testConnection(machineId);
    if (!sshResult.success) {
      errors.push(`SSH connection failed: ${sshResult.error}`);
      return { ready: false, errors };
    }

    // Required tools check
    const toolsCheck = await this.checkRequiredTools(machineId);
    if (toolsCheck.status === 'fail') {
      errors.push(toolsCheck.message);
    }

    // Claude check
    const claudeCheck = await this.checkClaudeCode(machineId);
    if (claudeCheck.status === 'fail') {
      errors.push(claudeCheck.message);
    }

    return {
      ready: errors.length === 0,
      errors,
    };
  }
}

export const preflightCheckService = new PreflightCheckService();
