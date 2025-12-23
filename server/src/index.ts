import { createServer } from 'http';
import app from './app.js';
import { initWebSocketServer } from './websocket/server.js';
import { initDatabase } from './db/connection.js';
import { startSessionWatcher, stopSessionWatcher } from './services/session-watcher.service.js';
import CONFIG from './config/index.js';

async function main() {
  console.log('🚀 Starting CC Orchestrator Server...');

  // Initialize database
  console.log('📦 Initializing database...');
  initDatabase();

  // Create HTTP server
  const server = createServer(app);

  // Initialize WebSocket server
  console.log('🔌 Initializing WebSocket server...');
  initWebSocketServer(server);

  // Start session watcher
  console.log('👀 Starting session watcher...');
  startSessionWatcher();

  // Start server
  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`✅ Server running at http://${CONFIG.host}:${CONFIG.port}`);
    console.log(`   WebSocket at ws://${CONFIG.host}:${CONFIG.port}/ws`);
    console.log(`   Environment: ${CONFIG.nodeEnv}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    stopSessionWatcher();
    server.close(() => {
      console.log('👋 Server closed');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
