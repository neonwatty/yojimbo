import { createServer } from 'http';
import app from './app.js';
import { initWebSocketServer, broadcast } from './websocket/server.js';
import { initDatabase, getDatabase, cleanupStalePortForwards } from './db/connection.js';
import { startSessionWatcher, stopSessionWatcher } from './services/session-watcher.service.js';
import { remoteStatusPollerService } from './services/remote-status-poller.service.js';
import { localStatusPollerService } from './services/local-status-poller.service.js';
import { statusTimeoutService } from './services/status-timeout.service.js';
import { localKeychainService } from './services/local-keychain.service.js';
import CONFIG from './config/index.js';

async function main() {
  console.log('🚀 Starting CC Orchestrator Server...');

  // Initialize database
  console.log('📦 Initializing database...');
  initDatabase();

  // Reset all instance statuses to idle on startup
  // This ensures no stale 'working' or 'awaiting' states from previous sessions
  const db = getDatabase();
  const resetResult = db.prepare(`
    UPDATE instances
    SET status = 'idle', updated_at = datetime('now')
    WHERE closed_at IS NULL AND status != 'idle'
  `).run();
  if (resetResult.changes > 0) {
    console.log(`🔄 Reset ${resetResult.changes} instance(s) to idle status`);
  }

  // Clean up stale port forwards from previous sessions
  cleanupStalePortForwards();

  // Create HTTP server
  const server = createServer(app);

  // Initialize WebSocket server
  console.log('🔌 Initializing WebSocket server...');
  initWebSocketServer(server);

  // Start session watcher
  console.log('👀 Starting session watcher...');
  startSessionWatcher();

  // Start remote status poller
  console.log('🔄 Starting remote status poller...');
  remoteStatusPollerService.start();

  // Local status poller disabled - status now tracked only via hooks from Yojimbo terminals
  // This prevents external Claude sessions from affecting Yojimbo instance status
  // console.log('🔍 Starting local status poller...');
  // localStatusPollerService.start();

  // Start status timeout service
  console.log('⏱️ Starting status timeout service...');
  statusTimeoutService.start();

  // Attempt local keychain auto-unlock (macOS only)
  console.log('🔐 Checking local keychain...');
  const keychainResult = await localKeychainService.attemptAutoUnlock();
  if (!keychainResult.success && !keychainResult.skipped) {
    console.log('🔒 Local keychain auto-unlock failed, will notify clients');
    // Broadcast failure to connected clients (they may not be connected yet at startup)
    // The client will also check keychain status on load as a fallback
    setTimeout(() => {
      broadcast({
        type: 'keychain:unlock-failed',
        keychainError: keychainResult.error || 'Failed to unlock keychain',
      });
    }, 2000); // Delay to give clients time to connect
  }

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
    remoteStatusPollerService.stop();
    localStatusPollerService.stop();
    statusTimeoutService.stop();
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
