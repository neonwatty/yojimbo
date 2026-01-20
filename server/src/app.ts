import express from 'express';
import cors from 'cors';
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
import tasksRouter from './routes/tasks.js';
import releasesRouter from './routes/releases.js';
import projectsRouter from './routes/projects.js';
import smartTasksRouter from './routes/smart-tasks.js';
import debugRouter from './routes/debug.js';
import CONFIG from './config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Middleware
app.use(cors({
  origin: CONFIG.isDev ? [
    `http://localhost:${CONFIG.clientPort}`,
    `http://127.0.0.1:${CONFIG.clientPort}`,
  ] : false,
  credentials: true,
}));
app.use(express.json());

// Config endpoint - provides runtime config to client
// Note: We only return the port - the client uses window.location.hostname
// to determine the host, which allows access from any device on the network
app.get('/api/config', (_req, res) => {
  res.json({
    serverPort: CONFIG.port,
    platform: os.platform(), // 'darwin' for macOS, 'linux', 'win32', etc.
    label: CONFIG.label, // Optional label for distinguishing installations
  });
});

// API routes
app.use('/api/instances', instancesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/plans', plansRouter);
app.use('/api/mockups', mockupsRouter);
app.use('/api/hooks', hooksRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/filesystem', filesystemRouter);
app.use('/api/feed', feedRouter);
app.use('/api/summaries', summariesRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/ssh', sshRouter);
app.use('/api/instances', portForwardsRouter);
app.use('/api/keychain', keychainRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/releases', releasesRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/smart-tasks', smartTasksRouter);
app.use('/api/debug', debugRouter);

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
