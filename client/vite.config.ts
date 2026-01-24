/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
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

// Load version: prefer environment variable (set during CI builds), fallback to package.json
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'));
const appVersion = process.env.VITE_APP_VERSION || packageJson.version;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: false, // Use existing manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
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
