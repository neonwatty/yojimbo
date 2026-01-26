import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import instancesRouter from './routes/instances.js';
import sessionsRouter from './routes/sessions.js';
import plansRouter from './routes/plans.js';
import mockupsRouter from './routes/mockups.js';
import hooksRouter from './routes/hooks.js';
import settingsRouter from './routes/settings.js';
import filesystemRouter from './routes/filesystem.js';
import feedRouter from './routes/feed.js';
import summariesRouter from './routes/summaries.js';
import machinesRouter from './routes/machines.js';
import sshRouter from './routes/ssh.js';
import portForwardsRouter from './routes/port-forwards.js';
import keychainRouter from './routes/keychain.js';
import todosRouter from './routes/todos.js';
import releasesRouter from './routes/releases.js';
import projectsRouter from './routes/projects.js';
import smartTodosRouter from './routes/smart-todos.js';
// DISABLED: Debug routes are not currently being used
// import debugRouter from './routes/debug.js';
import CONFIG from './config/index.js';
import { portDetectionService } from './services/port-detection.service.js';

// Rate limiters for sensitive endpoints
const keychainLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { success: false, error: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const destructiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now (would need tuning for inline scripts)
  crossOriginEmbedderPolicy: false, // Allow embedding resources
}));

// CORS configuration
// In dev: allow localhost origins
// In prod: allow same-origin (when served from same host) or configured origins
const corsOrigins = CONFIG.isDev
  ? [
      `http://localhost:${CONFIG.clientPort}`,
      `http://127.0.0.1:${CONFIG.clientPort}`,
    ]
  : process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : true; // true = reflect request origin (same-origin when served together)

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

app.use(express.json());

// Config endpoint - provides runtime config to client
// Note: We only return the port - the client uses window.location.hostname
// to determine the host, which allows access from any device on the network
app.get('/api/config', async (_req, res) => {
  const networkAddresses = await portDetectionService.getNetworkAddresses();
  res.json({
    serverPort: CONFIG.port,
    platform: os.platform(), // 'darwin' for macOS, 'linux', 'win32', etc.
    label: CONFIG.label, // Optional label for distinguishing installations
    tailscaleIp: networkAddresses.tailscaleIp,
    lanIp: networkAddresses.lanIp,
  });
});

// API routes
app.use('/api/instances', instancesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/plans', plansRouter);
app.use('/api/mockups', mockupsRouter);
app.use('/api/hooks', hooksRouter);

// Settings routes with rate limiting on destructive endpoints
app.use('/api/settings/reset-database', destructiveLimiter);
app.use('/api/settings', settingsRouter);
app.use('/api/filesystem', filesystemRouter);
app.use('/api/feed', feedRouter);
app.use('/api/summaries', summariesRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/ssh', sshRouter);
app.use('/api/instances', portForwardsRouter);

// Keychain routes with rate limiting on sensitive endpoints
app.use('/api/keychain/unlock', keychainLimiter);
app.use('/api/keychain/local/save', keychainLimiter);
app.use('/api/keychain/local/test-unlock', keychainLimiter);
app.use('/api/keychain/remote/:machineId/save', keychainLimiter);
app.use('/api/keychain', keychainRouter);

app.use('/api/todos', todosRouter);
app.use('/api/releases', releasesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/smart-todos', smartTodosRouter);
// DISABLED: Debug routes are not currently being used
// app.use('/api/debug', debugRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (!CONFIG.isDev) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: CONFIG.isDev ? err.message : 'Internal server error',
  });
});

export default app;
