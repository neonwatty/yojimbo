import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PTYInstance {
  id: string;
  pty: pty.IPty;
  workingDir: string;
}

class PTYService extends EventEmitter {
  private instances: Map<string, PTYInstance> = new Map();

  spawn(id: string, workingDir: string, cols = 80, rows = 24): PTYInstance {
    const shell = process.platform === 'win32'
      ? 'powershell.exe'
      : process.env.SHELL || '/bin/zsh';

    // Expand ~ to home directory
    const cwd = workingDir.replace(/^~/, os.homedir());

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        CC_INSTANCE_ID: id, // Pass instance ID to child processes (used by hooks)
      },
    });

    const instance: PTYInstance = { id, pty: ptyProcess, workingDir };
    this.instances.set(id, instance);

    ptyProcess.onData((data) => {
      this.emit('data', id, data);
    });

    ptyProcess.onExit(({ exitCode }) => {
      this.emit('exit', id, exitCode);
      this.instances.delete(id);
    });

    console.log(`🖥️  PTY spawned: ${id} (pid: ${ptyProcess.pid}) in ${cwd}`);

    return instance;
  }

  write(id: string, data: string): void {
    const instance = this.instances.get(id);
    if (instance) {
      instance.pty.write(data);
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const instance = this.instances.get(id);
    if (instance) {
      instance.pty.resize(cols, rows);
    }
  }

  kill(id: string): boolean {
    const instance = this.instances.get(id);
    if (instance) {
      console.log(`🛑 Killing PTY: ${id}`);
      instance.pty.kill();
      this.instances.delete(id);
      return true;
    }
    return false;
  }

  getPid(id: string): number | undefined {
    return this.instances.get(id)?.pty.pid;
  }

  has(id: string): boolean {
    return this.instances.has(id);
  }

  getAll(): string[] {
    return Array.from(this.instances.keys());
  }

  killAll(): void {
    for (const [id] of this.instances) {
      this.kill(id);
    }
  }

  async getCwd(id: string): Promise<string | null> {
    const instance = this.instances.get(id);
    if (!instance) return null;

    const pid = instance.pty.pid;
    try {
      if (process.platform === 'darwin') {
        // macOS: use lsof to get cwd
        const { stdout } = await execAsync(`lsof -p ${pid} | grep cwd | awk '{print $9}'`);
        return stdout.trim() || null;
      } else if (process.platform === 'linux') {
        // Linux: use /proc filesystem
        const { stdout } = await execAsync(`readlink /proc/${pid}/cwd`);
        return stdout.trim() || null;
      }
      return null;
    } catch {
      // Process may have exited or other error
      return null;
    }
  }
}

export const ptyService = new PTYService();
