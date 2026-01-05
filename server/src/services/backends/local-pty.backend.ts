import * as pty from 'node-pty';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { TerminalBackend, SpawnConfig } from '../terminal-backend.js';
import { CONFIG } from '../../config/index.js';

const execAsync = promisify(exec);

/**
 * Local PTY backend using node-pty
 * Spawns a pseudo-terminal on the local machine
 */
export class LocalPTYBackend extends TerminalBackend {
  private ptyProcess: pty.IPty | null = null;
  private initialWorkingDir: string = '';

  constructor(id: string, maxHistorySize?: number) {
    super(id, 'local', maxHistorySize ?? CONFIG.runtime.terminalMaxHistoryBytes);
  }

  /**
   * Spawn a local PTY process
   * Note: node-pty spawn is synchronous, so this is effectively sync
   */
  async spawn(config: SpawnConfig): Promise<void> {
    const shell =
      process.platform === 'win32'
        ? 'powershell.exe'
        : process.env.SHELL || '/bin/zsh';

    // Expand ~ to home directory
    const cwd = config.workingDir.replace(/^~/, os.homedir());
    this.initialWorkingDir = cwd;

    const cols = config.cols ?? 80;
    const rows = config.rows ?? 24;

    this.ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        ...config.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        CC_INSTANCE_ID: this.id, // Pass instance ID to child processes (used by hooks)
      },
    });

    this.alive = true;

    this.ptyProcess.onData((data) => {
      // Debug: log if standalone \n detected (without \r)
      if (data.includes('\n') && !data.includes('\r\n') && data.includes('\x1b[')) {
        const hexBytes = [...Buffer.from(data)].slice(0, 100).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`[LOCAL ${this.id}] DEBUG escape+standalone \\n:`, JSON.stringify(data.slice(0, 80)), 'hex:', hexBytes);
      }
      this.emitData(data);
    });

    this.ptyProcess.onExit(({ exitCode }) => {
      this.emitExit(exitCode);
      this.ptyProcess = null;
    });

    console.log(`🖥️  PTY spawned: ${this.id} (pid: ${this.ptyProcess.pid}) in ${cwd}`);
  }

  /**
   * Get process ID
   */
  getPid(): number | undefined {
    return this.ptyProcess?.pid;
  }

  /**
   * Get current working directory
   */
  async getCwd(): Promise<string | null> {
    if (!this.ptyProcess) return this.initialWorkingDir || null;

    const pid = this.ptyProcess.pid;
    try {
      if (process.platform === 'darwin') {
        // macOS: use lsof to get cwd
        const { stdout } = await execAsync(`lsof -p ${pid} | grep cwd | awk '{print $9}'`);
        return stdout.trim() || this.initialWorkingDir || null;
      } else if (process.platform === 'linux') {
        // Linux: use /proc filesystem
        const { stdout } = await execAsync(`readlink /proc/${pid}/cwd`);
        return stdout.trim() || this.initialWorkingDir || null;
      }
      return this.initialWorkingDir || null;
    } catch {
      // Process may have exited or other error - fall back to initial working directory
      return this.initialWorkingDir || null;
    }
  }

  /**
   * Write data to terminal
   */
  write(data: string): void {
    if (this.ptyProcess) {
      this.ptyProcess.write(data);
    }
  }

  /**
   * Resize terminal
   */
  resize(cols: number, rows: number): void {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows);
    }
  }

  /**
   * Kill terminal process
   */
  async kill(): Promise<boolean> {
    if (this.ptyProcess) {
      console.log(`🛑 Killing PTY: ${this.id}`);
      this.ptyProcess.kill();
      this.ptyProcess = null;
      this.alive = false;
      return true;
    }
    return false;
  }
}
