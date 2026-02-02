import { Client } from 'ssh2';
import fs from 'fs';
import os from 'os';
import { getDatabase } from '../db/connection.js';
import type { SSHConfig } from './terminal-backend.js';

interface RemoteMachineRow {
  id: string;
  hostname: string;
  port: number;
  username: string;
  ssh_key_path: string | null;
}

interface InstanceRow {
  id: string;
  working_dir: string;
  machine_id: string | null;
}

interface HookInstallResult {
  success: boolean;
  message: string;
  error?: string;
}

interface CheckHooksResult {
  success: boolean;
  existingHooks: string[];
  error?: string;
}

export type HookInstallationStatus = 'installed' | 'partial' | 'missing' | 'error';

export interface HookVerificationResult {
  success: boolean;
  status: HookInstallationStatus;
  installedHooks: string[];
  missingHooks: string[];
  invalidHooks: string[];
  details?: string;
  error?: string;
}

interface ToolCheckResult {
  success: boolean;
  available: string[];
  missing: string[];
  error?: string;
}

/**
 * Hook Installer Service
 * Installs Claude Code hooks on remote machines via SSH
 */
class HookInstallerService {
  /**
   * Install hooks on a remote machine for a specific instance
   */
  async installHooksForInstance(
    instanceId: string,
    orchestratorUrl: string
  ): Promise<HookInstallResult> {
    const db = getDatabase();

    // Get instance details
    const instance = db.prepare(`
      SELECT id, working_dir, machine_id
      FROM instances
      WHERE id = ?
    `).get(instanceId) as InstanceRow | undefined;

    if (!instance) {
      return { success: false, message: 'Instance not found', error: 'Instance not found' };
    }

    if (!instance.machine_id) {
      return { success: false, message: 'Instance is not a remote instance', error: 'Not a remote instance' };
    }

    // Get machine details
    const machine = db.prepare(`
      SELECT id, hostname, port, username, ssh_key_path
      FROM remote_machines
      WHERE id = ?
    `).get(instance.machine_id) as RemoteMachineRow | undefined;

    if (!machine) {
      return { success: false, message: 'Remote machine not found', error: 'Machine not found' };
    }

    const sshConfig: SSHConfig = {
      host: machine.hostname,
      port: machine.port,
      username: machine.username,
      privateKeyPath: machine.ssh_key_path || undefined,
    };

    return this.installHooks(sshConfig, instanceId, orchestratorUrl, machine.id);
  }

  /**
   * Install hooks on a remote machine directly (without requiring an instance)
   * This allows setting up hooks before creating any instances on the machine.
   */
  async installHooksForMachine(
    machineId: string,
    orchestratorUrl: string,
    skipToolCheck = false
  ): Promise<HookInstallResult> {
    const db = getDatabase();

    // Get machine details
    const machine = db.prepare(`
      SELECT id, hostname, port, username, ssh_key_path
      FROM remote_machines
      WHERE id = ?
    `).get(machineId) as RemoteMachineRow | undefined;

    if (!machine) {
      return { success: false, message: 'Remote machine not found', error: 'Machine not found' };
    }

    const sshConfig: SSHConfig = {
      host: machine.hostname,
      port: machine.port,
      username: machine.username,
      privateKeyPath: machine.ssh_key_path || undefined,
    };

    // Check for required tools before installing (unless skipped)
    if (!skipToolCheck) {
      const toolCheck = await this.checkRequiredToolsWithConfig(sshConfig);
      if (!toolCheck.success) {
        return {
          success: false,
          message: 'Failed to check required tools',
          error: toolCheck.error,
        };
      }
      if (toolCheck.missing.length > 0) {
        return {
          success: false,
          message: `Missing required tools: ${toolCheck.missing.join(', ')}`,
          error: `Install the following tools on the remote machine: ${toolCheck.missing.join(', ')}`,
        };
      }
    }

    // Use empty string for instanceId since hooks don't actually use it
    return this.installHooks(sshConfig, '', orchestratorUrl, machine.id);
  }

  /**
   * Check which hook types already exist on a remote machine (by machine ID)
   */
  async checkExistingHooksForMachine(machineId: string): Promise<CheckHooksResult> {
    const db = getDatabase();

    // Get machine details
    const machine = db.prepare(`
      SELECT id, hostname, port, username, ssh_key_path
      FROM remote_machines
      WHERE id = ?
    `).get(machineId) as RemoteMachineRow | undefined;

    if (!machine) {
      return { success: false, existingHooks: [], error: 'Remote machine not found' };
    }

    const sshConfig: SSHConfig = {
      host: machine.hostname,
      port: machine.port,
      username: machine.username,
      privateKeyPath: machine.ssh_key_path || undefined,
    };

    return this.checkExistingHooks(sshConfig);
  }

  /**
   * Check which hook types already exist on a remote machine
   */
  async checkExistingHooksForInstance(instanceId: string): Promise<CheckHooksResult> {
    const db = getDatabase();

    // Get instance details
    const instance = db.prepare(`
      SELECT id, working_dir, machine_id
      FROM instances
      WHERE id = ?
    `).get(instanceId) as InstanceRow | undefined;

    if (!instance) {
      return { success: false, existingHooks: [], error: 'Instance not found' };
    }

    if (!instance.machine_id) {
      return { success: false, existingHooks: [], error: 'Instance is not a remote instance' };
    }

    // Get machine details
    const machine = db.prepare(`
      SELECT id, hostname, port, username, ssh_key_path
      FROM remote_machines
      WHERE id = ?
    `).get(instance.machine_id) as RemoteMachineRow | undefined;

    if (!machine) {
      return { success: false, existingHooks: [], error: 'Remote machine not found' };
    }

    const sshConfig: SSHConfig = {
      host: machine.hostname,
      port: machine.port,
      username: machine.username,
      privateKeyPath: machine.ssh_key_path || undefined,
    };

    return this.checkExistingHooks(sshConfig);
  }

  // The hook types we install
  private readonly hookTypes = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'];
  // Required tools for hook installation and operation
  private readonly requiredTools = ['jq', 'curl', 'python3', 'bash'];

  /**
   * Check which hook types exist on a remote machine
   */
  async checkExistingHooks(config: SSHConfig): Promise<CheckHooksResult> {
    // The hook types we install that could conflict with user hooks
    const ourHookTypes = this.hookTypes;

    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, existingHooks: [], error: 'SSH connection timeout' });
      }, 15000);

      // Read private key
      let privateKey: Buffer | undefined;
      if (config.privateKeyPath) {
        const keyPath = config.privateKeyPath.replace(/^~/, os.homedir());
        try {
          privateKey = fs.readFileSync(keyPath);
        } catch (err) {
          clearTimeout(timeout);
          resolve({ success: false, existingHooks: [], error: `Failed to read SSH key: ${String(err)}` });
          return;
        }
      } else {
        const defaultKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa'];
        for (const keyName of defaultKeys) {
          const keyPath = `${os.homedir()}/.ssh/${keyName}`;
          if (fs.existsSync(keyPath)) {
            try {
              privateKey = fs.readFileSync(keyPath);
              break;
            } catch {
              // Continue to next key
            }
          }
        }
      }

      if (!privateKey) {
        clearTimeout(timeout);
        resolve({ success: false, existingHooks: [], error: 'No SSH private key found' });
        return;
      }

      client.on('ready', () => {
        // Read settings.json and check for existing hooks
        // Wrap in bash -c to ensure it works regardless of user's default shell (e.g., nushell)
        const checkScript = `bash -c "cat ~/.claude/settings.json 2>/dev/null || echo '{}'"`;

        client.exec(checkScript, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            client.end();
            resolve({ success: false, existingHooks: [], error: err.message });
            return;
          }

          let stdout = '';

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.on('close', () => {
            clearTimeout(timeout);
            client.end();

            try {
              const settings = JSON.parse(stdout);
              const existingHooks: string[] = [];

              if (settings.hooks && typeof settings.hooks === 'object') {
                for (const hookType of ourHookTypes) {
                  if (settings.hooks[hookType] && Array.isArray(settings.hooks[hookType]) && settings.hooks[hookType].length > 0) {
                    existingHooks.push(hookType);
                  }
                }
              }

              resolve({ success: true, existingHooks });
            } catch {
              // Invalid JSON or no file - no existing hooks
              resolve({ success: true, existingHooks: [] });
            }
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: false, existingHooks: [], error: err.message });
      });

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 10000,
      });
    });
  }

  /**
   * Verify hooks are correctly installed on a remote machine (by machine ID)
   * Returns detailed information about hook installation state and validity
   */
  async verifyHooksInstalled(machineId: string): Promise<HookVerificationResult> {
    const db = getDatabase();

    const machine = db.prepare(`
      SELECT id, hostname, port, username, ssh_key_path
      FROM remote_machines
      WHERE id = ?
    `).get(machineId) as RemoteMachineRow | undefined;

    if (!machine) {
      return {
        success: false,
        status: 'error',
        installedHooks: [],
        missingHooks: [],
        invalidHooks: [],
        error: 'Remote machine not found',
      };
    }

    const sshConfig: SSHConfig = {
      host: machine.hostname,
      port: machine.port,
      username: machine.username,
      privateKeyPath: machine.ssh_key_path || undefined,
    };

    return this.verifyHooksWithConfig(sshConfig);
  }

  /**
   * Verify hooks are correctly installed with detailed structure checking
   */
  private async verifyHooksWithConfig(config: SSHConfig): Promise<HookVerificationResult> {
    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({
          success: false,
          status: 'error',
          installedHooks: [],
          missingHooks: [],
          invalidHooks: [],
          error: 'SSH connection timeout',
        });
      }, 15000);

      // Read private key
      let privateKey: Buffer | undefined;
      if (config.privateKeyPath) {
        const keyPath = config.privateKeyPath.replace(/^~/, os.homedir());
        try {
          privateKey = fs.readFileSync(keyPath);
        } catch (err) {
          clearTimeout(timeout);
          resolve({
            success: false,
            status: 'error',
            installedHooks: [],
            missingHooks: [],
            invalidHooks: [],
            error: `Failed to read SSH key: ${String(err)}`,
          });
          return;
        }
      } else {
        const defaultKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa'];
        for (const keyName of defaultKeys) {
          const keyPath = `${os.homedir()}/.ssh/${keyName}`;
          if (fs.existsSync(keyPath)) {
            try {
              privateKey = fs.readFileSync(keyPath);
              break;
            } catch {
              // Continue to next key
            }
          }
        }
      }

      if (!privateKey) {
        clearTimeout(timeout);
        resolve({
          success: false,
          status: 'error',
          installedHooks: [],
          missingHooks: [],
          invalidHooks: [],
          error: 'No SSH private key found',
        });
        return;
      }

      client.on('ready', () => {
        // Read settings.json and verify hook structure
        const checkScript = `bash -c "cat ~/.claude/settings.json 2>/dev/null || echo '{}'"`;

        client.exec(checkScript, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            client.end();
            resolve({
              success: false,
              status: 'error',
              installedHooks: [],
              missingHooks: [],
              invalidHooks: [],
              error: err.message,
            });
            return;
          }

          let stdout = '';

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.on('close', () => {
            clearTimeout(timeout);
            client.end();

            try {
              const settings = JSON.parse(stdout);
              const installedHooks: string[] = [];
              const missingHooks: string[] = [];
              const invalidHooks: string[] = [];

              if (!settings.hooks || typeof settings.hooks !== 'object') {
                // No hooks at all
                resolve({
                  success: true,
                  status: 'missing',
                  installedHooks: [],
                  missingHooks: this.hookTypes,
                  invalidHooks: [],
                  details: 'No hooks section found in settings.json',
                });
                return;
              }

              // Check each expected hook type
              for (const hookType of this.hookTypes) {
                const hooks = settings.hooks[hookType];

                if (!hooks || !Array.isArray(hooks) || hooks.length === 0) {
                  missingHooks.push(hookType);
                  continue;
                }

                // Verify the hook has the correct structure (Yojimbo hooks)
                const hasValidYojimboHook = hooks.some((hook: unknown) => {
                  if (typeof hook !== 'object' || hook === null) return false;
                  const h = hook as Record<string, unknown>;

                  // Check for the matcher/hooks structure we use
                  if (h.matcher === '.' && Array.isArray(h.hooks)) {
                    return h.hooks.some((inner: unknown) => {
                      if (typeof inner !== 'object' || inner === null) return false;
                      const i = inner as Record<string, unknown>;
                      return i.type === 'command' &&
                             typeof i.command === 'string' &&
                             (i.command as string).includes('localhost:3456');
                    });
                  }
                  return false;
                });

                if (hasValidYojimboHook) {
                  installedHooks.push(hookType);
                } else {
                  // Hooks exist but don't match Yojimbo format
                  invalidHooks.push(hookType);
                }
              }

              // Determine status
              let status: HookInstallationStatus;
              if (installedHooks.length === this.hookTypes.length) {
                status = 'installed';
              } else if (installedHooks.length > 0) {
                status = 'partial';
              } else {
                status = 'missing';
              }

              resolve({
                success: true,
                status,
                installedHooks,
                missingHooks,
                invalidHooks,
                details: `${installedHooks.length}/${this.hookTypes.length} hooks correctly installed`,
              });
            } catch {
              // Invalid JSON
              resolve({
                success: true,
                status: 'missing',
                installedHooks: [],
                missingHooks: this.hookTypes,
                invalidHooks: [],
                details: 'Invalid or missing settings.json',
              });
            }
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end();
        resolve({
          success: false,
          status: 'error',
          installedHooks: [],
          missingHooks: [],
          invalidHooks: [],
          error: err.message,
        });
      });

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 10000,
      });
    });
  }

  /**
   * Check if required tools are available on a remote machine
   */
  async checkRequiredTools(machineId: string): Promise<ToolCheckResult> {
    const db = getDatabase();

    const machine = db.prepare(`
      SELECT id, hostname, port, username, ssh_key_path
      FROM remote_machines
      WHERE id = ?
    `).get(machineId) as RemoteMachineRow | undefined;

    if (!machine) {
      return { success: false, available: [], missing: [], error: 'Remote machine not found' };
    }

    const sshConfig: SSHConfig = {
      host: machine.hostname,
      port: machine.port,
      username: machine.username,
      privateKeyPath: machine.ssh_key_path || undefined,
    };

    return this.checkRequiredToolsWithConfig(sshConfig);
  }

  /**
   * Check if required tools are available with SSH config
   */
  private async checkRequiredToolsWithConfig(config: SSHConfig): Promise<ToolCheckResult> {
    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, available: [], missing: [], error: 'SSH connection timeout' });
      }, 15000);

      // Read private key
      let privateKey: Buffer | undefined;
      if (config.privateKeyPath) {
        const keyPath = config.privateKeyPath.replace(/^~/, os.homedir());
        try {
          privateKey = fs.readFileSync(keyPath);
        } catch (err) {
          clearTimeout(timeout);
          resolve({ success: false, available: [], missing: [], error: `Failed to read SSH key: ${String(err)}` });
          return;
        }
      } else {
        const defaultKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa'];
        for (const keyName of defaultKeys) {
          const keyPath = `${os.homedir()}/.ssh/${keyName}`;
          if (fs.existsSync(keyPath)) {
            try {
              privateKey = fs.readFileSync(keyPath);
              break;
            } catch {
              // Continue to next key
            }
          }
        }
      }

      if (!privateKey) {
        clearTimeout(timeout);
        resolve({ success: false, available: [], missing: [], error: 'No SSH private key found' });
        return;
      }

      client.on('ready', () => {
        // Check all tools in one command
        const toolChecks = this.requiredTools.map(tool =>
          `(which ${tool} >/dev/null 2>&1 && echo "${tool}:OK" || echo "${tool}:MISSING")`
        ).join('; ');

        const checkScript = `bash -c '${toolChecks}'`;

        client.exec(checkScript, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            client.end();
            resolve({ success: false, available: [], missing: [], error: err.message });
            return;
          }

          let stdout = '';

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.on('close', () => {
            clearTimeout(timeout);
            client.end();

            const available: string[] = [];
            const missing: string[] = [];

            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              const [tool, status] = line.split(':');
              if (status === 'OK') {
                available.push(tool);
              } else if (status === 'MISSING') {
                missing.push(tool);
              }
            }

            resolve({ success: true, available, missing });
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: false, available: [], missing: [], error: err.message });
      });

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 10000,
      });
    });
  }

  /**
   * Install hooks on a remote machine via SSH
   */
  async installHooks(
    config: SSHConfig,
    instanceId: string,
    orchestratorUrl: string,
    machineId?: string
  ): Promise<HookInstallResult> {
    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, message: 'Connection timeout', error: 'SSH connection timeout' });
      }, 30000);

      // Read private key
      let privateKey: Buffer | undefined;
      if (config.privateKeyPath) {
        const keyPath = config.privateKeyPath.replace(/^~/, os.homedir());
        try {
          privateKey = fs.readFileSync(keyPath);
        } catch (err) {
          clearTimeout(timeout);
          resolve({ success: false, message: `Failed to read SSH key: ${keyPath}`, error: String(err) });
          return;
        }
      } else {
        // Try default keys
        const defaultKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa'];
        for (const keyName of defaultKeys) {
          const keyPath = `${os.homedir()}/.ssh/${keyName}`;
          if (fs.existsSync(keyPath)) {
            try {
              privateKey = fs.readFileSync(keyPath);
              break;
            } catch {
              // Continue to next key
            }
          }
        }
      }

      if (!privateKey) {
        clearTimeout(timeout);
        resolve({ success: false, message: 'No SSH private key found', error: 'No SSH key' });
        return;
      }

      client.on('ready', async () => {
        try {
          // Generate the hooks configuration
          const hooksConfig = this.generateHooksConfig(instanceId, orchestratorUrl, machineId);

          // Create the script to install hooks
          const installScript = this.generateInstallScript(hooksConfig);

          // Execute the installation script
          client.exec(installScript, (err, stream) => {
            if (err) {
              clearTimeout(timeout);
              client.end();
              resolve({ success: false, message: 'Failed to execute install script', error: err.message });
              return;
            }

            let stdout = '';
            let stderr = '';

            stream.on('data', (data: Buffer) => {
              stdout += data.toString();
            });

            stream.stderr.on('data', (data: Buffer) => {
              stderr += data.toString();
            });

            stream.on('close', (code: number) => {
              clearTimeout(timeout);
              client.end();

              if (code !== 0) {
                resolve({
                  success: false,
                  message: `Hook installation failed with code ${code}`,
                  error: stderr || stdout,
                });
              } else {
                resolve({
                  success: true,
                  message: 'Hooks installed successfully',
                });
              }
            });
          });
        } catch (err) {
          clearTimeout(timeout);
          client.end();
          resolve({ success: false, message: 'Failed to install hooks', error: String(err) });
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: false, message: 'SSH connection error', error: err.message });
      });

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 15000,
      });
    });
  }

  /**
   * Generate the hooks configuration object
   * Uses the new Claude Code hook format with matchers
   *
   * NOTE: We don't include instanceId in the hooks because:
   * 1. Hooks are stored in ~/.claude/settings.json on the remote machine
   * 2. Multiple instances on the same machine share this config
   * 3. The server matches instances by projectDir (working directory) instead
   */
  private generateHooksConfig(_instanceId: string, orchestratorUrl: string, machineId?: string): object {
    // Extract port from orchestratorUrl, but always use localhost
    // because the reverse tunnel forwards localhost:port → orchestrator server
    // The remote machine can't reach orchestratorUrl directly, but the reverse
    // tunnel makes localhost:port available on the remote machine
    let port = 3456;
    try {
      const url = new URL(orchestratorUrl);
      if (url.port) {
        port = parseInt(url.port, 10);
      }
    } catch {
      // Keep default port if URL parsing fails
    }

    const baseUrl = `http://localhost:${port}`;

    // Include machineId in the payload if provided (for remote machines)
    // This allows the server to match hook events to the correct instance
    const machineIdField = machineId ? `,machineId:"${machineId}"` : '';

    // Create curl commands for each hook
    // Claude Code hooks receive context via stdin as JSON containing { cwd: "...", ... }
    // We read stdin, extract cwd with jq, transform to our format, and pipe to curl
    const statusWorkingCmd = `jq '{event:"working",projectDir:.cwd${machineIdField}}' | curl -s -X POST "${baseUrl}/api/hooks/status" -H "Content-Type: application/json" -d @-`;
    const stopCmd = `jq '{projectDir:.cwd${machineIdField}}' | curl -s -X POST "${baseUrl}/api/hooks/stop" -H "Content-Type: application/json" -d @-`;
    const notificationCmd = `jq '{projectDir:.cwd${machineIdField}}' | curl -s -X POST "${baseUrl}/api/hooks/notification" -H "Content-Type: application/json" -d @-`;

    // Helper to create a hook entry in the new format
    const createHookEntry = (command: string) => ({
      matcher: ".",
      hooks: [{ type: "command", command }]
    });

    return {
      hooks: {
        UserPromptSubmit: [createHookEntry(statusWorkingCmd)],
        PreToolUse: [createHookEntry(statusWorkingCmd)],
        PostToolUse: [createHookEntry(statusWorkingCmd)],
        Stop: [createHookEntry(stopCmd)],
        Notification: [createHookEntry(notificationCmd)]
      }
    };
  }

  /**
   * Generate the bash script to install hooks on the remote machine
   * Uses base64 encoding to work with any default shell (bash, zsh, nushell, fish, etc.)
   */
  private generateInstallScript(hooksConfig: object): string {
    const hooksJson = JSON.stringify(hooksConfig, null, 2);

    // Base64 encode the hooks JSON to safely pass it to Python
    // This avoids any issues with quotes/escaping in the JSON
    const hooksBase64 = Buffer.from(hooksJson).toString('base64');

    // The actual bash script to run
    const bashScript = `set -e

CLAUDE_DIR="$HOME/.claude"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
HOOKS_BASE64="${hooksBase64}"

# Create .claude directory if it doesn't exist
mkdir -p "$CLAUDE_DIR"

# Check if settings.json exists
if [ -f "$SETTINGS_FILE" ]; then
  # Backup existing settings
  cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup.$(date +%Y%m%d%H%M%S)"

  # Read existing settings and merge with new hooks using Python
  python3 -c "
import json
import os
import base64

settings_file = os.path.expanduser('~/.claude/settings.json')
hooks_b64 = '$HOOKS_BASE64'
new_hooks = json.loads(base64.b64decode(hooks_b64).decode('utf-8'))

try:
    with open(settings_file, 'r') as f:
        settings = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    settings = {}

# Merge hooks - new hooks take precedence
if 'hooks' not in settings:
    settings['hooks'] = {}

settings['hooks'].update(new_hooks.get('hooks', {}))

with open(settings_file, 'w') as f:
    json.dump(settings, f, indent=2)

print('Hooks merged successfully')
"
else
  # Create new settings file with hooks - decode base64 and write
  echo "$HOOKS_BASE64" | base64 -d > "$SETTINGS_FILE"
  echo "Settings file created with hooks"
fi

echo "Hook installation complete"`;

    // Base64 encode the script and wrap in a command that works in any shell
    // The outer command is simple enough for any shell to parse:
    // bash -c 'echo BASE64 | base64 -d | bash'
    const base64Script = Buffer.from(bashScript).toString('base64');
    return `bash -c 'echo ${base64Script} | base64 -d | bash'`;
  }

  /**
   * Uninstall hooks from a remote machine for a specific instance
   */
  async uninstallHooksForInstance(instanceId: string): Promise<HookInstallResult> {
    const db = getDatabase();

    // Get instance details
    const instance = db.prepare(`
      SELECT id, working_dir, machine_id
      FROM instances
      WHERE id = ?
    `).get(instanceId) as InstanceRow | undefined;

    if (!instance) {
      return { success: false, message: 'Instance not found', error: 'Instance not found' };
    }

    if (!instance.machine_id) {
      return { success: false, message: 'Instance is not a remote instance', error: 'Not a remote instance' };
    }

    // Get machine details
    const machine = db.prepare(`
      SELECT id, hostname, port, username, ssh_key_path
      FROM remote_machines
      WHERE id = ?
    `).get(instance.machine_id) as RemoteMachineRow | undefined;

    if (!machine) {
      return { success: false, message: 'Remote machine not found', error: 'Machine not found' };
    }

    const sshConfig: SSHConfig = {
      host: machine.hostname,
      port: machine.port,
      username: machine.username,
      privateKeyPath: machine.ssh_key_path || undefined,
    };

    return this.uninstallHooks(sshConfig, instanceId);
  }

  /**
   * Uninstall hooks from a remote machine
   */
  async uninstallHooks(
    config: SSHConfig,
    instanceId: string
  ): Promise<HookInstallResult> {
    return new Promise((resolve) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        client.end();
        resolve({ success: false, message: 'Connection timeout', error: 'SSH connection timeout' });
      }, 30000);

      // Read private key (same logic as installHooks)
      let privateKey: Buffer | undefined;
      if (config.privateKeyPath) {
        const keyPath = config.privateKeyPath.replace(/^~/, os.homedir());
        try {
          privateKey = fs.readFileSync(keyPath);
        } catch (err) {
          clearTimeout(timeout);
          resolve({ success: false, message: `Failed to read SSH key`, error: String(err) });
          return;
        }
      } else {
        const defaultKeys = ['id_ed25519', 'id_rsa', 'id_ecdsa'];
        for (const keyName of defaultKeys) {
          const keyPath = `${os.homedir()}/.ssh/${keyName}`;
          if (fs.existsSync(keyPath)) {
            try {
              privateKey = fs.readFileSync(keyPath);
              break;
            } catch {
              // Continue
            }
          }
        }
      }

      if (!privateKey) {
        clearTimeout(timeout);
        resolve({ success: false, message: 'No SSH private key found', error: 'No SSH key' });
        return;
      }

      client.on('ready', () => {
        const uninstallScript = this.generateUninstallScript(instanceId);

        client.exec(uninstallScript, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            client.end();
            resolve({ success: false, message: 'Failed to execute uninstall script', error: err.message });
            return;
          }

          let stdout = '';
          let stderr = '';

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });

          stream.on('close', (code: number) => {
            clearTimeout(timeout);
            client.end();

            if (code !== 0) {
              resolve({
                success: false,
                message: `Hook uninstallation failed with code ${code}`,
                error: stderr || stdout,
              });
            } else {
              resolve({
                success: true,
                message: 'Hooks uninstalled successfully',
              });
            }
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        client.end();
        resolve({ success: false, message: 'SSH connection error', error: err.message });
      });

      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey,
        readyTimeout: 15000,
      });
    });
  }

  /**
   * Generate script to remove Yojimbo hooks (hooks that call localhost:3456)
   * Since hooks are shared across instances on the same machine, this removes
   * all hooks that look like they were installed by Yojimbo.
   * Uses base64 encoding to work with any default shell (bash, zsh, nushell, fish, etc.)
   */
  private generateUninstallScript(_instanceId: string): string {
    // The actual bash script to run
    const bashScript = `set -e

SETTINGS_FILE="$HOME/.claude/settings.json"

if [ ! -f "$SETTINGS_FILE" ]; then
  echo "No settings file found, nothing to uninstall"
  exit 0
fi

# Backup existing settings
cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup.$(date +%Y%m%d%H%M%S)"

# Remove Yojimbo hooks (those that call localhost:3456) using Python
python3 -c '
import json
import os

settings_file = os.path.expanduser("~/.claude/settings.json")

try:
    with open(settings_file, "r") as f:
        settings = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    print("No valid settings file")
    exit(0)

if "hooks" not in settings:
    print("No hooks in settings")
    exit(0)

# Remove hooks that call localhost:3456 (Yojimbo hooks)
hooks = settings["hooks"]
for hook_type in list(hooks.keys()):
    hook_list = hooks[hook_type]
    if isinstance(hook_list, list):
        # Filter out hooks that call localhost:3456
        hooks[hook_type] = [
            h for h in hook_list
            if not (isinstance(h, dict) and "localhost:3456" in str(h))
        ]
        # Remove empty hook types
        if not hooks[hook_type]:
            del hooks[hook_type]

# Remove hooks key if empty
if not hooks:
    del settings["hooks"]

with open(settings_file, "w") as f:
    json.dump(settings, f, indent=2)

print("Hooks removed successfully")
'

echo "Hook uninstallation complete"`;

    // Base64 encode the script and wrap in a command that works in any shell
    const base64Script = Buffer.from(bashScript).toString('base64');
    return `bash -c 'echo ${base64Script} | base64 -d | bash'`;
  }

  /**
   * Get hooks configuration for preview (public method for API)
   */
  getHooksConfigForPreview(instanceId: string, orchestratorUrl: string, machineId?: string): object {
    return this.generateHooksConfig(instanceId, orchestratorUrl, machineId);
  }
}

export const hookInstallerService = new HookInstallerService();
export { HookInstallerService };
