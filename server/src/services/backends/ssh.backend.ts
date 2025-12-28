import { Client, ClientChannel } from 'ssh2';
import fs from 'fs';
import os from 'os';
import { TerminalBackend, SpawnConfig, SSHConfig } from '../terminal-backend.js';
import { CONFIG } from '../../config/index.js';

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

  constructor(id: string, sshConfig: SSHConfig, maxHistorySize?: number) {
    super(id, 'ssh', maxHistorySize ?? CONFIG.runtime.terminalMaxHistoryBytes);
    this.sshConfig = sshConfig;
    this.client = new Client();
    this.setupClientEvents();
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
   */
  private startShell(cols = 80, rows = 24): Promise<void> {
    return new Promise((resolve, reject) => {
      // PseudoTtyOptions for ssh2
      const ptyOptions = {
        term: 'xterm-256color',
        cols,
        rows,
      };

      this.client.shell(ptyOptions, { env: { CC_INSTANCE_ID: this.id } }, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          this.channel = stream;

          stream.on('data', (data: Buffer) => {
            this.emitData(data.toString());
          });

          stream.stderr.on('data', (data: Buffer) => {
            this.emitData(data.toString());
          });

          stream.on('close', () => {
            console.log(`[SSH ${this.id}] Shell closed`);
            this.channel = null;
            if (this.alive) {
              this.emitExit(0);
            }
          });

          // Change to working directory
          if (this.initialWorkingDir) {
            stream.write(`cd ${this.escapeShellArg(this.initialWorkingDir)}\n`);
          }

          resolve();
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
