import { Client, ClientChannel } from 'ssh2';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { TerminalBackend, SpawnConfig, SSHConfig } from '../terminal-backend.js';
import { CONFIG } from '../../config/index.js';

/**
 * Get Anthropic API key from environment or macOS keychain
 * Returns the access token that can be used for API authentication
 */
function getAnthropicApiKey(): string | null {
  // First check environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  // Try to read from macOS keychain (Claude Code OAuth credentials)
  if (process.platform === 'darwin') {
    try {
      const username = os.userInfo().username;
      const credentialsJson = execSync(
        `security find-generic-password -s "Claude Code-credentials" -a "${username}" -w 2>/dev/null`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();

      if (credentialsJson) {
        const credentials = JSON.parse(credentialsJson);
        if (credentials.claudeAiOauth?.accessToken) {
          return credentials.claudeAiOauth.accessToken;
        }
      }
    } catch {
      // Keychain access failed or credentials not found
    }
  }

  return null;
}

/**
 * SSH Backend - Remote terminal via SSH
 * Connects to a remote machine and creates a shell session
 */
export class SSHBackend extends TerminalBackend {
  private client: Client;
  private channel: ClientChannel | null = null;
  private sshConfig: SSHConfig;
  private initialWorkingDir: string = '';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  // Sync frame buffering - buffer complete frames before emitting
  // This is needed because SSH delivers data based on TCP packet boundaries,
  // which can split DEC mode 2026 sync frames across multiple callbacks
  private syncOutputBuffer: string = '';
  private inSyncMode: boolean = false;


  constructor(id: string, sshConfig: SSHConfig, maxHistorySize?: number) {
    super(id, 'ssh', maxHistorySize ?? CONFIG.runtime.terminalMaxHistoryBytes);
    this.sshConfig = sshConfig;
    this.client = new Client();
    this.setupClientEvents();
  }

  /**
   * Filter out Cursor Position Report (CPR) sequences from output
   *
   * When programs send ESC[6n to query cursor position, the terminal responds
   * with ESC[row;colR. In SSH sessions, these responses can leak into the output
   * stream and appear as gibberish like "[48;1R[46;1R". We filter them out.
   */
  private filterCursorPositionReports(data: string): string {
    // CPR format: ESC [ row ; col R  (e.g., \x1b[48;1R)
    // Also handle partial sequences where ESC may be missing (just [48;1R)
    // eslint-disable-next-line no-control-regex
    return data.replace(/\x1b?\[\d+;\d+R/g, '');
  }

  /**
   * Process SSH output with sync frame buffering
   *
   * SSH delivers data based on TCP packet boundaries (512-4KB chunks),
   * which can split DEC mode 2026 sync frames across multiple callbacks.
   * We buffer complete sync frames and emit them atomically to prevent
   * visual glitches in terminal animations like Claude Code's thinking spinner.
   */
  private processSyncOutput(data: string): void {
    // First filter out any CPR sequences that leaked into the output
    data = this.filterCursorPositionReports(data);

    const SYNC_START = '\x1b[?2026h';
    const SYNC_END = '\x1b[?2026l';

    // Debug: Check for potential blank line causes
    const DEBUG_ANIMATION = process.env.DEBUG_ANIMATION === '1';
    if (DEBUG_ANIMATION) {
      // Look for patterns that might cause blank lines
      const hasStandaloneNewline = /[^\r]\n/.test(data) || data.startsWith('\n');
      const hasEmptyLine = /\n\s*\n/.test(data);
      // eslint-disable-next-line no-control-regex
      const hasCursorUp = /\x1b\[\d*A/.test(data);
      // eslint-disable-next-line no-control-regex
      const hasEraseLine = /\x1b\[2?K/.test(data);
      const hasSyncMarker = data.includes(SYNC_START) || data.includes(SYNC_END);

      if (hasSyncMarker || hasEmptyLine || (hasStandaloneNewline && hasCursorUp)) {
        const hexPreview = [...Buffer.from(data.slice(0, 200))]
          .map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`[SSH ${this.id}] DEBUG processSyncOutput:`, {
          len: data.length,
          hasStandaloneNewline,
          hasEmptyLine,
          hasCursorUp,
          hasEraseLine,
          hasSyncMarker,
          inSyncMode: this.inSyncMode,
          bufferLen: this.syncOutputBuffer.length,
          preview: JSON.stringify(data.slice(0, 100)),
          hex: hexPreview,
        });
      }
    }

    let remaining = data;

    while (remaining.length > 0) {
      if (this.inSyncMode) {
        // Currently buffering a sync frame - look for end marker
        const endIdx = remaining.indexOf(SYNC_END);
        if (endIdx !== -1) {
          // Found end - complete the buffer and emit atomically
          this.syncOutputBuffer += remaining.slice(0, endIdx + SYNC_END.length);
          remaining = remaining.slice(endIdx + SYNC_END.length);
          this.inSyncMode = false;
          // Emit complete sync frame as a single atomic unit
          this.emitData(this.syncOutputBuffer);
          this.syncOutputBuffer = '';
        } else {
          // No end marker found - buffer everything and wait for more data
          this.syncOutputBuffer += remaining;
          remaining = '';
        }
      } else {
        // Not in sync mode - look for start marker
        const startIdx = remaining.indexOf(SYNC_START);
        if (startIdx !== -1) {
          // Found start - emit any content before it, then start buffering
          if (startIdx > 0) {
            this.emitData(remaining.slice(0, startIdx));
          }
          this.inSyncMode = true;
          this.syncOutputBuffer = SYNC_START;
          remaining = remaining.slice(startIdx + SYNC_START.length);
        } else {
          // No sync markers - emit directly
          this.emitData(remaining);
          remaining = '';
        }
      }
    }
  }

  /**
   * Set up SSH client event handlers
   */
  private setupClientEvents(): void {
    this.client.on('error', (err) => {
      console.error(`[SSH ${this.id}] Connection error:`, err.message);
      this.emitData(`\r\n\x1b[31mSSH Error: ${err.message}\x1b[0m\r\n`);
    });

    this.client.on('close', () => {
      console.log(`[SSH ${this.id}] Connection closed`);
      if (this.alive) {
        this.handleDisconnect();
      }
    });

    this.client.on('end', () => {
      console.log(`[SSH ${this.id}] Connection ended`);
    });
  }

  /**
   * Handle unexpected disconnection with reconnection attempt
   */
  private async handleDisconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`[SSH ${this.id}] Max reconnection attempts reached`);
      this.emitData('\r\n\x1b[31mConnection lost. Max reconnection attempts reached.\x1b[0m\r\n');
      this.emitExit(1);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.emitData(`\r\n\x1b[33mConnection lost. Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...\x1b[0m\r\n`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.connect();
      await this.startShell();
      this.reconnectAttempts = 0;
      this.emitData('\r\n\x1b[32mReconnected successfully.\x1b[0m\r\n');
    } catch (err) {
      console.error(`[SSH ${this.id}] Reconnection failed:`, err);
      this.handleDisconnect();
    }
  }

  /**
   * Connect to the remote host
   */
  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Read private key if path provided
      let privateKey: Buffer | undefined;
      if (this.sshConfig.privateKeyPath) {
        const keyPath = this.sshConfig.privateKeyPath.replace(/^~/, os.homedir());
        try {
          privateKey = fs.readFileSync(keyPath);
        } catch (err) {
          reject(new Error(`Failed to read SSH key: ${keyPath}`));
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
        reject(new Error('No SSH private key found'));
        return;
      }

      this.client.once('ready', () => {
        console.log(`[SSH ${this.id}] Connected to ${this.sshConfig.host}`);
        resolve();
      });

      this.client.once('error', (err) => {
        reject(err);
      });

      this.client.connect({
        host: this.sshConfig.host,
        port: this.sshConfig.port,
        username: this.sshConfig.username,
        privateKey,
        readyTimeout: 10000,
        keepaliveInterval: 30000,
        keepaliveCountMax: 3,
      });
    });
  }

  /**
   * Start a shell session
   * Uses shell() with PTY for proper interactive terminal handling
   */
  private startShell(cols = 80, rows = 24): Promise<void> {
    return new Promise((resolve, reject) => {
      // PseudoTtyOptions for ssh2
      const ptyOptions = {
        term: 'xterm-256color',
        cols,
        rows,
      };

      // Use shell() for proper interactive terminal session
      // This creates a login shell with proper PTY handling
      this.client.shell(ptyOptions, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          this.channel = stream;

          stream.on('data', (data: Buffer) => {
            this.processSyncOutput(data.toString());
          });

          stream.stderr.on('data', (data: Buffer) => {
            this.processSyncOutput(data.toString());
          });

          stream.on('close', () => {
            console.log(`[SSH ${this.id}] Shell closed`);
            this.channel = null;
            if (this.alive) {
              this.emitExit(0);
            }
          });

          // Wait for shell to be ready before sending commands
          setTimeout(() => {
            if (this.channel) {
              // Conditionally forward credentials from local machine
              if (this.sshConfig.forwardCredentials) {
                const apiKey = getAnthropicApiKey();
                if (apiKey) {
                  console.log(`[SSH ${this.id}] Forwarding Anthropic API key to remote session`);
                  this.channel.write(`export ANTHROPIC_API_KEY=${this.escapeShellArg(apiKey)}\n`);
                } else {
                  console.log(`[SSH ${this.id}] Forward credentials enabled but no API key found locally`);
                }
              }

              // Change to working directory if specified and not home
              if (this.initialWorkingDir && this.initialWorkingDir !== '~') {
                // Handle tilde expansion: paths starting with ~ shouldn't be quoted
                const cdPath = this.initialWorkingDir.startsWith('~/')
                  ? `~/${this.escapeShellArg(this.initialWorkingDir.slice(2))}`
                  : this.escapeShellArg(this.initialWorkingDir);
                this.channel.write(`cd ${cdPath}\n`);
              }
            }
            resolve();
          }, 300);
        }
      );
    });
  }

  /**
   * Escape shell argument to prevent injection
   */
  private escapeShellArg(arg: string): string {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Spawn the SSH terminal session
   */
  async spawn(config: SpawnConfig): Promise<void> {
    this.initialWorkingDir = config.workingDir.replace(/^~/, '~'); // Keep ~ for remote expansion
    const cols = config.cols ?? 80;
    const rows = config.rows ?? 24;

    console.log(`[SSH ${this.id}] Connecting to ${this.sshConfig.username}@${this.sshConfig.host}:${this.sshConfig.port}`);

    try {
      await this.connect();
      await this.startShell(cols, rows);
      this.alive = true;
      console.log(`[SSH ${this.id}] Shell started in ${this.initialWorkingDir}`);
    } catch (err) {
      console.error(`[SSH ${this.id}] Failed to spawn:`, err);
      throw err;
    }
  }

  /**
   * Get process ID (not applicable for SSH - returns undefined)
   */
  getPid(): number | undefined {
    // SSH sessions don't have a local PID
    return undefined;
  }

  /**
   * Get current working directory
   * Note: This is approximate - we track it from the initial value
   */
  async getCwd(): Promise<string | null> {
    // For SSH, we can't easily get the remote CWD
    // Return the initial working directory as a fallback
    return this.initialWorkingDir || null;
  }

  /**
   * Write data to the terminal
   */
  write(data: string): void {
    if (this.channel) {
      this.channel.write(data);
    }
  }

  /**
   * Resize the terminal
   */
  resize(cols: number, rows: number): void {
    if (this.channel) {
      this.channel.setWindow(rows, cols, 0, 0);
    }
  }

  /**
   * Kill the SSH session
   */
  async kill(): Promise<boolean> {
    console.log(`[SSH ${this.id}] Killing session`);
    this.alive = false;

    // Flush any buffered sync data before cleanup
    if (this.syncOutputBuffer) {
      this.emitData(this.syncOutputBuffer);
      this.syncOutputBuffer = '';
      this.inSyncMode = false;
    }

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    this.client.end();
    return true;
  }

  /**
   * Get the SSH configuration
   */
  getSSHConfig(): SSHConfig {
    return this.sshConfig;
  }
}
