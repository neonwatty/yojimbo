import express from 'express';
import cors from 'cors';
import path from 'path';
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
app.get('/api/config', (_req, res) => {
  res.json({
    host: CONFIG.host,
    serverPort: CONFIG.port,
    wsUrl: `ws://${CONFIG.host}:${CONFIG.port}/ws`,
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (!CONFIG.isDev) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
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
