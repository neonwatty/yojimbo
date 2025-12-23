import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { WSClientMessage, WSServerMessage } from '@cc-orchestrator/shared';
import { ptyService } from '../services/pty.service.js';

let wss: WebSocketServer;

// Client subscriptions: instanceId -> Set of clients
const subscriptions = new Map<string, Set<WebSocket>>();

export function initWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');

    ws.on('message', (data) => {
      try {
        const message: WSClientMessage = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
        sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
      // Remove from all subscriptions
      for (const clients of subscriptions.values()) {
        clients.delete(ws);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Set up PTY output forwarding
  ptyService.on('data', (instanceId: string, data: string) => {
    broadcastToInstance(instanceId, {
      type: 'terminal:output',
      instanceId,
      data,
    });
  });

  ptyService.on('exit', (instanceId: string, exitCode: number) => {
    console.log(`PTY ${instanceId} exited with code ${exitCode}`);
    broadcast({
      type: 'instance:closed',
      instanceId,
    });
  });

  return wss;
}

function handleMessage(ws: WebSocket, message: WSClientMessage): void {
  switch (message.type) {
    case 'terminal:input':
      if (message.instanceId && message.data) {
        ptyService.write(message.instanceId, message.data);
      }
      break;

    case 'terminal:resize':
      if (message.instanceId && message.cols && message.rows) {
        ptyService.resize(message.instanceId, message.cols, message.rows);
      }
      break;

    case 'subscribe':
      if (message.instanceId) {
        if (!subscriptions.has(message.instanceId)) {
          subscriptions.set(message.instanceId, new Set());
        }
        subscriptions.get(message.instanceId)!.add(ws);
        console.log(`Client subscribed to instance ${message.instanceId}`);
      }
      break;

    case 'unsubscribe':
      if (message.instanceId && subscriptions.has(message.instanceId)) {
        subscriptions.get(message.instanceId)!.delete(ws);
        console.log(`Client unsubscribed from instance ${message.instanceId}`);
      }
      break;

    default:
      console.warn('Unknown message type:', message);
  }
}

function send(ws: WebSocket, message: WSServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws: WebSocket, error: string): void {
  send(ws, { type: 'error', error });
}

export function broadcast(message: WSServerMessage): void {
  if (!wss) return;

  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function broadcastToInstance(instanceId: string, message: WSServerMessage): void {
  const clients = subscriptions.get(instanceId);
  if (!clients) return;

  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

export function getWebSocketServer(): WebSocketServer {
  return wss;
}
