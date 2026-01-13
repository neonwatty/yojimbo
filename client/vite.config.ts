/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { parse as parseYaml } from 'yaml';

// Load YAML config for dev server proxy
interface AppConfig {
  host?: string;
  serverPort?: number;
  clientPort?: number;
}

function loadConfig(): AppConfig {
  const configPaths = [
    path.resolve(__dirname, '../config.yaml'),
    path.resolve(__dirname, '../.config.yaml'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return parseYaml(content) || {};
      } catch {
        // Ignore parse errors, use defaults
      }
    }
  }
  return {};
}

const config = loadConfig();
const configHost = config.host || '127.0.0.1';
const serverPort = config.serverPort || 3456;
const clientPort = process.env.CLIENT_PORT ? parseInt(process.env.CLIENT_PORT, 10) : (config.clientPort || 5173);

// For Vite's proxy, always use localhost since it's connecting locally
// even when the server is bound to 0.0.0.0
const proxyTarget = '127.0.0.1';

// Load version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: clientPort,
    // Bind to all interfaces when host is 0.0.0.0 to allow access from other devices
    host: configHost === '0.0.0.0' ? true : configHost,
    proxy: {
      '/api': {
        target: `http://${proxyTarget}:${serverPort}`,
        changeOrigin: true,
        // Disable buffering for SSE streaming endpoints
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            if (req.url?.includes('generate-stream')) {
              // Disable buffering for SSE
              proxyRes.headers['x-accel-buffering'] = 'no';
              proxyRes.headers['cache-control'] = 'no-cache';
            }
          });
        },
      },
      '/ws': {
        target: `ws://${proxyTarget}:${serverPort}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
