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
 * Events emitted by terminal backends
 */
interface TerminalBackendEvents {
  data: (id: string, data: string) => void;
  exit: (id: string, exitCode: number) => void;
}

/**
 * Abstract base class for terminal backends
 * Provides common functionality like history management
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
   * Append data to history buffer
   */
  protected appendHistory(data: string): void {
    this.history += data;

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
