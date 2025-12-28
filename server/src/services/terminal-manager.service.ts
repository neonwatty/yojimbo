import { EventEmitter } from 'events';
import { TerminalBackend, TerminalBackendType, SpawnConfig, SSHConfig } from './terminal-backend.js';
import { LocalPTYBackend } from './backends/local-pty.backend.js';

/**
 * Configuration for spawning a terminal
 */
export interface TerminalSpawnOptions extends SpawnConfig {
  /** Type of backend to use */
  type?: TerminalBackendType;
  /** Machine ID for remote backends */
  machineId?: string;
  /** SSH config (required for ssh type) */
  sshConfig?: SSHConfig;
}

/**
 * Terminal Manager Service
 * Manages terminal backends (local PTY and SSH)
 */
class TerminalManagerService extends EventEmitter {
  private backends: Map<string, TerminalBackend> = new Map();

  /**
   * Spawn a new terminal backend
   */
  async spawn(id: string, options: TerminalSpawnOptions): Promise<TerminalBackend> {
    const type = options.type ?? 'local';

    let backend: TerminalBackend;

    if (type === 'local') {
      backend = new LocalPTYBackend(id);
    } else if (type === 'ssh') {
      // SSH backend will be implemented in Phase 3
      // For now, throw an error
      throw new Error('SSH backend not yet implemented');
    } else {
      throw new Error(`Unknown backend type: ${type}`);
    }

    // Forward events from backend to manager
    backend.on('data', (backendId: string, data: string) => {
      this.emit('data', backendId, data);
    });

    backend.on('exit', (backendId: string, exitCode: number) => {
      this.emit('exit', backendId, exitCode);
      this.backends.delete(backendId);
    });

    // Spawn the terminal
    await backend.spawn({
      workingDir: options.workingDir,
      cols: options.cols,
      rows: options.rows,
      env: options.env,
    });

    this.backends.set(id, backend);
    return backend;
  }

  /**
   * Write data to a terminal
   */
  write(id: string, data: string): void {
    const backend = this.backends.get(id);
    if (backend) {
      backend.write(data);
    }
  }

  /**
   * Resize a terminal
   */
  resize(id: string, cols: number, rows: number): void {
    const backend = this.backends.get(id);
    if (backend) {
      backend.resize(cols, rows);
    }
  }

  /**
   * Kill a terminal
   */
  async kill(id: string): Promise<boolean> {
    const backend = this.backends.get(id);
    if (backend) {
      const result = await backend.kill();
      this.backends.delete(id);
      return result;
    }
    return false;
  }

  /**
   * Get process ID for a terminal
   */
  getPid(id: string): number | undefined {
    return this.backends.get(id)?.getPid();
  }

  /**
   * Check if a terminal exists
   */
  has(id: string): boolean {
    return this.backends.has(id);
  }

  /**
   * Get all terminal IDs
   */
  getAll(): string[] {
    return Array.from(this.backends.keys());
  }

  /**
   * Kill all terminals
   */
  async killAll(): Promise<void> {
    for (const id of this.backends.keys()) {
      await this.kill(id);
    }
  }

  /**
   * Get current working directory for a terminal
   */
  async getCwd(id: string): Promise<string | null> {
    const backend = this.backends.get(id);
    if (backend) {
      return backend.getCwd();
    }
    return null;
  }

  /**
   * Get terminal output history
   */
  getHistory(id: string): string {
    return this.backends.get(id)?.getHistory() ?? '';
  }

  /**
   * Clear terminal output history
   */
  clearHistory(id: string): void {
    this.backends.get(id)?.clearHistory();
  }

  /**
   * Get backend type for a terminal
   */
  getType(id: string): TerminalBackendType | undefined {
    return this.backends.get(id)?.type;
  }

  /**
   * Get a backend instance
   */
  getBackend(id: string): TerminalBackend | undefined {
    return this.backends.get(id);
  }
}

export const terminalManager = new TerminalManagerService();
