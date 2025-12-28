import { EventEmitter } from 'events';
import { terminalManager } from './terminal-manager.service.js';

/**
 * PTY Service - Backward compatibility wrapper
 *
 * This service delegates to the TerminalManagerService for backward compatibility.
 * New code should use terminalManager directly.
 *
 * @deprecated Use terminalManager from terminal-manager.service.ts instead
 */
class PTYService extends EventEmitter {
  constructor() {
    super();

    // Forward events from terminal manager
    terminalManager.on('data', (id: string, data: string) => {
      this.emit('data', id, data);
    });

    terminalManager.on('exit', (id: string, exitCode: number) => {
      this.emit('exit', id, exitCode);
    });
  }

  spawn(
    id: string,
    workingDir: string,
    cols = 80,
    rows = 24
  ): { id: string; workingDir: string } {
    // Spawn synchronously for backward compatibility
    // The actual spawn is async but we return immediately
    terminalManager
      .spawn(id, { workingDir, cols, rows, type: 'local' })
      .catch((err) => {
        console.error(`Failed to spawn PTY ${id}:`, err);
        this.emit('exit', id, 1);
      });

    return { id, workingDir };
  }

  write(id: string, data: string): void {
    terminalManager.write(id, data);
  }

  resize(id: string, cols: number, rows: number): void {
    terminalManager.resize(id, cols, rows);
  }

  kill(id: string): boolean {
    // Kill is async but we return sync for backward compatibility
    terminalManager.kill(id).catch((err) => {
      console.error(`Failed to kill PTY ${id}:`, err);
    });
    return terminalManager.has(id);
  }

  getPid(id: string): number | undefined {
    return terminalManager.getPid(id);
  }

  has(id: string): boolean {
    return terminalManager.has(id);
  }

  getAll(): string[] {
    return terminalManager.getAll();
  }

  killAll(): void {
    terminalManager.killAll().catch((err) => {
      console.error('Failed to kill all PTYs:', err);
    });
  }

  async getCwd(id: string): Promise<string | null> {
    return terminalManager.getCwd(id);
  }

  getHistory(id: string): string {
    return terminalManager.getHistory(id);
  }

  clearHistory(id: string): void {
    terminalManager.clearHistory(id);
  }
}

export const ptyService = new PTYService();
