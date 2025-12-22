import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import os from 'os';

export interface TerminalOptions {
  id: string;
  workingDir: string;
  cols?: number;
  rows?: number;
  shell?: string;
}

export interface Terminal {
  id: string;
  pty: pty.IPty;
  workingDir: string;
}

type TerminalEventMap = {
  data: [id: string, data: string];
  exit: [id: string, exitCode: number];
  error: [id: string, error: Error];
};

export class TerminalManager extends EventEmitter<TerminalEventMap> {
  private terminals: Map<string, Terminal> = new Map();
  private defaultShell: string;

  constructor() {
    super();
    this.defaultShell = this.getDefaultShell();
  }

  private getDefaultShell(): string {
    if (process.env.SHELL) {
      return process.env.SHELL;
    }
    return os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh';
  }

  spawn(options: TerminalOptions): Terminal {
    const { id, workingDir, cols = 80, rows = 24, shell } = options;

    if (this.terminals.has(id)) {
      throw new Error(`Terminal ${id} already exists`);
    }

    const ptyProcess = pty.spawn(shell || this.defaultShell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: workingDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    const terminal: Terminal = {
      id,
      pty: ptyProcess,
      workingDir,
    };

    // Forward data events
    ptyProcess.onData((data) => {
      this.emit('data', id, data);
    });

    // Handle exit
    ptyProcess.onExit(({ exitCode }) => {
      this.terminals.delete(id);
      this.emit('exit', id, exitCode);
    });

    this.terminals.set(id, terminal);
    return terminal;
  }

  write(id: string, data: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      throw new Error(`Terminal ${id} not found`);
    }
    terminal.pty.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      throw new Error(`Terminal ${id} not found`);
    }
    terminal.pty.resize(cols, rows);
  }

  kill(id: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return; // Already killed or doesn't exist
    }
    terminal.pty.kill();
    this.terminals.delete(id);
  }

  get(id: string): Terminal | undefined {
    return this.terminals.get(id);
  }

  has(id: string): boolean {
    return this.terminals.has(id);
  }

  list(): string[] {
    return Array.from(this.terminals.keys());
  }

  killAll(): void {
    for (const id of this.terminals.keys()) {
      this.kill(id);
    }
  }
}

// Singleton instance
let terminalManager: TerminalManager | null = null;

export function getTerminalManager(): TerminalManager {
  if (!terminalManager) {
    terminalManager = new TerminalManager();
  }
  return terminalManager;
}
