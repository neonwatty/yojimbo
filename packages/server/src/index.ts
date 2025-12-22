import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { initDb, closeDb } from './db/index.js';
import { getTerminalManager } from './services/terminal-manager.js';
import { setupWebSocket } from './services/websocket.js';
import { restoreSession, saveSessionState } from './services/session-persistence.js';
import { instanceRoutes } from './routes/instances.js';
import { sessionRoutes } from './routes/sessions.js';
import { statusEventRoutes } from './routes/status-events.js';
import { hookRoutes } from './routes/hooks.js';

const fastify = Fastify({
  logger: true,
});

// Initialize database
console.log('Initializing database...');
initDb();

// Restore previous session
console.log('Restoring previous session...');
const { restored, failed } = restoreSession();
console.log(`Session restore complete: ${restored} restored, ${failed} failed`);

// Register CORS
await fastify.register(cors, {
  origin: true,
});

// Register WebSocket support
await fastify.register(websocket);

// Setup WebSocket handlers
setupWebSocket(fastify);

// Register routes
await fastify.register(instanceRoutes);
await fastify.register(sessionRoutes);
await fastify.register(statusEventRoutes);
await fastify.register(hookRoutes);

// Health check endpoint
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  // Save session state before killing terminals
  console.log('Saving session state...');
  saveSessionState();

  // Kill all terminals
  const terminalManager = getTerminalManager();
  terminalManager.killAll();

  // Close database
  closeDb();

  // Close server
  await fastify.close();

  console.log('Shutdown complete');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
