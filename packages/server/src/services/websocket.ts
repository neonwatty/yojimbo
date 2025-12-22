import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { getTerminalManager } from './terminal-manager.js';
import {
  getVanillaTerminal,
  writeToVanillaTerminal,
  onVanillaTerminalData,
} from '../routes/vanilla-terminal.js';

interface WSMessage {
  type: string;
  payload: unknown;
}

interface TerminalInputPayload {
  terminalId: string;
  data: string;
}

interface TerminalResizePayload {
  terminalId: string;
  cols: number;
  rows: number;
}

interface VanillaTerminalPayload {
  workingDir: string;
  data?: string;
  cols?: number;
  rows?: number;
}

// Track client subscriptions to terminals
const clientTerminals = new WeakMap<WebSocket, Set<string>>();

// Track vanilla terminal subscriptions (workingDir -> Set<WebSocket>)
const vanillaTerminalClients = new Map<string, Set<WebSocket>>();
// Track cleanup functions for vanilla terminal data listeners
const vanillaTerminalCleanup = new Map<string, () => void>();

export function setupWebSocket(fastify: FastifyInstance): void {
  const terminalManager = getTerminalManager();

  // Forward terminal data to subscribed clients
  terminalManager.on('data', (terminalId, data) => {
    broadcastToTerminal(fastify, terminalId, {
      type: 'terminal-output',
      payload: { terminalId, data },
    });
  });

  terminalManager.on('exit', (terminalId, exitCode) => {
    broadcastToTerminal(fastify, terminalId, {
      type: 'terminal-exit',
      payload: { terminalId, exitCode },
    });
  });

  // Handle WebSocket connections
  fastify.get('/ws', { websocket: true }, (socket, _req) => {
    const ws = socket as unknown as WebSocket;
    clientTerminals.set(ws, new Set());

    ws.on('message', (rawMessage: Buffer) => {
      try {
        const message = JSON.parse(rawMessage.toString()) as WSMessage;
        handleMessage(ws, message);
      } catch {
        ws.send(
          JSON.stringify({
            type: 'error',
            payload: { message: 'Invalid message format' },
          })
        );
      }
    });

    ws.on('close', () => {
      clientTerminals.delete(ws);
    });

    // Send connection acknowledgment
    ws.send(JSON.stringify({ type: 'connected', payload: {} }));
  });
}

function handleMessage(ws: WebSocket, message: WSMessage): void {
  const terminalManager = getTerminalManager();

  switch (message.type) {
    case 'terminal-input': {
      const payload = message.payload as TerminalInputPayload;
      try {
        terminalManager.write(payload.terminalId, payload.data);
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: 'error',
            payload: { message: (error as Error).message },
          })
        );
      }
      break;
    }

    case 'terminal-resize': {
      const payload = message.payload as TerminalResizePayload;
      try {
        terminalManager.resize(payload.terminalId, payload.cols, payload.rows);
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: 'error',
            payload: { message: (error as Error).message },
          })
        );
      }
      break;
    }

    case 'terminal-subscribe': {
      const payload = message.payload as { terminalId: string };
      const subscriptions = clientTerminals.get(ws);
      if (subscriptions) {
        subscriptions.add(payload.terminalId);
      }
      break;
    }

    case 'terminal-unsubscribe': {
      const payload = message.payload as { terminalId: string };
      const subscriptions = clientTerminals.get(ws);
      if (subscriptions) {
        subscriptions.delete(payload.terminalId);
      }
      break;
    }

    // Vanilla terminal handlers
    case 'vanilla-terminal-subscribe': {
      const payload = message.payload as VanillaTerminalPayload;
      const { workingDir } = payload;

      // Add client to subscribers
      if (!vanillaTerminalClients.has(workingDir)) {
        vanillaTerminalClients.set(workingDir, new Set());
      }
      vanillaTerminalClients.get(workingDir)!.add(ws);

      // Set up data listener if not already done
      if (!vanillaTerminalCleanup.has(workingDir)) {
        const cleanup = onVanillaTerminalData(workingDir, (data) => {
          broadcastToVanillaTerminal(workingDir, {
            type: 'vanilla-terminal-output',
            payload: { workingDir, data },
          });
        });
        if (cleanup) {
          vanillaTerminalCleanup.set(workingDir, cleanup);
        }
      }
      break;
    }

    case 'vanilla-terminal-unsubscribe': {
      const payload = message.payload as VanillaTerminalPayload;
      const { workingDir } = payload;

      const clients = vanillaTerminalClients.get(workingDir);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          vanillaTerminalClients.delete(workingDir);
          // Clean up data listener
          const cleanup = vanillaTerminalCleanup.get(workingDir);
          if (cleanup) {
            cleanup();
            vanillaTerminalCleanup.delete(workingDir);
          }
        }
      }
      break;
    }

    case 'vanilla-terminal-input': {
      const payload = message.payload as VanillaTerminalPayload;
      if (payload.data) {
        const success = writeToVanillaTerminal(payload.workingDir, payload.data);
        if (!success) {
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: 'Vanilla terminal not found' },
            })
          );
        }
      }
      break;
    }

    case 'vanilla-terminal-resize': {
      const payload = message.payload as VanillaTerminalPayload;
      const terminal = getVanillaTerminal(payload.workingDir);
      if (terminal && payload.cols && payload.rows) {
        terminal.resize(payload.cols, payload.rows);
      }
      break;
    }

    default:
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: { message: `Unknown message type: ${message.type}` },
        })
      );
  }
}

function broadcastToTerminal(
  fastify: FastifyInstance,
  terminalId: string,
  message: WSMessage
): void {
  const wsServer = fastify.websocketServer;
  if (!wsServer) return;

  const messageStr = JSON.stringify(message);

  wsServer.clients.forEach((client: WebSocket) => {
    const ws = client;
    if (ws.readyState === WebSocket.OPEN) {
      const subscriptions = clientTerminals.get(ws);
      if (subscriptions?.has(terminalId)) {
        ws.send(messageStr);
      }
    }
  });
}

function broadcastToVanillaTerminal(workingDir: string, message: WSMessage): void {
  const clients = vanillaTerminalClients.get(workingDir);
  if (!clients) return;

  const messageStr = JSON.stringify(message);

  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}
