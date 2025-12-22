import { FastifyPluginAsync } from 'fastify';
import * as pty from 'node-pty';
import * as os from 'os';

// Store vanilla terminal instances by working directory
const vanillaTerminals = new Map<string, pty.IPty>();

/**
 * Get the default shell for the current platform
 */
function getShell(): string {
  return process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : '/bin/zsh');
}

/**
 * Create a unique ID for a vanilla terminal based on working directory
 */
function getTerminalId(workingDir: string): string {
  return `vanilla:${workingDir}`;
}

export const vanillaTerminalRoutes: FastifyPluginAsync = async (fastify) => {
  // Spawn a vanilla terminal for a working directory
  fastify.post<{ Body: { workingDir: string } }>(
    '/api/vanilla-terminal/spawn',
    async (request, reply) => {
      const { workingDir } = request.body;

      if (!workingDir) {
        return reply.status(400).send({ error: 'workingDir is required' });
      }

      const terminalId = getTerminalId(workingDir);

      // Check if terminal already exists
      if (vanillaTerminals.has(terminalId)) {
        return { terminalId, alreadyExists: true };
      }

      try {
        const shell = getShell();
        const terminal = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: workingDir,
          env: process.env as Record<string, string>,
        });

        vanillaTerminals.set(terminalId, terminal);

        // Clean up on exit
        terminal.onExit(() => {
          vanillaTerminals.delete(terminalId);
        });

        return { terminalId, alreadyExists: false };
      } catch (error) {
        console.error('Failed to spawn vanilla terminal:', error);
        return reply.status(500).send({ error: 'Failed to spawn terminal' });
      }
    }
  );

  // Kill a vanilla terminal
  fastify.delete<{ Params: { workingDir: string } }>(
    '/api/vanilla-terminal/:workingDir',
    async (request, reply) => {
      const workingDir = decodeURIComponent(request.params.workingDir);
      const terminalId = getTerminalId(workingDir);

      const terminal = vanillaTerminals.get(terminalId);
      if (!terminal) {
        return reply.status(404).send({ error: 'Terminal not found' });
      }

      terminal.kill();
      vanillaTerminals.delete(terminalId);

      return { success: true };
    }
  );

  // Resize a vanilla terminal
  fastify.post<{ Body: { workingDir: string; cols: number; rows: number } }>(
    '/api/vanilla-terminal/resize',
    async (request, reply) => {
      const { workingDir, cols, rows } = request.body;
      const terminalId = getTerminalId(workingDir);

      const terminal = vanillaTerminals.get(terminalId);
      if (!terminal) {
        return reply.status(404).send({ error: 'Terminal not found' });
      }

      terminal.resize(cols, rows);
      return { success: true };
    }
  );
};

// Export functions for WebSocket integration
export function getVanillaTerminal(workingDir: string): pty.IPty | undefined {
  return vanillaTerminals.get(getTerminalId(workingDir));
}

export function writeToVanillaTerminal(workingDir: string, data: string): boolean {
  const terminal = vanillaTerminals.get(getTerminalId(workingDir));
  if (terminal) {
    terminal.write(data);
    return true;
  }
  return false;
}

export function onVanillaTerminalData(
  workingDir: string,
  callback: (data: string) => void
): (() => void) | undefined {
  const terminal = vanillaTerminals.get(getTerminalId(workingDir));
  if (terminal) {
    const disposable = terminal.onData(callback);
    return () => disposable.dispose();
  }
  return undefined;
}
