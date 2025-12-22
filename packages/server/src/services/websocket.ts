import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { getTerminalManager } from './terminal-manager.js';

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

// Track client subscriptions to terminals
const clientTerminals = new WeakMap<WebSocket, Set<string>>();

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
      } catch (error) {
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
