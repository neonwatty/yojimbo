import { EventEmitter } from 'events';

/**
 * Terminal backend types
 */
export type TerminalBackendType = 'local' | 'ssh';

/**
 * Configuration for spawning a terminal
 */
export interface SpawnConfig {
  workingDir: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

/**
 * SSH-specific configuration
 */
export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  forwardCredentials?: boolean;
}

/**
 * Interface for terminal backends
 * Both local PTY and SSH backends implement this interface
 */
export interface ITerminalBackend {
  /** Unique identifier for this backend instance */
  readonly id: string;

  /** Type of backend (local or ssh) */
  readonly type: TerminalBackendType;

  /** Whether the terminal is currently alive */
  isAlive(): boolean;

  /** Get the process ID (if applicable) */
  getPid(): number | undefined;

  /** Get current working directory */
  getCwd(): Promise<string | null>;

  /** Write data to the terminal */
  write(data: string): void;

  /** Resize the terminal */
  resize(cols: number, rows: number): void;

  /** Kill the terminal process */
  kill(): Promise<boolean>;

  /** Get terminal output history */
  getHistory(): string;

  /** Clear terminal output history */
  clearHistory(): void;
}

/**
 * Abstract base class for terminal backends.
 * Provides common functionality like history management.
 *
 * Events emitted:
 * - 'data': (id: string, data: string) => void
 * - 'exit': (id: string, exitCode: number) => void
 */
export abstract class TerminalBackend extends EventEmitter implements ITerminalBackend {
  protected history: string = '';
  protected maxHistorySize: number;
  protected alive: boolean = false;

  constructor(
    public readonly id: string,
    public readonly type: TerminalBackendType,
    maxHistorySize: number = 100 * 1024 // 100KB default
  ) {
    super();
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Spawn the terminal process
   */
  abstract spawn(config: SpawnConfig): Promise<void>;

  /**
   * Check if terminal is alive
   */
  isAlive(): boolean {
    return this.alive;
  }

  /**
   * Get process ID
   */
  abstract getPid(): number | undefined;

  /**
   * Get current working directory
   */
  abstract getCwd(): Promise<string | null>;

  /**
   * Write data to terminal
   */
  abstract write(data: string): void;

  /**
   * Resize terminal
   */
  abstract resize(cols: number, rows: number): void;

  /**
   * Kill terminal process
   */
  abstract kill(): Promise<boolean>;

  /**
   * Get terminal output history
   */
  getHistory(): string {
    return this.history;
  }

  /**
   * Clear terminal output history
   */
  clearHistory(): void {
    this.history = '';
  }

  /**
   * Append data to history buffer with ANSI escape sequence handling.
   * Processes cursor movement and line clearing sequences to properly handle
   * spinner/progress animations that update in place.
   *
   * Handled sequences:
   * - \r (carriage return) - move to start of current line
   * - \x1b[nA (cursor up n lines)
   * - \x1b[2K (clear entire line)
   * - \x1b[G or \x1b[1G (cursor to column 1)
   */
  protected appendHistory(data: string): void {
    // Split history into lines for manipulation
    const lines = this.history.split('\n');
    let currentLineIndex = lines.length - 1;

    let i = 0;
    while (i < data.length) {
      // Check for escape sequences
      if (data[i] === '\x1b' && data[i + 1] === '[') {
        // Parse ANSI escape sequence
        let j = i + 2;
        let params = '';
        while (j < data.length && /[0-9;]/.test(data[j])) {
          params += data[j];
          j++;
        }
        const command = data[j];

        if (command === 'A') {
          // Cursor up - \x1b[nA (default n=1)
          const n = parseInt(params) || 1;
          currentLineIndex = Math.max(0, currentLineIndex - n);
          i = j + 1;
          continue;
        } else if (command === 'K') {
          // Clear line - \x1b[2K clears entire line, \x1b[K clears to end
          if (params === '2' || params === '') {
            // Clear entire line or clear to end - just clear the current line
            if (currentLineIndex < lines.length) {
              lines[currentLineIndex] = '';
            }
          }
          i = j + 1;
          continue;
        } else if (command === 'G') {
          // Cursor to column - \x1b[nG (move to column n, default 1)
          // For history purposes, treat as move to start of line (clear line content after cursor)
          // We'll just skip this as it's handled with clear line
          i = j + 1;
          continue;
        } else if (command === 'J') {
          // Clear screen - skip for history
          i = j + 1;
          continue;
        } else {
          // Other escape sequence - keep in output but don't process
          // Append the escape sequence as-is
          if (currentLineIndex < lines.length) {
            lines[currentLineIndex] += data.slice(i, j + 1);
          }
          i = j + 1;
          continue;
        }
      }

      // Check for carriage return
      if (data[i] === '\r') {
        if (data[i + 1] === '\n') {
          // \r\n - newline
          currentLineIndex++;
          if (currentLineIndex >= lines.length) {
            lines.push('');
          }
          i += 2;
          continue;
        } else {
          // Standalone \r - move to start of line, clear it for overwrite
          if (currentLineIndex < lines.length) {
            lines[currentLineIndex] = '';
          }
          i++;
          continue;
        }
      }

      // Check for newline
      if (data[i] === '\n') {
        currentLineIndex++;
        if (currentLineIndex >= lines.length) {
          lines.push('');
        }
        i++;
        continue;
      }

      // Regular character - append to current line
      if (currentLineIndex >= lines.length) {
        lines.push('');
      }
      lines[currentLineIndex] += data[i];
      i++;
    }

    // Rejoin lines
    this.history = lines.join('\n');

    // Trim history if it exceeds max size (keep most recent)
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Emit data event and append to history
   */
  protected emitData(data: string): void {
    this.appendHistory(data);
    this.emit('data', this.id, data);
  }

  /**
   * Emit exit event
   */
  protected emitExit(exitCode: number): void {
    this.alive = false;
    this.emit('exit', this.id, exitCode);
  }
}
