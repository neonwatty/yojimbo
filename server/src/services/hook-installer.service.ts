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

    return this.installHooks(sshConfig, instanceId, orchestratorUrl);
  }

  /**
   * Install hooks on a remote machine via SSH
   */
  async installHooks(
    config: SSHConfig,
    instanceId: string,
    orchestratorUrl: string
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
          const hooksConfig = this.generateHooksConfig(instanceId, orchestratorUrl);

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
   */
  private generateHooksConfig(instanceId: string, orchestratorUrl: string): object {
    const baseUrl = orchestratorUrl.replace(/\/$/, '');

    // Create curl commands for each hook
    // Shell quoting: 'literal'"$VAR"'literal' concatenates single-quoted and double-quoted parts
    const statusWorkingCmd = `curl -s -X POST "${baseUrl}/api/hooks/status" -H "Content-Type: application/json" -d '{"event":"working","projectDir":"'"$CWD"'","instanceId":"${instanceId}"}'`;
    const stopCmd = `curl -s -X POST "${baseUrl}/api/hooks/stop" -H "Content-Type: application/json" -d '{"projectDir":"'"$CWD"'","instanceId":"${instanceId}"}'`;
    const notificationCmd = `curl -s -X POST "${baseUrl}/api/hooks/notification" -H "Content-Type: application/json" -d '{"projectDir":"'"$CWD"'","instanceId":"${instanceId}"}'`;

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
   */
  private generateInstallScript(hooksConfig: object): string {
    const hooksJson = JSON.stringify(hooksConfig, null, 2);

    // Escape single quotes in the JSON for the shell script
    const escapedJson = hooksJson.replace(/'/g, "'\"'\"'");

    return `
      set -e

      CLAUDE_DIR="$HOME/.claude"
      SETTINGS_FILE="$CLAUDE_DIR/settings.json"

      # Create .claude directory if it doesn't exist
      mkdir -p "$CLAUDE_DIR"

      # Check if settings.json exists
      if [ -f "$SETTINGS_FILE" ]; then
        # Backup existing settings
        cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup.$(date +%Y%m%d%H%M%S)"

        # Read existing settings and merge with new hooks
        # Using Python for JSON manipulation as it's commonly available
        python3 << 'PYTHON_SCRIPT'
import json
import os

settings_file = os.path.expanduser("~/.claude/settings.json")
new_hooks = ${JSON.stringify(hooksConfig)}

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

print("Hooks merged successfully")
PYTHON_SCRIPT
      else
        # Create new settings file with hooks
        echo '${escapedJson}' > "$SETTINGS_FILE"
        echo "Settings file created with hooks"
      fi

      echo "Hook installation complete"
    `;
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
   * Generate script to remove hooks containing the instance ID
   */
  private generateUninstallScript(instanceId: string): string {
    return `
      set -e

      SETTINGS_FILE="$HOME/.claude/settings.json"

      if [ ! -f "$SETTINGS_FILE" ]; then
        echo "No settings file found, nothing to uninstall"
        exit 0
      fi

      # Backup existing settings
      cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup.$(date +%Y%m%d%H%M%S)"

      # Remove hooks containing this instance ID using Python
      python3 << 'PYTHON_SCRIPT'
import json
import os

settings_file = os.path.expanduser("~/.claude/settings.json")
instance_id = "${instanceId}"

try:
    with open(settings_file, 'r') as f:
        settings = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    print("No valid settings file")
    exit(0)

if 'hooks' not in settings:
    print("No hooks in settings")
    exit(0)

# Remove hooks that contain this instance ID
hooks = settings['hooks']
for hook_type in list(hooks.keys()):
    hook_list = hooks[hook_type]
    if isinstance(hook_list, list):
        # Filter out hooks containing this instance ID
        hooks[hook_type] = [
            h for h in hook_list
            if not (isinstance(h, str) and instance_id in h) and
               not (isinstance(h, dict) and instance_id in str(h))
        ]
        # Remove empty hook types
        if not hooks[hook_type]:
            del hooks[hook_type]

# Remove hooks key if empty
if not hooks:
    del settings['hooks']

with open(settings_file, 'w') as f:
    json.dump(settings, f, indent=2)

print("Hooks removed successfully")
PYTHON_SCRIPT

      echo "Hook uninstallation complete"
    `;
  }

  /**
   * Get hooks configuration for preview (public method for API)
   */
  getHooksConfigForPreview(instanceId: string, orchestratorUrl: string): object {
    return this.generateHooksConfig(instanceId, orchestratorUrl);
  }
}

export const hookInstallerService = new HookInstallerService();
export { HookInstallerService };
