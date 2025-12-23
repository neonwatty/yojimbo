import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { WSClientMessage, WSServerMessage } from '@cc-orchestrator/shared';
import { ptyService } from '../services/pty.service.js';
import { getDatabase } from '../db/connection.js';

let wss: WebSocketServer;

// Client subscriptions: instanceId -> Set of clients
const subscriptions = new Map<string, Set<WebSocket>>();

// Track last known CWD per instance for change detection
const lastKnownCwds = new Map<string, string>();

// CWD polling interval reference
let cwdPollingInterval: ReturnType<typeof setInterval> | null = null;

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
    // Clean up CWD tracking for this instance
    lastKnownCwds.delete(instanceId);
  });

  // Start CWD polling
  startCwdPolling();

  return wss;
}

// Poll CWD for instances with active subscriptions
async function pollCwds(): Promise<void> {
  // Get unique instance IDs that have subscribed clients
  const activeInstanceIds = Array.from(subscriptions.entries())
    .filter(([, clients]) => clients.size > 0)
    .map(([instanceId]) => instanceId);

  for (const instanceId of activeInstanceIds) {
    try {
      const cwd = await ptyService.getCwd(instanceId);
      if (cwd) {
        const lastCwd = lastKnownCwds.get(instanceId);
        if (lastCwd !== cwd) {
          lastKnownCwds.set(instanceId, cwd);
          // Broadcast CWD change to ALL clients (not just subscribed)
          // This ensures the main app (useInstances) receives the update
          broadcast({
            type: 'cwd:changed',
            instanceId,
            cwd,
          } as WSServerMessage);
        }
      }
    } catch {
      // Ignore errors - instance may have exited
    }
  }
}

function startCwdPolling(): void {
  if (cwdPollingInterval) return;
  // Poll every 2 seconds
  cwdPollingInterval = setInterval(pollCwds, 2000);
  console.log('📂 CWD polling started');
}

export function stopCwdPolling(): void {
  if (cwdPollingInterval) {
    clearInterval(cwdPollingInterval);
    cwdPollingInterval = null;
    console.log('📂 CWD polling stopped');
  }
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
        // Check if PTY exists, respawn if not (e.g., after server restart)
        if (!ptyService.has(message.instanceId)) {
          try {
            const db = getDatabase();
            const row = db.prepare('SELECT working_dir FROM instances WHERE id = ? AND closed_at IS NULL').get(message.instanceId) as { working_dir: string } | undefined;
            if (row) {
              console.log(`🔄 Respawning PTY for instance ${message.instanceId}`);
              const ptyInstance = ptyService.spawn(message.instanceId, row.working_dir);
              // Update PID in database
              db.prepare('UPDATE instances SET pid = ? WHERE id = ?').run(ptyInstance.pty.pid, message.instanceId);
            }
          } catch (error) {
            console.error(`Failed to respawn PTY for instance ${message.instanceId}:`, error);
          }
        }

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
