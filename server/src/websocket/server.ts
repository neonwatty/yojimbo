import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import type { WSClientMessage, WSServerMessage } from '@cc-orchestrator/shared';
import { ptyService } from '../services/pty.service.js';
import { terminalManager } from '../services/terminal-manager.service.js';
import { portForwardService } from '../services/port-forward.service.js';
import { getDatabase } from '../db/connection.js';
import { CONFIG } from '../config/index.js';

let wss: WebSocketServer;

// Client subscriptions: instanceId -> Set of clients
const subscriptions = new Map<string, Set<WebSocket>>();

// Track last known CWD per instance for change detection
const lastKnownCwds = new Map<string, string>();

// CWD polling interval reference
let cwdPollingInterval: ReturnType<typeof setInterval> | null = null;

// Debounce timers for saving CWD to database
const cwdSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Save last_cwd to database (debounced to avoid excessive writes)
function saveLastCwdToDb(instanceId: string, cwd: string): void {
  // Clear existing timer for this instance
  const existingTimer = cwdSaveTimers.get(instanceId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set new timer - save after 5 seconds of no changes
  const timer = setTimeout(() => {
    try {
      const db = getDatabase();
      db.prepare('UPDATE instances SET last_cwd = ? WHERE id = ?').run(cwd, instanceId);
      cwdSaveTimers.delete(instanceId);
    } catch (error) {
      console.error(`Failed to save last_cwd for instance ${instanceId}:`, error);
    }
  }, 5000);

  cwdSaveTimers.set(instanceId, timer);
}

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
      // Stop polling if no active subscribers remain
      updatePollingState();
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Set up PTY output forwarding (legacy - for backwards compatibility)
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
    // Clean up port forwards
    portForwardService.closeInstanceForwards(instanceId);
  });

  // Set up terminal manager output forwarding (for new backends)
  terminalManager.on('data', (instanceId: string, data: string) => {
    broadcastToInstance(instanceId, {
      type: 'terminal:output',
      instanceId,
      data,
    });

    // Check for port announcements in SSH backend output
    const backend = terminalManager.getBackend(instanceId);
    if (backend && backend.type === 'ssh') {
      const detectedPorts = portForwardService.analyzeOutput(instanceId, data);
      for (const port of detectedPorts) {
        // Broadcast port detection
        broadcast({
          type: 'port:detected',
          instanceId,
          portForward: { remotePort: port } as any,
        });

        // Auto-forward detected ports
        portForwardService.createForward(instanceId, port).then((forward) => {
          if (forward) {
            broadcast({
              type: 'port:forwarded',
              portForward: forward,
            });
          }
        }).catch((err) => {
          console.error(`Failed to auto-forward port ${port}:`, err);
        });
      }
    }
  });

  terminalManager.on('exit', (instanceId: string, exitCode: number) => {
    console.log(`Terminal ${instanceId} exited with code ${exitCode}`);
    broadcast({
      type: 'instance:closed',
      instanceId,
    });
    // Clean up CWD tracking and port forwards
    lastKnownCwds.delete(instanceId);
    portForwardService.closeInstanceForwards(instanceId);
  });

  // Don't start polling immediately - wait for first subscriber
  console.log('📂 CWD polling will start when first client subscribes');

  return wss;
}

// Check if any instance has active subscribers
function hasActiveSubscribers(): boolean {
  for (const clients of subscriptions.values()) {
    if (clients.size > 0) return true;
  }
  return false;
}

// Poll CWD for instances with active subscriptions
async function pollCwds(): Promise<void> {
  // Get unique instance IDs that have subscribed clients
  const activeInstanceIds = Array.from(subscriptions.entries())
    .filter(([, clients]) => clients.size > 0)
    .map(([instanceId]) => instanceId);

  for (const instanceId of activeInstanceIds) {
    try {
      // Try terminalManager first, fall back to ptyService
      let cwd: string | null = null;
      if (terminalManager.has(instanceId)) {
        cwd = await terminalManager.getCwd(instanceId);
      } else {
        cwd = await ptyService.getCwd(instanceId);
      }

      if (cwd) {
        const lastCwd = lastKnownCwds.get(instanceId);
        if (lastCwd !== cwd) {
          lastKnownCwds.set(instanceId, cwd);
          // Save to database (debounced)
          saveLastCwdToDb(instanceId, cwd);
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
  cwdPollingInterval = setInterval(pollCwds, CONFIG.runtime.cwdPollIntervalMs);
  console.log(`📂 CWD polling started (interval: ${CONFIG.runtime.cwdPollIntervalMs}ms)`);
}

export function stopCwdPolling(): void {
  if (cwdPollingInterval) {
    clearInterval(cwdPollingInterval);
    cwdPollingInterval = null;
    console.log('📂 CWD polling stopped');
  }
}

// Start/stop polling based on subscriber count
function updatePollingState(): void {
  if (hasActiveSubscribers()) {
    startCwdPolling();
  } else {
    stopCwdPolling();
  }
}

function handleMessage(ws: WebSocket, message: WSClientMessage): void {
  switch (message.type) {
    case 'terminal:input':
      if (message.instanceId && message.data) {
        // Try terminalManager first (new backend), fall back to ptyService (legacy)
        if (terminalManager.has(message.instanceId)) {
          terminalManager.write(message.instanceId, message.data);
        } else {
          ptyService.write(message.instanceId, message.data);
        }
      }
      break;

    case 'terminal:resize':
      if (message.instanceId && message.cols && message.rows) {
        // Try terminalManager first, fall back to ptyService
        if (terminalManager.has(message.instanceId)) {
          terminalManager.resize(message.instanceId, message.cols, message.rows);
        } else {
          ptyService.resize(message.instanceId, message.cols, message.rows);
        }
      }
      break;

    case 'subscribe':
      if (message.instanceId) {
        // Check if terminal exists in either manager, respawn if not
        const hasTerminal = terminalManager.has(message.instanceId) || ptyService.has(message.instanceId);
        if (!hasTerminal) {
          try {
            const db = getDatabase();
            const row = db.prepare('SELECT working_dir, last_cwd, machine_type, machine_id FROM instances WHERE id = ? AND closed_at IS NULL').get(message.instanceId) as { working_dir: string; last_cwd: string | null; machine_type: string; machine_id: string | null } | undefined;
            if (row) {
              // Use last_cwd if available, otherwise fall back to working_dir
              const spawnDir = row.last_cwd || row.working_dir;

              if (row.machine_type === 'remote' && row.machine_id) {
                // Respawn SSH backend via terminalManager
                console.log(`🔄 Respawning SSH terminal for instance ${message.instanceId} in ${spawnDir}`);
                terminalManager.spawn(message.instanceId, {
                  type: 'ssh',
                  machineId: row.machine_id,
                  workingDir: spawnDir,
                }).catch((err) => {
                  console.error(`Failed to respawn SSH terminal for instance ${message.instanceId}:`, err);
                });
              } else {
                // Respawn local PTY
                console.log(`🔄 Respawning PTY for instance ${message.instanceId} in ${spawnDir}`);
                ptyService.spawn(message.instanceId, spawnDir);
                // Update PID in database
                const pid = ptyService.getPid(message.instanceId);
                if (pid) {
                  db.prepare('UPDATE instances SET pid = ? WHERE id = ?').run(pid, message.instanceId);
                }
              }
            }
          } catch (error) {
            console.error(`Failed to respawn terminal for instance ${message.instanceId}:`, error);
          }
        }

        if (!subscriptions.has(message.instanceId)) {
          subscriptions.set(message.instanceId, new Set());
        }
        subscriptions.get(message.instanceId)!.add(ws);
        console.log(`Client subscribed to instance ${message.instanceId}`);

        // Start polling if this is the first subscriber
        updatePollingState();

        // Send terminal history to newly subscribed client
        let history = terminalManager.getHistory(message.instanceId);
        if (!history) {
          history = ptyService.getHistory(message.instanceId);
        }
        if (history) {
          send(ws, {
            type: 'terminal:output',
            instanceId: message.instanceId,
            data: history,
          });
          console.log(`📜 Sent ${history.length} bytes of terminal history to client`);
        }
      }
      break;

    case 'unsubscribe':
      if (message.instanceId && subscriptions.has(message.instanceId)) {
        subscriptions.get(message.instanceId)!.delete(ws);
        console.log(`Client unsubscribed from instance ${message.instanceId}`);
        // Stop polling if no active subscribers remain
        updatePollingState();
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
